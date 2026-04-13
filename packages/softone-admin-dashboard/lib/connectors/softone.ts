import iconv from "iconv-lite"
import type { Connector, ConnectorRecord, DiscoveredField, DiscoveredObject, FetchOptions, SoftoneCredentials } from "./types"

// One session file per connection (keyed by baseUrl)
import fs from "fs"
import path from "path"

function sessionPath(key: string) {
  return path.join(process.cwd(), `.s1session_${key}.json`)
}

function loadSession(key: string): string | null {
  try {
    const s = JSON.parse(fs.readFileSync(sessionPath(key), "utf8"))
    if (s.expiresAt && Date.now() < s.expiresAt) return s.clientID
  } catch {}
  return null
}

function saveSession(key: string, clientID: string, ttlMs: number) {
  fs.writeFileSync(sessionPath(key), JSON.stringify({ clientID, expiresAt: Date.now() + ttlMs }))
}

async function s1Fetch(baseUrl: string, body: object): Promise<any> {
  const safeBody = { ...body as any, PASSWORD: (body as any).PASSWORD ? "***" : undefined }
  console.log("[Softone] →", baseUrl, JSON.stringify(safeBody))
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const buffer = await res.arrayBuffer()
  const decoded = JSON.parse(iconv.decode(Buffer.from(buffer), "win1253"))
  console.log("[Softone] ←", JSON.stringify(decoded))
  return decoded
}

export class SoftoneConnector implements Connector {
  private creds: SoftoneCredentials
  private baseUrl: string
  private tokenTtlMs: number

  constructor(creds: SoftoneCredentials) {
    this.creds = creds
    const rawUrl = (creds.baseUrl ?? (creds as any).serialNo ?? "") as string
    const base = String(rawUrl).replace(/\/+$/, "").replace(/\/s1services$/i, "")
    this.baseUrl = `${base}/s1services`
    this.tokenTtlMs = ((creds as any).sessionTtlHours ?? 8) * 60 * 60 * 1000
  }

