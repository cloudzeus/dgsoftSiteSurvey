// Microsoft Graph API client using OAuth 2.0 client credentials flow.
// Used for tenant administration (listing users, etc.) — separate from the
// per-user OAuth flow handled by NextAuth's MicrosoftEntraID provider.

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

export interface GraphUser {
  id: string
  displayName: string | null
  givenName: string | null
  surname: string | null
  mail: string | null
  userPrincipalName: string | null
  jobTitle: string | null
  mobilePhone: string | null
  businessPhones: string[]
  officeLocation: string | null
  accountEnabled: boolean
}

interface TokenCache {
  accessToken: string
  expiresAt: number // epoch ms
}

let tokenCache: TokenCache | null = null

function readTenantConfig(): { tenantId: string; clientId: string; clientSecret: string } {
  // Accept multiple env var names. APPLICATION_ID is the existing variable in
  // this project for the Azure Application (client) ID. Note: CLIENT_SECRET_ID
  // is the secret's internal reference, NOT the application id — kept last.
  const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.AZURE_AD_TENANT_ID || process.env.TENANT_ID
  const clientId =
    process.env.MICROSOFT_CLIENT_ID ||
    process.env.AZURE_AD_CLIENT_ID ||
    process.env.APPLICATION_ID ||
    process.env.CLIENT_SECRET_ID
  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET ||
    process.env.AZURE_AD_CLIENT_SECRET ||
    process.env.CLIENT_SECRET_VALUE

  if (!tenantId || !clientId || !clientSecret) {
    const missing = [
      !tenantId && "MICROSOFT_TENANT_ID (or TENANT_ID)",
      !clientId && "MICROSOFT_CLIENT_ID (or APPLICATION_ID)",
      !clientSecret && "MICROSOFT_CLIENT_SECRET (or CLIENT_SECRET_VALUE)",
    ].filter(Boolean).join(", ")
    throw new Error(`Microsoft Graph config missing: ${missing}`)
  }

  return { tenantId, clientId, clientSecret }
}

async function getAppToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken
  }

  const { tenantId, clientId, clientSecret } = readTenantConfig()
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  })

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Microsoft token request failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

export async function listTenantUsers(): Promise<GraphUser[]> {
  const token = await getAppToken()
  const select = [
    "id", "displayName", "givenName", "surname", "mail",
    "userPrincipalName", "jobTitle", "mobilePhone", "businessPhones",
    "officeLocation", "accountEnabled",
  ].join(",")

  const all: GraphUser[] = []
  let url: string | null = `${GRAPH_BASE}/users?$select=${select}&$top=100`

  // Follow @odata.nextLink pagination
  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ConsistencyLevel: "eventual",
      },
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Graph /users failed (${res.status}): ${text.slice(0, 300)}`)
    }
    const data = (await res.json()) as { value: GraphUser[]; "@odata.nextLink"?: string }
    all.push(...data.value)
    url = data["@odata.nextLink"] ?? null
  }
  return all
}
