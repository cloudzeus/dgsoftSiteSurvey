"use server"

import fs from "node:fs/promises"
import path from "node:path"
import { auth } from "@/lib/auth"
import { userCanReadResource } from "@/lib/rbac-builtins"
import { locales, type Locale } from "@/i18n"

const MESSAGES_DIR = path.join(process.cwd(), "messages")

export type FlatTranslations = Record<string, string>
export type TranslationEntry = {
  path: string
  values: Record<Locale, string>
}

// ─── flatten / unflatten helpers ─────────────────────────────────────────────

function flatten(obj: unknown, prefix = ""): FlatTranslations {
  const out: FlatTranslations = {}
  if (obj === null || typeof obj !== "object") return out
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else if (typeof v === "string") {
      out[key] = v
    }
  }
  return out
}

function unflatten(flat: FlatTranslations): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(flat)) {
    const segments = path.split(".")
    let cursor = out
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      if (typeof cursor[seg] !== "object" || cursor[seg] === null) {
        cursor[seg] = {}
      }
      cursor = cursor[seg] as Record<string, unknown>
    }
    cursor[segments[segments.length - 1]] = value
  }
  return out
}

// ─── auth gate ────────────────────────────────────────────────────────────────

async function requireSettingsAccess(): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Not authenticated")
  const u = session.user as { role?: string; readResources?: string[] }
  if (!userCanReadResource(u, "settings")) {
    throw new Error("Forbidden — settings access required")
  }
}

// ─── load all translations as a unified list ─────────────────────────────────

export async function loadTranslations(): Promise<{ entries: TranslationEntry[] }> {
  await requireSettingsAccess()

  const flat: Record<Locale, FlatTranslations> = {} as Record<Locale, FlatTranslations>
  for (const loc of locales) {
    const raw = await fs.readFile(path.join(MESSAGES_DIR, `${loc}.json`), "utf8")
    flat[loc] = flatten(JSON.parse(raw))
  }

  const allKeys = new Set<string>()
  for (const loc of locales) for (const k of Object.keys(flat[loc])) allKeys.add(k)

  const entries: TranslationEntry[] = [...allKeys]
    .sort()
    .map((p) => {
      const values = {} as Record<Locale, string>
      for (const loc of locales) values[loc] = flat[loc][p] ?? ""
      return { path: p, values }
    })

  return { entries }
}

// ─── persist updates (atomic per-locale write) ───────────────────────────────

export async function saveTranslations(
  updates: Array<{ path: string; locale: Locale; value: string }>,
): Promise<{ ok: true; updated: number }> {
  await requireSettingsAccess()

  if (updates.length === 0) return { ok: true, updated: 0 }

  // Group by locale
  const byLocale = new Map<Locale, FlatTranslations>()
  for (const u of updates) {
    if (!(locales as readonly string[]).includes(u.locale)) {
      throw new Error(`Invalid locale: ${u.locale}`)
    }
    if (!byLocale.has(u.locale)) byLocale.set(u.locale, {})
    byLocale.get(u.locale)![u.path] = u.value
  }

  for (const [loc, patch] of byLocale) {
    const filePath = path.join(MESSAGES_DIR, `${loc}.json`)
    const raw = await fs.readFile(filePath, "utf8")
    const current = flatten(JSON.parse(raw))
    Object.assign(current, patch)
    const next = unflatten(current)
    const serialized = JSON.stringify(next, null, 2) + "\n"
    const tmp = `${filePath}.${process.pid}.tmp`
    await fs.writeFile(tmp, serialized, "utf8")
    await fs.rename(tmp, filePath)
  }

  return { ok: true, updated: updates.length }
}

// ─── DeepSeek translation ────────────────────────────────────────────────────

const LOCALE_NAMES: Record<Locale, string> = {
  el: "Greek",
  en: "English",
}

export async function translateWithDeepseek(
  text: string,
  fromLocale: Locale,
  toLocale: Locale,
): Promise<{ translated: string }> {
  await requireSettingsAccess()

  if (!text.trim()) return { translated: "" }
  if (fromLocale === toLocale) return { translated: text }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set")

  const systemPrompt = `You are a professional UI translator for a SaaS admin dashboard (B2B Greek market). Translate the user's text from ${LOCALE_NAMES[fromLocale]} to ${LOCALE_NAMES[toLocale]}.

Rules:
- Return ONLY the translated text. No explanations, no quotes, no surrounding punctuation that wasn't in the source.
- Preserve placeholders like {count}, {name}, {from}, {to} EXACTLY as-is.
- Preserve capitalization style (Title Case, sentence case) of the source.
- Preserve trailing punctuation (… : etc.) of the source.
- Keep technical terms (IoT, AI, AADE, ERP, XML, SQL, IP, API, URL, ID) untranslated.
- Use modern, concise business UI vocabulary — not literal/word-for-word.
- For Greek: use "Επεξεργασία" for Edit, "Αποθήκευση" for Save, "Διαγραφή" for Delete, "Ακύρωση" for Cancel, "Αναζήτηση" for Search, "Πελάτης" for Customer, "Ενότητα" for Section.`

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepSeek API ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const translated = json.choices?.[0]?.message?.content?.trim() ?? ""
  if (!translated) throw new Error("DeepSeek returned empty translation")

  return { translated }
}