  /** Stable key for the session file, derived from baseUrl */
  private get sessionKey(): string {
    const rawUrl = (this.creds.baseUrl ?? (this.creds as any).serialNo ?? "") as string
    return rawUrl.replace(/https?:\/\//, "").replace(/[^a-z0-9]/gi, "_").toLowerCase()
  }

  private async authenticate(): Promise<string> {
    const login = await s1Fetch(this.baseUrl, {
      SERVICE: "Login",
      USERNAME: this.creds.username,
      PASSWORD: this.creds.password,
      APPID: this.creds.appId,
      VERSION: "2",
    })
    if (!login.success) throw new Error(`Softone login failed: ${login.error}`)

    // Fall back to the first available org from the login response when creds don't specify
    const loginObj = login.objs?.[0] ?? {}
    const company = (this.creds as any).company || loginObj.COMPANY || ""
    const branch  = (this.creds as any).branch  || loginObj.BRANCH  || ""
    const module_ = this.creds.module            || loginObj.MODULE  || ""
    const refId   = this.creds.refId             || loginObj.REFID   || ""

    const auth = await s1Fetch(this.baseUrl, {
      service: "authenticate",
      clientID: login.clientID,
      COMPANY: company,
      BRANCH: branch,
      MODULE: module_,
      REFID: refId,
      VERSION: "2",
    })
    if (!auth.success) throw new Error(`Softone authenticate failed: ${auth.error}`)

    saveSession(this.sessionKey, auth.clientID, this.tokenTtlMs)
    return auth.clientID
  }

  private async getClientId(): Promise<string> {
    return loadSession(this.sessionKey) ?? this.authenticate()
  }

  private async call(service: string, params: Record<string, unknown> = {}): Promise<any> {
    const clientID = await this.getClientId()
    const data = await s1Fetch(this.baseUrl, { service, clientID, appId: this.creds.appId, VERSION: "2", ...params })

    if (!data.success && (data.errorcode === -101 || data.errorcode === -100)) {
      try { fs.rmSync(sessionPath(this.sessionKey), { force: true }) } catch {}
      const newClientId = await this.authenticate()
      return s1Fetch(this.baseUrl, { service, clientID: newClientId, appId: this.creds.appId, VERSION: "2", ...params })
    }
    return data
  }

  async testConnection(): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
    console.log("[Softone] testConnection creds →", { baseUrl: this.baseUrl, username: this.creds.username, appId: this.creds.appId, company: this.creds.company, branch: (this.creds as any).branch, module: this.creds.module, refId: this.creds.refId })
    try {
      const login = await s1Fetch(this.baseUrl, {
        SERVICE: "Login",
        USERNAME: this.creds.username,
        PASSWORD: this.creds.password,
        APPID: this.creds.appId,
        VERSION: "2",
      })
      if (!login.success) return { ok: false, error: `Login failed: ${login.error}`, raw: login }

      const loginObj = login.objs?.[0] ?? {}
      const auth = await s1Fetch(this.baseUrl, {
        service: "authenticate",
        clientID: login.clientID,
        COMPANY: (this.creds as any).company || loginObj.COMPANY || "",
        BRANCH:  (this.creds as any).branch  || loginObj.BRANCH  || "",
        MODULE:  this.creds.module            || loginObj.MODULE  || "",
        REFID:   this.creds.refId             || loginObj.REFID   || "",
        VERSION: "2",
      })
      if (!auth.success) return { ok: false, error: `Auth failed: ${auth.error}`, raw: auth }

      saveSession(this.sessionKey, auth.clientID, this.tokenTtlMs)
      return { ok: true, raw: auth }
    } catch (err) {
      console.error("[Softone] testConnection error →", err)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async discoverObjects(): Promise<DiscoveredObject[]> {
    const data = await this.call("getObjects")
    if (!data.success) throw new Error(data.error)
    // API returns "objects" key (not "objs")
    const list = data.objects ?? data.objs ?? []
    return list.map((o: any) => ({ name: o.name, label: o.caption ?? o.name, type: o.type }))
  }

  async discoverTables(objectName: string): Promise<DiscoveredObject[]> {
    const data = await this.call("getObjectTables", { OBJECT: objectName })
    // Many objects don't support sub-tables — return empty to trigger direct field discovery
    if (!data.success) return []
    const list = data.tables ?? data.objs ?? []
    return list.map((t: any) => ({ name: t.table ?? t.name, label: t.caption ?? t.table ?? t.name }))
  }

  async discoverFields(objectName: string, tableName?: string): Promise<{ fields: DiscoveredField[]; primaryKey?: string }> {
    const data = await this.call("getTableFields", { OBJECT: objectName, TABLE: tableName ?? objectName })
    if (!data.success) throw new Error(data.error)

    const fields: DiscoveredField[] = (data.fields ?? []).map((f: any) => ({
      name: f.name,
      label: f.caption ?? f.name,
      dataType: mapSoftoneType(f.type),
      isPrimaryKey: f.isKey === 1 || f.isKey === true,
      size: f.size,
      nullable: !f.required,
    }))

    const pkField = fields.find((f) => f.isPrimaryKey)
    return { fields, primaryKey: pkField?.name }
  }

  async fetchRecords(objectName: string, opts: FetchOptions = {}): Promise<{ records: ConnectorRecord[]; total: number }> {
    const { offset = 0, limit = 100, filter, tableName } = opts

    const browserInfo = await this.call("getBrowserInfo", {
      OBJECT: objectName,
      LIST: tableName ?? objectName,
      FILTERS: filter ?? "",
      PAGESIZE: limit,
    })
    if (!browserInfo.success) throw new Error(browserInfo.error)

    const reqId = browserInfo.reqID
    const total = browserInfo.totalcount ?? 0

    const browserData = await this.call("getBrowserData", {
      REQID: reqId,
      STARTINDEX: offset,
      PAGESIZE: limit,
    })
    if (!browserData.success) throw new Error(browserData.error)

    const rows: ConnectorRecord[] = (browserData.rows ?? []).map((row: Record<string, unknown>) => ({
      externalId: String(row[browserData.key ?? ""] ?? ""),
      data: row,
    }))

    return { records: rows, total }
  }

  async writeRecord(
    objectName: string,
    data: Record<string, unknown>,
    externalId?: string,
    method?: string,
  ): Promise<{ externalId: string }> {
    // If payloadTemplate was used, data is the fully-rendered payload — send directly as setData
    // method can override the service name (e.g. a custom Softone service)
    const service = method && !["setData", "POST", "PUT"].includes(method) ? method : "setData"

    // If data already has OBJECT/DATA keys (template mode), use as-is; otherwise wrap
    const isTemplated = "OBJECT" in data || "DATA" in data
    const payload: Record<string, unknown> = isTemplated
      ? data
      : { OBJECT: objectName, FORM: objectName, KEY: externalId ?? "", DATA: { [objectName]: [data] } }

    const result = await this.call(service, payload)
    if (!result.success) throw new Error(result.error)
    return { externalId: String(result.id ?? externalId ?? "") }
  }
}

function mapSoftoneType(type: string): DiscoveredField["dataType"] {
  switch ((type ?? "").toLowerCase()) {
    case "numeric":
    case "integer":
    case "decimal":
    case "float":
      return "numeric"
    case "datetime":
    case "date":
    case "time":
      return "datetime"
    case "logical":
    case "boolean":
      return "logical"
    default:
      return "character"
  }
}
