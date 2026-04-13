// Unified server-side Softone client.
// Reads the active SOFTONE connection from the Connection table.
// Logs every request and response to the in-memory s1Log ring buffer.
// Usage: import { s1 } from "@/lib/s1"
//        const data = await s1("getData", { OBJECT: "CUSTOMER", KEY: 123 })

import iconv from "iconv-lite"
import axios from "axios"
import { db } from "@/lib/db"
import { s1Log } from "@/lib/s1-log"

// ─── Session cache (in-memory, per baseUrl) ────────────────────────────────────

const SESSION: Map<string, { clientID: string; expiresAt: number }> = new Map()
const REFRESH_BUFFER_MS = 5 * 60 * 1000

function loadSession(key: string): string | null {
  const s = SESSION.get(key)
  return s && Date.now() < s.expiresAt - REFRESH_BUFFER_MS ? s.clientID : null
}

function saveSession(key: string, clientID: string, ttlMs: number) {
  SESSION.set(key, { clientID, expiresAt: Date.now() + ttlMs })
}

function clearSession(key: string) {
  SESSION.delete(key)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) =>
      [k, /password|secret|token/i.test(k) ? "***" : v]
    )
  )
}

function sessionKey(baseUrl: string) {
  return baseUrl.replace(/https?:\/\//, "").replace(/[^a-z0-9]/gi, "_").toLowerCase()
}

// ─── Low-level fetch with logging ──────────────────────────────────────────────

async function s1Fetch(url: string, body: Record<string, unknown>): Promise<any> {
  const service = (body.service ?? body.SERVICE ?? "?") as string
  const logId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const start = Date.now()

  s1Log.push({
    id: `${logId}-req`,
    ts: new Date(),
    direction: "→",
    service,
    payload: redact(body),
  })

  let data: unknown
  try {
    const res = await axios.post(url, body, {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      responseType: "arraybuffer",
      headers: { "Content-Type": "application/json" },
    })
    const buf = Buffer.from(res.data)
    data = JSON.parse(iconv.decode(buf, "win1253"))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s1Log.push({ id: `${logId}-res`, ts: new Date(), direction: "←", service, payload: { error: msg }, ok: false, durationMs: Date.now() - start })
    throw err
  }

  s1Log.push({
    id: `${logId}-res`,
    ts: new Date(),
    direction: "←",
    service,
    payload: data,
    ok: (data as any)?.success !== false,
    durationMs: Date.now() - start,
  })

  return data
}

// ─── Credentials from Connection table ────────────────────────────────────────

interface S1Creds {
  baseUrl: string
  username: string
  password: string
  appId: string
  company: string
  branch: string
  module: string
  refId: string
  ttlMs: number
  sessionKey: string
}

async function getCredentials(): Promise<S1Creds> {
  const conn = await db.connection.findFirst({
    where: { type: "SOFTONE", isActive: true },
    orderBy: { createdAt: "asc" },
  })
  if (!conn) throw new Error("No active Softone connection. Configure one in Settings → Connections.")

  const c = conn.credentials as Record<string, any>
  const rawUrl = ((c.baseUrl ?? c.serialNo ?? "") as string).replace(/\/+$/, "").replace(/\/s1services$/i, "")
  const baseUrl = `${rawUrl}/s1services`

  return {
    baseUrl,
    username: c.username ?? "",
    password: c.password ?? "",
    appId: c.appId ?? "",
    company: c.company ?? "",
    branch: c.branch ?? "",
    module: c.module ?? "",
    refId: c.refId ?? "",
    ttlMs: ((c.sessionTtlHours ?? 8) as number) * 60 * 60 * 1000,
    sessionKey: sessionKey(baseUrl),
  }
}

// ─── Two-step auth ─────────────────────────────────────────────────────────────

async function authenticate(creds: S1Creds): Promise<string> {
  const login = await s1Fetch(creds.baseUrl, {
    service: "login",
    username: creds.username,
    password: creds.password,
    appId: creds.appId,
  })
  if (!login.success) throw new Error(`S1 Login failed: ${login.error}`)

  // Fall back to first available org from login response when not configured
  const obj = login.objs?.[0] ?? {}
  const auth = await s1Fetch(creds.baseUrl, {
    service: "authenticate",
    clientID: login.clientID,
    COMPANY: creds.company || obj.COMPANY || "",
    BRANCH:  creds.branch  || obj.BRANCH  || "",
    MODULE:  creds.module  || obj.MODULE  || "",
    REFID:   creds.refId   || obj.REFID   || "",
  })
  if (!auth.success) throw new Error(`S1 Authenticate failed: ${auth.error}`)

  saveSession(creds.sessionKey, auth.clientID, creds.ttlMs)
  return auth.clientID
}

async function getClientId(creds: S1Creds): Promise<string> {
  return loadSession(creds.sessionKey) ?? authenticate(creds)
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function s1<T = unknown>(
  service: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const creds = await getCredentials()
  const clientID = await getClientId(creds)

  const data = await s1Fetch(creds.baseUrl, {
    service,
    clientID,
    appId: creds.appId,
    VERSION: "2",
    ...params,
  })

  // Session expired — re-auth once and retry
  if (!data.success && (data.errorcode === -101 || data.errorcode === -100)) {
    clearSession(creds.sessionKey)
    const newClientId = await authenticate(creds)
    return s1Fetch(creds.baseUrl, {
      service,
      clientID: newClientId,
      appId: creds.appId,
      VERSION: "2",
      ...params,
    })
  }

  return data as T
}

/** Returns active session token + appId + baseUrl for direct API calls. */
export async function s1Session(): Promise<{ clientId: string; appId: string; baseUrl: string }> {
  const creds = await getCredentials()
  const clientId = await getClientId(creds)
  return { clientId, appId: creds.appId, baseUrl: creds.baseUrl }
}

/** Force a fresh login (clears cached session). Use for connection tests. */
export async function s1Test(): Promise<{ ok: boolean; error?: string; companyinfo?: string }> {
  try {
    const creds = await getCredentials()
    clearSession(creds.sessionKey)
    await authenticate(creds)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
