// Softone ERP API Client
// Two-step auth: login → authenticate
// Token cached for 1 hour (not per-request)
// All responses decoded from Windows-1253

import "dotenv/config"
import fs from "fs"
import path from "path"
import { decodeS1Response } from "./encoding"
import type {
  S1Credentials,
  S1LoginResponse,
  S1Response,
  S1ObjectTable,
  S1ObjectField,
  S1Record,
} from "./types"

const SESSION_FILE = path.join(process.cwd(), ".s1session.json")
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry

interface CachedSession {
  clientID: string
  expiresAt: number // epoch ms
  companyinfo?: string
}

function loadSession(): { clientID: string; companyinfo?: string } | null {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8")
    const session = JSON.parse(raw) as CachedSession
    const refreshAt = session.expiresAt - TOKEN_REFRESH_BUFFER_MS
    if (Date.now() < refreshAt) return {
      clientID: session.clientID,
      ...(session.companyinfo !== undefined ? { companyinfo: session.companyinfo } : {}),
    }
  } catch {
    // No file or invalid JSON — re-auth
  }
  return null
}

function saveSession(clientID: string, companyinfo: string | undefined, ttlMs: number): void {
  const session: CachedSession = {
    clientID,
    expiresAt: Date.now() + ttlMs,
    ...(companyinfo !== undefined ? { companyinfo } : {}),
  }
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session))
}

export function getStoredCompanyInfo(): string | null {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8")
    const session = JSON.parse(raw) as CachedSession
    return session.companyinfo ?? null
  } catch {
    return null
  }
}

export function clearSession(): void {
  fs.rmSync(SESSION_FILE, { force: true })
}

export class SoftoneAPIClient {
  private readonly baseUrl: string
  private readonly credentials: S1Credentials
  private readonly tokenTtlMs: number

  constructor(credentials: S1Credentials) {
    this.credentials = credentials
    this.baseUrl = credentials.baseUrl
    this.tokenTtlMs = (credentials.sessionTtlHours ?? 8) * 60 * 60 * 1000
  }

  // ─── Low-level fetch ───────────────────────────────────────────────────────

  private async s1Fetch<T = unknown>(body: object): Promise<T> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    return decodeS1Response(res) as Promise<T>
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Two-step auth per https://www.softone.gr/ws/#login
   *
   * Step 1 — login: lowercase service, lowercase field names, no VERSION
   *   → returns temp clientID + objs[] (available company/branch options)
   *
   * Step 2 — authenticate: temp clientID + COMPANY/BRANCH/MODULE/REFID
   *   → returns the final session clientID
   *
   * If COMPANY/BRANCH/MODULE/REFID are not configured in env, the first
   * option from the login objs[] array is used automatically.
   */
  private async authenticate(): Promise<string> {
    const { username, password, appId, company, branch, module, refId } =
      this.credentials

    // Step 1: login
    const login = await this.s1Fetch<S1LoginResponse>({
      service: "login",
      username,
      password,
      appId,
    })

    if (!login.success) throw new Error(`S1 Login failed: ${login.error}`)

    // Resolve company params — use env values, fall back to first available option
    const firstObj = login.objs?.[0]
    const resolvedCompany = company || firstObj?.COMPANY || ""
    const resolvedBranch  = branch  || firstObj?.BRANCH  || ""
    const resolvedModule  = module  || firstObj?.MODULE  || ""
    const resolvedRefId   = refId   || firstObj?.REFID   || ""

    // Step 2: authenticate
    const auth = await this.s1Fetch<S1LoginResponse>({
      service: "authenticate",
      clientID: login.clientID,
      COMPANY: resolvedCompany,
      BRANCH: resolvedBranch,
      MODULE: resolvedModule,
      REFID: resolvedRefId,
    })

    if (!auth.success) throw new Error(`S1 Auth failed: ${auth.error}`)

    saveSession(auth.clientID, auth.companyinfo ?? login.companyinfo, this.tokenTtlMs)
    return auth.clientID
  }

  private async getClientId(): Promise<string> {
    const cached = loadSession()
    return cached ? cached.clientID : this.authenticate()
  }

  /** Returns the companyinfo stored from the last successful login */
  getCompanyInfo(): string | null {
    return getStoredCompanyInfo()
  }

  /**
   * Test the connection by performing a fresh login.
   * Returns companyinfo on success, throws on failure.
   */
  async testConnection(): Promise<{ companyinfo: string | null }> {
    clearSession()
    await this.authenticate()
    return { companyinfo: this.getCompanyInfo() }
  }

  // ─── Core service call ─────────────────────────────────────────────────────

  async call<T = unknown>(
    service: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const clientID = await this.getClientId()
    const data = await this.s1Fetch<S1Response<T>>({
      service,
      clientID,
      appId: this.credentials.appId,
      VERSION: "2",
      ...params,
    })

    // Session expired — re-auth once
    if (
      !data.success &&
      (data.errorcode === -101 || data.errorcode === -100)
    ) {
      clearSession()
      const newClientId = await this.authenticate()
      return this.s1Fetch<T>({
        service,
        clientID: newClientId,
        appId: this.credentials.appId,
        VERSION: "2",
        ...params,
      })
    }

    return data as unknown as T
  }

  // ─── Discovery ─────────────────────────────────────────────────────────────

  /** List all business objects available to the current user */
  async getObjects(): Promise<{ name: string; type: string; caption: string }[]> {
    // Response: { success, count, objects: [{name, type, caption}] }
    const res = await this.call<any>("getObjects")
    return (res.objects ?? []) as { name: string; type: string; caption: string }[]
  }

