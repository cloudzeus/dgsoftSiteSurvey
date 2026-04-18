// GEMI (ΓΕΜΗ) Open Data API client.
// Spec: https://opendata-api.businessportal.gr/opendata/docs/

const BASE_URL = "https://opendata-api.businessportal.gr/api/opendata/v1"

export type GemiSortBy =
  | "+coName" | "-coName"
  | "+afm" | "-afm"
  | "+arGemi" | "-arGemi"
  | "+incorporationDate" | "-incorporationDate"

export interface GemiSearchCriteria {
  arGemi?: string
  afm?: string
  name?: string
  legalTypes?: number[]
  gemiOffices?: string[]
  municipalities?: string[]
  prefectures?: number[]
  statuses?: number[]
  isActive?: boolean
  activities?: string[]
  resultsSortBy?: GemiSortBy
  resultsOffset?: number
  resultsSize?: number
}

interface IdDescr<T = number | string> { id: T; descr: string }

export interface GemiCompanyActivity {
  activity?: { id: string; descr: string }
  isPrimary?: boolean
  // Spec uses `CompanyActivity` ref — keep loose to tolerate variation.
  [key: string]: unknown
}

export interface GemiCompanyPerson {
  [key: string]: unknown
}

export interface GemiCompany {
  arGemi: number
  afm: string | null
  coNameEl: string | null
  coNamesEn?: string[]
  coTitlesEl?: string[]
  coTitlesEn?: string[]
  municipality?: IdDescr<string>
  prefecture?: IdDescr<number>
  city?: string
  street?: string
  streetNumber?: string
  zipCode?: string
  poBox?: string
  url?: string
  email?: string
  isBranch?: boolean
  objective?: string
  legalType?: IdDescr<number>
  gemiOffice?: IdDescr<string>
  assemblySubjects?: IdDescr<number>[]
  incorporationDate?: string
  lastStatusChange?: string
  status?: IdDescr<number>
  autoRegistered?: boolean
  activities?: GemiCompanyActivity[]
  persons?: GemiCompanyPerson[]
  capital?: Array<{ capitalStock: number; currency: string; ecsokefalaiikes?: number; eggiitikes?: number }>
  stocks?: Array<{ stockTypeId: number; amount: number; nominalPrice: number; stockType?: string }>
  branch?: number[]
}

export interface GemiSearchResponse {
  searchMetadata: { totalCount: number; resultsOffset: number; resultsSize: number }
  searchResults: GemiCompany[]
}

interface GemiErrorEntry {
  field?: string
  message?: string
  [k: string]: unknown
}

function buildQuery(criteria: GemiSearchCriteria): URLSearchParams {
  const qs = new URLSearchParams()
  if (criteria.arGemi) qs.set("arGemi", criteria.arGemi)
  if (criteria.afm) qs.set("afm", criteria.afm)
  if (criteria.name) qs.set("name", criteria.name)
  if (criteria.legalTypes?.length) qs.set("legalTypes", criteria.legalTypes.join(","))
  if (criteria.gemiOffices?.length) qs.set("gemiOffices", criteria.gemiOffices.join(","))
  if (criteria.municipalities?.length) qs.set("municipalities", criteria.municipalities.join(","))
  if (criteria.prefectures?.length) qs.set("prefectures", criteria.prefectures.join(","))
  if (criteria.statuses?.length) qs.set("statuses", criteria.statuses.join(","))
  if (typeof criteria.isActive === "boolean") qs.set("isActive", String(criteria.isActive))
  if (criteria.activities?.length) qs.set("activities", criteria.activities.join(","))
  qs.set("resultsSortBy", criteria.resultsSortBy ?? "+arGemi")
  qs.set("resultsOffset", String(criteria.resultsOffset ?? 0))
  qs.set("resultsSize", String(Math.min(criteria.resultsSize ?? 10, 200)))
  return qs
}

function getApiKey(): string {
  const key = process.env.GEMI_API_KEY
  if (!key) throw new Error("GEMI_API_KEY is not set")
  return key
}

