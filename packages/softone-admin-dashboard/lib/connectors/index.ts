import type { Connector } from "./types"
import { SoftoneConnector } from "./softone"
import { ShopifyConnector } from "./shopify"
import { MagentoConnector } from "./magento"
import { AeedeConnector } from "./aeede"
import { VivaPaymentsConnector } from "./viva"

export * from "./types"

export function getConnector(connection: { type: string; credentials: unknown }): Connector {
  const creds = connection.credentials as Record<string, any>

  switch (connection.type) {
    case "SOFTONE":
      return new SoftoneConnector(creds as any)
    case "SHOPIFY":
      return new ShopifyConnector(creds as any)
    case "MAGENTO":
      return new MagentoConnector(creds as any)
    case "WOOCOMMERCE":
      return stubConnector("WooCommerce")

    case "OPENAI":
      return testableConnector("OpenAI", async () => {
        const base = creds.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1"
        const res = await fetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${creds.apiKey}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      })

    case "DEEPSEEK":
      return testableConnector("DeepSeek", async () => {
        const base = creds.baseUrl?.replace(/\/$/, "") || "https://api.deepseek.com"
        const res = await fetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${creds.apiKey}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      })

    case "MAILGUN":
      return testableConnector("Mailgun", async () => {
        const base = creds.endpoint?.replace(/\/$/, "") || "https://api.eu.mailgun.net"
        const auth = Buffer.from(`api:${creds.apiKey}`).toString("base64")
        const res = await fetch(`${base}/v3/domains/${creds.domain}`, {
          headers: { Authorization: `Basic ${auth}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      })

    case "BUNNY_CDN":
      return testableConnector("Bunny CDN", async () => {
        const host = creds.storageApiHost || "storage.bunnycdn.com"
        const res = await fetch(`https://${host}/${creds.storageZone}/`, {
          headers: { AccessKey: creds.accessKey },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      })

    case "CUSTOM_REST":
      return stubConnector("Custom REST")

    case "BRAVE_SEARCH":
      return testableConnector("Brave Search", async () => {
        const res = await fetch("https://api.search.brave.com/res/v1/web/search?q=test&count=1", {
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": creds.apiKey,
          },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      })

    case "AEEDE_VAT":
      return new AeedeConnector()

    case "GEOCODE_MAPS":
      return testableConnector("Geocode Maps", async () => {
        const key = creds.apiKey
        if (!key) throw new Error("Missing apiKey")
        const res = await fetch(`https://geocode.maps.co/search?q=Athens&api_key=${key}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error("Unexpected response format")
      })

    case "VIVA_PAYMENTS":
      return new VivaPaymentsConnector(creds as any)

    case "MILESIGHT":
      return testableConnector("Milesight IoT", async () => {
        const base = (creds.serverAddress ?? "https://eu-openapi.milesight.com").replace(/\/$/, "")
        if (!creds.clientId || !creds.clientSecret) throw new Error("Missing clientId or clientSecret")
        const res = await fetch(`${base}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        const data = await res.json()
        if (data.status !== "Success" || !data.data?.access_token) throw new Error(`Auth failed: ${data.status}`)
      })

    case "YUBOTO_SMS":
      return testableConnector("Yuboto SMS", async () => {
        if (!creds.apiKey) throw new Error("Missing apiKey")
        const res = await fetch("https://services.yuboto.com/omni/v1/UserBalance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${Buffer.from(creds.apiKey).toString("base64")}`,
          },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        const data = await res.json()
        if (data.ErrorCode !== 0) throw new Error(`Yuboto error: ${data.ErrorMessage || data.ErrorCode}`)
      })

    case "SYNOLOGY":
      return testableConnector("Synology DSM", async () => {
        const baseUrl = (creds.baseUrl as string ?? "").replace(/\/+$/, "")
        if (!baseUrl) throw new Error("Missing baseUrl")
        if (!creds.account) throw new Error("Missing account")
        if (!creds.password) throw new Error("Missing password")
        const url = new URL(`${baseUrl}/webapi/entry.cgi`)
        url.searchParams.set("api", "SYNO.API.Auth")
        url.searchParams.set("version", "3")
        url.searchParams.set("method", "login")
        url.searchParams.set("account", creds.account)
        url.searchParams.set("passwd", creds.password)
        url.searchParams.set("session", creds.session ?? "Test")
        url.searchParams.set("format", "sid")
        const res = await fetch(url.toString(), { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!data.success) {
          const code: number = data.error?.code ?? 0
          const DSM_ERRORS: Record<number, string> = {
            400: "Invalid account or password",
            401: "Account disabled",
            402: "Permission denied",
            403: "2FA required",
            404: "2FA code invalid",
            406: "Enforce 2FA enabled",
            107: "Session interrupted",
          }
          throw new Error(DSM_ERRORS[code] ?? `DSM error ${code}`)
        }
      })

    default:
      // All dynamic / user-defined types
      return stubConnector(connection.type)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stubConnector(name: string): Connector {
  return {
    async testConnection() { return { ok: false, error: `${name} connector not yet implemented` } },
    async discoverObjects() { return [] },
    async discoverFields() { return { fields: [] } },
    async fetchRecords() { return { records: [], total: 0 } },
    async writeRecord() { throw new Error(`${name} write not implemented`) },
  }
}

/** Connector that can test credentials but has no pipeline integration */
function testableConnector(name: string, probe: () => Promise<void>): Connector {
  return {
    async testConnection() {
      try {
        await probe()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
    async discoverObjects() { return [] },
    async discoverFields() { return { fields: [] } },
    async fetchRecords() { return { records: [], total: 0 } },
    async writeRecord() { throw new Error(`${name} write not implemented`) },
  }
}