  /** Get tables for a given object */
  async getObjectTables(objectName: string): Promise<string[]> {
    const clientID = await this.getClientId()
    // No VERSION — discovery services don't require it
    const res = await this.s1Fetch<any>({
      service: "getObjectTables",
      clientID,
      appId: this.credentials.appId,
      OBJECT: objectName,
    })
    console.log("[getObjectTables] raw:", JSON.stringify(res))
    if (!res.success) throw new Error(`getObjectTables failed: ${res.error ?? JSON.stringify(res)}`)
    const rows: any[] = res.rows ?? res.objs ?? res.tables ?? []
    if (rows.length === 0) return []
    if (typeof rows[0] === "string") return rows as string[]
    return rows.map((r: any) =>
      r.TABLE ?? r.table ?? r.TABLENAME ?? r.name ?? String(Object.values(r)[0])
    )
  }

  /** Get field definitions for a specific table */
  async getTableFields(
    objectName: string,
    tableName: string
  ): Promise<S1ObjectField[]> {
    const clientID = await this.getClientId()
    const res = await this.s1Fetch<any>({
      service: "getTableFields",
      clientID,
      appId: this.credentials.appId,
      OBJECT: objectName,
      TABLE: tableName,
    })
    if (!res.success) throw new Error(`getTableFields failed: ${res.error ?? JSON.stringify(res)}`)
    const rows: any[] = res.rows ?? res.fields ?? res.objs ?? res.data ?? []
    console.log(`[getTableFields] key found: rows=${res.rows?.length} fields=${res.fields?.length} objs=${res.objs?.length} → ${rows.length} items`)
    return rows
  }

  // ─── Data fetching ─────────────────────────────────────────────────────────

  /**
   * Fetch records from a Softone table in batches.
   * Uses getBrowserInfo → getBrowserData pattern for large datasets.
   */
  async fetchRecords(
    objectName: string,
    tableName: string,
    options: {
      batchSize?: number
      offset?: number
      filter?: string
    } = {}
  ): Promise<{ records: S1Record[]; totalCount: number }> {
    const { batchSize = 100, offset = 0, filter } = options

    // Step 1: Get reqID
    // Try with LIST first; if that fails or returns no reqID, retry with OBJECT only
    const params: Record<string, unknown> = {
      OBJECT: objectName,
      LIST: tableName,
      ...(filter ? { FILTERS: filter } : {}),
    }

    let browserInfo = await this.call<S1Response>("getBrowserInfo", params)

    // Surface actual Softone errors instead of the generic "no reqID" message
    if (!(browserInfo as unknown as S1Response).success) {
      const s1err = (browserInfo as unknown as S1Response).error
      throw new Error(
        `getBrowserInfo failed for ${objectName}/${tableName}: ${s1err ?? JSON.stringify(browserInfo)}`
      )
    }

    let reqID = (browserInfo as unknown as { reqID: string }).reqID

    // Some objects don't support the LIST parameter — retry with OBJECT only
    if (!reqID && tableName !== objectName) {
      const fallback = await this.call<S1Response>("getBrowserInfo", {
        OBJECT: objectName,
        ...(filter ? { FILTERS: filter } : {}),
      })
      if ((fallback as unknown as S1Response).success) {
        browserInfo = fallback
        reqID = (fallback as unknown as { reqID: string }).reqID
      }
    }

    const totalcount =
      (browserInfo as unknown as { totalcount: number }).totalcount ?? 0

    if (!reqID) {
      throw new Error(`getBrowserInfo returned no reqID for ${objectName}/${tableName}`)
    }

    // Step 2: Get paginated data
    const browserData = await this.call<S1Response<S1Record>>("getBrowserData", {
      reqID,
      startindex: offset,
      pagesize: batchSize,
    })

    // reqID expired — re-run
    if (
      !browserData.success &&
      ((browserData as unknown as S1Response).errorcode === 13 ||
        (browserData as unknown as S1Response).errorcode === 213)
    ) {
      return this.fetchRecords(objectName, tableName, options)
    }

    return {
      records:
        (browserData as unknown as S1Response<S1Record>).rows ?? [],
      totalCount: totalcount,
    }
  }

  /** Fetch a single record by object + key */
  async getRecord(objectName: string, key: string | number): Promise<S1Record | null> {
    const res = await this.call<any>("getData", {
      OBJECT: objectName,
      FORM: "",
      KEY: typeof key === "string" ? Number(key) : key,
    })
    // Response: { success, readOnly, data: { [OBJECT]: [{ ...fields }] } }
    const rows: S1Record[] = res?.data?.[objectName] ?? []
    return rows[0] ?? null
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

// Always read env vars fresh — avoids stale singleton after .env changes in dev
export function getSoftoneClient(): SoftoneAPIClient {
  return new SoftoneAPIClient({
    baseUrl: `${process.env.SOFTONE_URL}/s1services`,
    username: process.env.SOFTONE_USERNAME!,
    password: process.env.SOFTONE_PASSWORD!,
    appId: process.env.SOFTONE_APP_ID!,
    company: process.env.SOFTONE_COMPANY ?? "",
    branch: process.env.SOFTONE_BRANCH ?? "",
    module: process.env.SOFTONE_MODULE ?? "",
    refId: process.env.SOFTONE_REFID ?? "",
  })
}