export async function searchGemiCompanies(
  criteria: GemiSearchCriteria,
): Promise<GemiSearchResponse> {
  const hasCriteria =
    criteria.arGemi || criteria.afm || criteria.name ||
    criteria.legalTypes?.length || criteria.gemiOffices?.length ||
    criteria.municipalities?.length || criteria.prefectures?.length ||
    criteria.statuses?.length || criteria.activities?.length ||
    typeof criteria.isActive === "boolean"

  if (!hasCriteria) throw new Error("Πρέπει να εισαχθεί τουλάχιστον ένα κριτήριο αναζήτησης")

  const url = `${BASE_URL}/companies?${buildQuery(criteria).toString()}`
  const res = await fetch(url, {
    headers: {
      api_key: getApiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (res.status === 404) {
    return { searchMetadata: { totalCount: 0, resultsOffset: 0, resultsSize: 0 }, searchResults: [] }
  }

  if (!res.ok) {
    let detail = ""
    try {
      const body = (await res.json()) as { errors?: GemiErrorEntry[] } | GemiErrorEntry[]
      const errs = Array.isArray(body) ? body : body.errors
      if (errs?.length) detail = errs.map((e) => e.message ?? JSON.stringify(e)).join("; ")
    } catch {
      detail = await res.text().then((t) => t.slice(0, 200)).catch(() => "")
    }
    throw new Error(`GEMI API ${res.status}${detail ? `: ${detail}` : ""}`)
  }

  return (await res.json()) as GemiSearchResponse
}

export interface GemiDocumentDecision {
  dateAssemblyDecided?: string
  assembly?: string
  summary?: string
  kak?: string
  decisionSubject?: string
  decisionSubjectID?: string
  dateAnnounced?: string
  assemblyDecisionUrl?: string
  dateRegistrated?: string
  applicationStatusId?: string
  applicationStatusDescription?: string
  referenceKak?: string
}

export interface GemiDocumentPublication {
  url?: string
  kad?: string
}

export interface GemiDocumentSet {
  decision: GemiDocumentDecision[]
  publication: GemiDocumentPublication[]
}

export async function getGemiCompanyDocuments(arGemi: string | number): Promise<GemiDocumentSet> {
  const url = `${BASE_URL}/companies/${arGemi}/documents`
  const res = await fetch(url, {
    headers: { api_key: getApiKey(), Accept: "application/json" },
    cache: "no-store",
  })
  if (res.status === 404) return { decision: [], publication: [] }
  if (!res.ok) throw new Error(`GEMI documents API ${res.status}`)
  const data = (await res.json()) as Partial<GemiDocumentSet>
  return {
    decision: Array.isArray(data.decision) ? data.decision : [],
    publication: Array.isArray(data.publication) ? data.publication : [],
  }
}

export async function getGemiCompany(arGemi: string | number): Promise<GemiCompany | null> {
  const url = `${BASE_URL}/companies/${arGemi}`
  const res = await fetch(url, {
    headers: { api_key: getApiKey(), Accept: "application/json" },
    cache: "no-store",
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GEMI API ${res.status}`)
  return (await res.json()) as GemiCompany
}

/**
 * GEMI puts contact data in the wrong fields surprisingly often (a URL ending
 * up in `email`, a mailto in `url`, etc.). Inspect a string and decide whether
 * it's an email, a webpage, or junk.
 */
export function classifyContact(value: string | null | undefined): { email?: string; webpage?: string } {
  if (!value) return {}
  let v = value.trim()
  if (!v) return {}

  // Strip common prefixes
  if (v.toLowerCase().startsWith("mailto:")) v = v.slice(7).trim()

  // Email — must have exactly one @, no spaces, dot in the domain part.
  if (/^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(v)) {
    return { email: v.toLowerCase() }
  }

  // Webpage — starts with http(s)://, www., or looks like a bare host (has a dot, no @, no space).
  if (/^https?:\/\//i.test(v)) return { webpage: v }
  if (/^www\./i.test(v)) return { webpage: `https://${v}` }
  if (v.includes(".") && !v.includes("@") && !v.includes(" ")) {
    return { webpage: `https://${v}` }
  }

  return {}
}

/**
 * Pick the best email + webpage from any number of mixed candidate strings.
 * Tries each value with `classifyContact` and keeps the first valid hit per bucket.
 */
export function reconcileContacts(
  ...candidates: Array<string | null | undefined>
): { email: string | null; webpage: string | null } {
  let email: string | null = null
  let webpage: string | null = null
  for (const c of candidates) {
    const { email: e, webpage: w } = classifyContact(c)
    if (e && !email) email = e
    if (w && !webpage) webpage = w
    if (email && webpage) break
  }
  return { email, webpage }
}

export function formatGemiAddress(c: GemiCompany): string {
  const parts = [
    [c.street, c.streetNumber].filter(Boolean).join(" "),
    c.zipCode,
    c.city,
    c.municipality?.descr,
  ].filter(Boolean)
  return parts.join(", ")
}
