// Synology DSM Web API client — server-side only.
// Reads the active SYNOLOGY connection from the Connection table.
// Session SID is cached in-memory per host; expires on DSM error 106/119.
// Usage: import { synology } from "@/lib/synology"
//        const data = await synology("SYNO.FileStation.List", "list", { folderpath: "/home" })

import { db } from "@/lib/db"

// ─── In-memory session cache ───────────────────────────────────────────────────

const SESSION: Map<string, { sid: string; expiresAt: number }> = new Map()
const SESSION_TTL_MS = 23 * 60 * 60 * 1000   // DSM sessions last ~24 h

function loadSid(host: string): string | null {
  const s = SESSION.get(host)
  return s && Date.now() < s.expiresAt ? s.sid : null
}

function saveSid(host: string, sid: string) {
  SESSION.set(host, { sid, expiresAt: Date.now() + SESSION_TTL_MS })
}

function clearSid(host: string) {
  SESSION.delete(host)
}

// ─── Credentials from Connection table ────────────────────────────────────────

interface SynologyCreds {
  baseUrl: string   // e.g. https://192.168.1.100:5001
  account: string
  password: string
  session: string   // arbitrary session name, e.g. "FileStation"
}

async function getCredentials(): Promise<SynologyCreds> {
  const conn = await db.connection.findFirst({
    where: { type: "SYNOLOGY", isActive: true },
    orderBy: { createdAt: "asc" },
  })
  if (!conn) throw new Error("No active Synology connection. Configure one in Settings → Connections.")

  const c = conn.credentials as Record<string, any>
  const baseUrl = (c.baseUrl as string ?? "").replace(/\/+$/, "")

  return {
    baseUrl,
    account:  c.account  ?? c.username ?? "",
    password: c.password ?? "",
    session:  c.session  ?? "ClaudeApp",
  }
}

// ─── Low-level request ─────────────────────────────────────────────────────────

/** Build a DSM API URL and fire the request. Returns parsed JSON. */
async function dsmGet(
  baseUrl: string,
  api: string,
  method: string,
  version: number,
  params: Record<string, string | number | boolean> = {}
): Promise<any> {
  const url = new URL(`${baseUrl}/webapi/entry.cgi`)
  url.searchParams.set("api", api)
  url.searchParams.set("version", String(version))
  url.searchParams.set("method", method)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) throw new Error(`Synology HTTP ${res.status}`)
  return res.json()
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

const DSM_SESSION_ERROR_CODES = new Set([106, 119])   // timeout / expired

async function login(creds: SynologyCreds): Promise<string> {
  const data = await dsmGet(creds.baseUrl, "SYNO.API.Auth", "login", 3, {
    account:  creds.account,
    passwd:   creds.password,
    session:  creds.session,
    format:   "sid",
  })

  if (!data.success) {
    const code: number = data.error?.code ?? 0
    const msg = DSM_AUTH_ERRORS[code] ?? `DSM error ${code}`
    throw new Error(`Synology login failed: ${msg}`)
  }

  const sid: string = data.data.sid
  saveSid(creds.baseUrl, sid)
  return sid
}

async function getSid(creds: SynologyCreds): Promise<string> {
  return loadSid(creds.baseUrl) ?? login(creds)
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Call any Synology DSM API endpoint.
 *
 * @param api     - e.g. "SYNO.FileStation.List"
 * @param method  - e.g. "list"
 * @param params  - additional query params (no _sid, api, method, version needed)
 * @param version - API version (default 1)
 */
export async function synology<T = unknown>(
  api: string,
  method: string,
  params: Record<string, string | number | boolean> = {},
  version = 1
): Promise<T> {
  const creds = await getCredentials()
  const sid = await getSid(creds)

  const data = await dsmGet(creds.baseUrl, api, method, version, { ...params, _sid: sid })

  // Session expired — re-auth once and retry
  if (!data.success && DSM_SESSION_ERROR_CODES.has(data.error?.code)) {
    clearSid(creds.baseUrl)
    const newSid = await login(creds)
    return dsmGet(creds.baseUrl, api, method, version, { ...params, _sid: newSid }) as Promise<T>
  }

  return data as T
}

/** Test credentials without relying on cached session. */
export async function synologyTest(): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  try {
    const creds = await getCredentials()
    clearSid(creds.baseUrl)
    await login(creds)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── DSM error codes (SYNO.API.Auth) ──────────────────────────────────────────

const DSM_AUTH_ERRORS: Record<number, string> = {
  100: "Unknown error",
  101: "No parameter",
  102: "API does not exist",
  103: "Method does not exist",
  104: "API version not supported",
  105: "Insufficient user privilege",
  106: "Session timeout",
  107: "Session interrupted — duplicate login detected",
  400: "Invalid account or password",
  401: "Account disabled",
  402: "Permission denied (account may be blocked by IP)",
  403: "Two-factor authentication required",
  404: "Failed to validate 2FA code",
  406: "Enforce 2FA — enable it in DSM user settings",
  407: "Blocking login — too many failed attempts",
  408: "Password expired",
  409: "Password must be changed",
  410: "Account locked — contact DSM admin",
}
