import type { Connector, ConnectorRecord, DiscoveredField, DiscoveredObject, FetchOptions } from "./types"

export interface VivaCredentials {
  merchantId: string
  apiKey: string
  environment?: "production" | "demo"
}

// ─── Schema ────────────────────────────────────────────────────────────────────

const TRANSACTION_FIELDS: DiscoveredField[] = [
  { name: "transactionId",    label: "Transaction ID",    dataType: "character", isPrimaryKey: true },
  { name: "orderCode",        label: "Order Code",        dataType: "character" },
  { name: "amount",           label: "Amount",            dataType: "numeric"   },
  { name: "statusId",         label: "Status",            dataType: "character" },
  { name: "currencyCode",     label: "Currency",          dataType: "character" },
  { name: "email",            label: "Email",             dataType: "character" },
  { name: "fullName",         label: "Full Name",         dataType: "character" },
  { name: "insDate",          label: "Created At",        dataType: "datetime"  },
  { name: "cardNumber",       label: "Card (masked)",     dataType: "character" },
  { name: "cardTypeId",       label: "Card Type",         dataType: "numeric"   },
  { name: "totalInstallments",label: "Installments",      dataType: "numeric"   },
  { name: "sourceCode",       label: "Source Code",       dataType: "character" },
]

const ORDER_FIELDS: DiscoveredField[] = [
  { name: "orderCode",    label: "Order Code",    dataType: "character", isPrimaryKey: true },
  { name: "amount",       label: "Amount (€)",    dataType: "numeric"   },
  { name: "currencyCode", label: "Currency",      dataType: "character" },
  { name: "customerTrns", label: "Description",   dataType: "character" },
  { name: "email",        label: "Email",         dataType: "character" },
  { name: "fullName",     label: "Full Name",     dataType: "character" },
  { name: "requestLang",  label: "Language",      dataType: "character" },
  { name: "maxInstallments", label: "Max Installments", dataType: "numeric" },
  { name: "disableExactAmount", label: "Disable Exact Amount", dataType: "logical" },
]

const OBJECTS: DiscoveredObject[] = [
  { name: "transactions", label: "Transactions", type: "list"   },
  { name: "orders",       label: "Payment Orders", type: "list" },
]

// ─── Connector ─────────────────────────────────────────────────────────────────

export class VivaPaymentsConnector implements Connector {
  private base: string
  private authHeader: string

  constructor(creds: VivaCredentials) {
    const isDemo = creds.environment === "demo"
    this.base = isDemo ? "https://demo.vivapayments.com" : "https://www.vivapayments.com"
    this.authHeader = "Basic " + Buffer.from(`${creds.merchantId}:${creds.apiKey}`).toString("base64")
  }

  private async get(path: string) {
    const res = await fetch(`${this.base}${path}`, {
      headers: { Authorization: this.authHeader },
      cache: "no-store",
    })
    return res
  }

  async testConnection() {
    try {
      if (!this.authHeader.slice(6)) throw new Error("Missing merchantId or apiKey")
      // Fetch one transaction — a 200 or 204 means credentials are valid
      const res = await this.get("/api/transactions?$top=1")
      if (res.status === 401) throw new Error("Unauthorized — check merchantId and apiKey")
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const raw = await res.json()
      return { ok: true, raw }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async discoverObjects(): Promise<DiscoveredObject[]> {
    return OBJECTS
  }

  async discoverFields(objectName: string): Promise<{ fields: DiscoveredField[]; primaryKey?: string }> {
    if (objectName === "orders") return { fields: ORDER_FIELDS, primaryKey: "orderCode" }
    return { fields: TRANSACTION_FIELDS, primaryKey: "transactionId" }
  }

  async fetchRecords(objectName: string, opts: FetchOptions): Promise<{ records: ConnectorRecord[]; total: number }> {
    const top = opts.limit ?? 50
    const skip = opts.offset ?? 0

    if (objectName === "orders") {
      // Orders endpoint requires an orderCode — not a list endpoint in the classic API
      if (opts.filter) {
        const match = opts.filter.match(/orderCode[=:](\d+)/)
        if (match) {
          const res = await this.get(`/api/orders/${match[1]}`)
          if (!res.ok) return { records: [], total: 0 }
          const data = await res.json()
          return {
            records: [{ externalId: String(data.orderCode), data }],
            total: 1,
          }
        }
      }
      return { records: [], total: 0 }
    }

    // transactions
    const params = new URLSearchParams({ $top: String(top), $skip: String(skip) })
    if (opts.filter) params.set("$filter", opts.filter)
    const res = await this.get(`/api/transactions?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const data = await res.json()

    const rows: ConnectorRecord[] = (data.Transactions ?? []).map((t: any) => ({
      externalId: t.TransactionId,
      data: {
        transactionId:     t.TransactionId,
        orderCode:         t.OrderCode,
        amount:            t.Amount / 100,
        statusId:          t.StatusId,
        currencyCode:      t.CurrencyCode,
        email:             t.Email,
        fullName:          t.FullName,
        insDate:           t.InsDate,
        cardNumber:        t.CardNumber,
        cardTypeId:        t.CardTypeId,
        totalInstallments: t.TotalInstallments,
        sourceCode:        t.SourceCode,
      },
    }))

    return { records: rows, total: data.Total ?? rows.length }
  }

  async writeRecord(
    objectName: string,
    data: Record<string, unknown>,
  ): Promise<{ externalId: string }> {
    if (objectName !== "orders") throw new Error("Viva Payments: only 'orders' supports writeRecord")

    const res = await fetch(`${this.base}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount:             Math.round(Number(data.amount ?? 0) * 100), // cents
        customerTrns:       data.customerTrns ?? "",
        customer: {
          email:    data.email ?? "",
          fullName: data.fullName ?? "",
          phone:    data.phone ?? "",
          countryCode: data.countryCode ?? "GR",
        },
        paymentTimeout:     data.paymentTimeout ?? 86400,
        preauth:            data.preauth ?? false,
        allowRecurring:     data.allowRecurring ?? false,
        maxInstallments:    data.maxInstallments ?? 0,
        disableExactAmount: data.disableExactAmount ?? false,
        requestLang:        data.requestLang ?? "el-GR",
        currencyCode:       data.currencyCode ?? 826, // EUR = 826
      }),
      cache: "no-store",
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const result = await res.json()
    return { externalId: String(result.OrderCode) }
  }
}
