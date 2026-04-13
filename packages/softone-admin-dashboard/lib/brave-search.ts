// Company web discovery — server-side only.
// Uses DuckDuckGo HTML (free, no key, no rate limits) as the primary engine.
// If a BRAVE_SEARCH connection exists and is active, Brave is used instead
// (higher quality results, but subject to plan limits).
//
// Usage:
//   import { findCompanyWeb } from "@/lib/brave-search"
//   const { website, email } = await findCompanyWeb("ΑΦΟΙ ΚΟΛΛΕΡΗ ΙΚΕ", "ΠΕΙΡΑΙΑΣ")

import { db } from "@/lib/db"

const DIRECTORY_BLACKLIST =
  /facebook|instagram|linkedin|twitter|tiktok|youtube|wikipedia|taxisnet|gsis|businessregistry|europages|kompass|cylex|insites|e-forologia|vat\.gr|wwa\.gr/i

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BraveWebResult {
  title: string
  url: string
  description: string
}

export interface CompanyWebInfo {
  website: string | null
  email: string | null
  source: string | null
}

// ─── DuckDuckGo HTML engine (primary, no key) ──────────────────────────────────

async function ddgSearch(query: string): Promise<BraveWebResult[]> {
  const body = new URLSearchParams({ q: query, kl: "gr-el" })

  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (compatible; SoftBoilerplate/1.0; +https://github.com)",
    },
    body: body.toString(),
    cache: "no-store",
  })

  if (!res.ok) throw new Error(`DuckDuckGo search failed: ${res.status}`)

  const html = await res.text()
  const results: BraveWebResult[] = []

  // Extract result blocks — DDG HTML wraps each in <div class="result">
  const blockRe = /<div[^>]+class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
  let block: RegExpExecArray | null

  while ((block = blockRe.exec(html)) !== null && results.length < 8) {
    const inner = block[1]

    // URL: encoded in uddg= query param inside href
    const urlMatch = inner.match(/uddg=(https?[^&"]+)/)
    const url = urlMatch ? decodeURIComponent(urlMatch[1]) : null
    if (!url) continue

    // Title
    const titleMatch = inner.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : ""

    // Snippet
    const snippetMatch = inner.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/)
    const description = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").trim()
      : ""

    results.push({ title, url, description })
  }

  return results
}

// ─── Brave engine (optional, used when connection is active) ───────────────────

async function getBraveKey(): Promise<string | null> {
  try {
    const conn = await db.connection.findFirst({
      where: { type: "BRAVE_SEARCH", isActive: true },
    })
    const creds = conn?.credentials as Record<string, unknown> | undefined
    return typeof creds?.apiKey === "string" && creds.apiKey ? creds.apiKey : null
  } catch {
    return null
  }
}

async function braveSearch(query: string, apiKey: string): Promise<BraveWebResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search")
  url.searchParams.set("q", query)
  url.searchParams.set("count", "8")
  url.searchParams.set("search_lang", "el")
  url.searchParams.set("country", "GR")

  const res = await fetch(url.toString(), {
    headers: {
      "Accept":               "application/json",
      "Accept-Encoding":      "gzip",
      "X-Subscription-Token": apiKey,
    },
    cache: "no-store",
  })

  if (res.status === 429) {
    // Free tier: 1 req/s. Wait and retry once.
    await new Promise((r) => setTimeout(r, 1100))
    const retry = await fetch(url.toString(), {
      headers: {
        "Accept":               "application/json",
        "Accept-Encoding":      "gzip",
        "X-Subscription-Token": apiKey,
      },
      cache: "no-store",
    })
    if (retry.status === 429) throw new Error("RATE_LIMITED")
    if (!retry.ok) throw new Error(`Brave Search failed: ${retry.status}`)
    const retryData = await retry.json()
    return (retryData?.web?.results ?? []).map((r: any) => ({
      title:       r.title       ?? "",
      url:         r.url         ?? "",
      description: r.description ?? "",
    }))
  }

  if (!res.ok) throw new Error(`Brave Search failed: ${res.status}`)

  const data = await res.json()
  return (data?.web?.results ?? []).map((r: any) => ({
    title:       r.title       ?? "",
    url:         r.url         ?? "",
    description: r.description ?? "",
  }))
}

// ─── Unified search — Brave first, DDG fallback ────────────────────────────────

async function search(query: string): Promise<BraveWebResult[]> {
  const braveKey = await getBraveKey()
  if (braveKey) {
    try {
      return await braveSearch(query, braveKey)
    } catch (e: any) {
      // Fall through to DDG on rate limit or any Brave error
      if (e?.message !== "RATE_LIMITED") console.warn("[search] Brave error, falling back to DDG:", e?.message)
    }
  }
  return ddgSearch(query)
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function findCompanyWeb(
  name: string,
  city: string,
): Promise<CompanyWebInfo> {
  const q = `"${name}" "${city}"`

  // ── Website ────────────────────────────────────────────────────────────────
  const siteResults = await search(`${q} site:*.gr OR Greece`)

  let website: string | null = null
  for (const r of siteResults) {
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, "")
      if (!DIRECTORY_BLACKLIST.test(host)) { website = r.url; break }
    } catch {}
  }
  if (!website) {
    for (const r of siteResults) {
      if (!DIRECTORY_BLACKLIST.test(r.url)) { website = r.url; break }
    }
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  // Brave free tier = 1 req/s — wait before second call to avoid 429
  await new Promise((r) => setTimeout(r, 1100))

  let email:  string | null = null
  let source: string | null = null

  const emailResults = await search(`${q} email επικοινωνία`)
  for (const r of emailResults) {
    const matches = r.description.match(EMAIL_RE)
    const candidate = matches?.find((m) => !/noreply|no-reply|donotreply|example/i.test(m))
    if (candidate) { email = candidate; source = r.url; break }
  }

  return { website, email, source }
}
