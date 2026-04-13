// Connector abstraction — every external system implements this interface.

export interface DiscoveredObject {
  name: string
  label?: string
  type?: string
}

export interface DiscoveredField {
  name: string
  label?: string
  dataType: "character" | "numeric" | "datetime" | "logical"
  isPrimaryKey?: boolean
  size?: number
  nullable?: boolean
}

export interface ConnectorRecord {
  externalId: string
  data: Record<string, unknown>
}

export interface FetchOptions {
  offset?: number
  limit?: number
  filter?: string
  tableName?: string
}

export interface Connector {
  // Test credentials — raw is the full API response body (for debugging)
  testConnection(): Promise<{ ok: boolean; error?: string; raw?: unknown }>

  // Schema discovery
  discoverObjects(): Promise<DiscoveredObject[]>
  discoverTables?(objectName: string): Promise<DiscoveredObject[]>
  discoverFields(objectName: string, tableName?: string): Promise<{ fields: DiscoveredField[]; primaryKey?: string }>

  // Data operations
  fetchRecords(objectName: string, opts: FetchOptions): Promise<{ records: ConnectorRecord[]; total: number }>
  writeRecord(objectName: string, data: Record<string, unknown>, externalId?: string, method?: string): Promise<{ externalId: string }>
}

// Credential shapes per connection type
export interface SoftoneCredentials {
  baseUrl: string
  username: string
  password: string
  appId: string
  company: string
  branch: string
  module: string
  refId: string
}

export interface ShopifyCredentials {
  shopDomain: string     // mystore.myshopify.com
  accessToken: string
  webhookSecret?: string
}

export interface MagentoStoreView {
  code: string    // Magento store view code, e.g. "el", "en", "de"
  locale: string  // locale string for reference, e.g. "el_GR", "en_US"
  label?: string  // human label, e.g. "Greek", "English"
}

export interface MagentoCredentials {
  baseUrl: string
  accessToken: string
  adminStoreView?: string      // store view used for writes to all-scope data, default "all"
  brandAttributeCode?: string  // Magento attribute code used for brands, default "manufacturer"
  storeViews?: MagentoStoreView[]  // locale store views for multilingual content
}

export interface WooCommerceCredentials {
  baseUrl: string
  consumerKey: string
  consumerSecret: string
}

export interface CustomRestCredentials {
  baseUrl: string
  authType: "none" | "apikey" | "bearer" | "basic"
  apiKey?: string
  apiKeyHeader?: string
  bearerToken?: string
  username?: string
  password?: string
}

export interface YubotoCredentials {
  /** Base64-encoded API key from Yuboto Developers > API Key */
  apiKey: string
  /** Sender name (max 11 alphanumeric chars) or phone number */
  sender: string
}

export interface SynologyCredentials {
  /** Full base URL including protocol and port, e.g. https://192.168.1.100:5001 */
  baseUrl: string
  account: string
  password: string
  /** DSM session name (arbitrary label), e.g. "FileStation" */
  session?: string
}
