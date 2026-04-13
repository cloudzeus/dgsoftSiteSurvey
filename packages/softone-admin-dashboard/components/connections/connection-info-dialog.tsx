"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Data model ────────────────────────────────────────────────────────────────

interface MethodParam {
  name: string
  type: string
  description: string
  optional?: boolean
}

interface Method {
  name: string
  signature: string
  description: string
  params?: MethodParam[]
  returns?: string
  badge?: "server" | "pipeline" | "util"
}

interface MethodGroup {
  title: string
  methods: Method[]
}

interface ConnectorInfo {
  description: string
  importPath: string
  docs?: string
  groups: MethodGroup[]
}

// ─── Per-type definitions ──────────────────────────────────────────────────────

const CONNECTOR_INFO: Record<string, ConnectorInfo> = {
  SOFTONE: {
    description: "Softone ERP web services client. Handles two-step auth, session caching, and Windows-1253 decoding automatically.",
    importPath: '@/lib/s1',
    docs: "https://www.softone.gr/ws",
    groups: [
      {
        title: "Core helper",
        methods: [
          {
            name: "s1",
            signature: "s1(service, params?): Promise<any>",
            description: "Executes any Softone web service. Automatically handles session auth, re-auth on expiry, and response decoding.",
            params: [
              { name: "service", type: "string", description: "Service name, e.g. 'getData', 'setData', 'GetTable'" },
              { name: "params", type: "Record<string, unknown>", description: "Service-specific parameters merged into the request body.", optional: true },
            ],
            returns: "Decoded JSON response from Softone",
            badge: "server",
          },
        ],
      },
      {
        title: "Data operations",
        methods: [
          { name: "getData", signature: 's1("getData", { OBJECT, KEY })', description: "Fetch a single record by object name and primary key.", badge: "server" },
          { name: "setData", signature: 's1("setData", { OBJECT, data })', description: "Insert or update a record. Omit KEY to insert; include KEY to update.", badge: "server" },
          { name: "delData", signature: 's1("delData", { OBJECT, KEY })', description: "Delete a record by object name and primary key.", badge: "server" },
          { name: "calculate", signature: 's1("calculate", { OBJECT, data })', description: "Run ERP calculation logic on a record without saving.", badge: "server" },
        ],
      },
      {
        title: "Browse & query",
        methods: [
          { name: "getBrowserInfo", signature: 's1("getBrowserInfo", { OBJECT, LIST, FILTERS? })', description: "Execute a browser query and receive a reqID for pagination.", badge: "server" },
          { name: "getBrowserData", signature: 's1("getBrowserData", { reqID, START, LIMIT })', description: "Fetch a page of results using a reqID from getBrowserInfo.", badge: "server" },
          { name: "GetTable", signature: 's1("GetTable", { TABLE, FIELDS, FILTER? })', description: "Direct table query — returns rows matching FILTER.", badge: "server" },
          { name: "SqlData", signature: 's1("SqlData", { NAME, params? })', description: "Execute a named SQL script defined in the ERP.", badge: "server" },
        ],
      },
      {
        title: "Selectors & schema",
        methods: [
          { name: "getSelectorData", signature: 's1("getSelectorData", { SELECTOR, reqID? })', description: "Fetch dropdown/selector option values.", badge: "server" },
          { name: "selectorFields", signature: 's1("selectorFields", { TABLE, KEY })', description: "Get field metadata for a selector by table and key.", badge: "server" },
          { name: "getObjects", signature: 's1("getObjects")', description: "List all available business objects.", badge: "server" },
          { name: "getObjectTables", signature: 's1("getObjectTables", { OBJECT })', description: "List sub-tables within a business object.", badge: "server" },
          { name: "getTableFields", signature: 's1("getTableFields", { TABLE })', description: "Fetch field definitions and metadata for a table.", badge: "server" },
          { name: "getFormDesign", signature: 's1("getFormDesign", { OBJECT, FORM? })', description: "Retrieve form layout and field structure.", badge: "server" },
        ],
      },
      {
        title: "Reports & invoicing",
        methods: [
          { name: "getReportInfo", signature: 's1("getReportInfo", { REPORT, params? })', description: "Execute a report and get a reqID.", badge: "server" },
          { name: "getReportData", signature: 's1("getReportData", { reqID, PAGE })', description: "Get a page of the rendered HTML report.", badge: "server" },
          { name: "eInvoice", signature: 's1("eInvoice", { OBJECT, KEY })', description: "Submit a document to AADE for e-invoicing.", badge: "server" },
        ],
      },
      {
        title: "System & auth",
        methods: [
          { name: "getSystemParams", signature: 's1("getSystemParams")', description: "Read ERP system-level parameters.", badge: "server" },
          { name: "getWebMenu", signature: 's1("getWebMenu")', description: "Retrieve the menu structure for the authenticated user.", badge: "server" },
          { name: "changePassword", signature: 's1("changePassword", { OLDPASSWORD, NEWPASSWORD })', description: "Change the authenticated user's password.", badge: "server" },
        ],
      },
    ],
  },

  SHOPIFY: {
    description: "Shopify Admin REST API connector. Handles authentication and record sync for the pipeline engine.",
    importPath: "@/lib/connectors",
    docs: "https://shopify.dev/docs/api/admin-rest",
    groups: [
      {
        title: "Pipeline connector",
        methods: [
          { name: "testConnection", signature: "connector.testConnection()", description: "Verifies the access token against the Shopify Admin API.", returns: "{ ok, error? }", badge: "pipeline" },
          { name: "discoverObjects", signature: "connector.discoverObjects()", description: "Returns the list of available Shopify resources (orders, products, customers, etc.).", badge: "pipeline" },
          { name: "discoverFields", signature: "connector.discoverFields(objectName)", description: "Returns field metadata for a given Shopify resource.", badge: "pipeline" },
          { name: "fetchRecords", signature: "connector.fetchRecords(objectName, opts)", description: "Paginated fetch of records from a Shopify resource.", badge: "pipeline" },
          { name: "writeRecord", signature: "connector.writeRecord(objectName, data, externalId?)", description: "Creates or updates a record in Shopify. Omit externalId to create.", badge: "pipeline" },
        ],
      },
      {
        title: "Available resources",
        methods: [
          { name: "orders", signature: "GET /admin/api/orders.json", description: "Sales orders with line items, shipping, fulfillments." },
          { name: "products", signature: "GET /admin/api/products.json", description: "Products with variants, images, metafields." },
          { name: "customers", signature: "GET /admin/api/customers.json", description: "Customers with addresses and order history." },
          { name: "inventory_items", signature: "GET /admin/api/inventory_items.json", description: "Inventory items and quantity levels across locations." },
          { name: "collections", signature: "GET /admin/api/custom_collections.json", description: "Manual and smart product collections." },
          { name: "fulfillments", signature: "POST /admin/api/orders/{id}/fulfillments.json", description: "Create and manage order fulfillments." },
        ],
      },
    ],
  },

  MAGENTO: {
    description: "Magento 2 REST API connector with multi-store-view support. Supports schema discovery and full pipeline sync.",
    importPath: "@/lib/connectors",
    docs: "https://developer.adobe.com/commerce/webapi/rest",
    groups: [
      {
        title: "Pipeline connector",
        methods: [
          { name: "testConnection", signature: "connector.testConnection()", description: "Validates the admin token against the Magento REST API.", badge: "pipeline" },
          { name: "discoverObjects", signature: "connector.discoverObjects()", description: "Returns available Magento resources.", badge: "pipeline" },
          { name: "discoverFields", signature: "connector.discoverFields(objectName)", description: "Returns field definitions for the given resource.", badge: "pipeline" },
          { name: "fetchRecords", signature: "connector.fetchRecords(objectName, opts)", description: "Paginated fetch using Magento searchCriteria.", badge: "pipeline" },
          { name: "writeRecord", signature: "connector.writeRecord(objectName, data, externalId?)", description: "Create or update a Magento resource via REST.", badge: "pipeline" },
        ],
      },
      {
        title: "Available resources",
        methods: [
          { name: "products", signature: "GET /rest/{storeView}/V1/products", description: "Catalog products with attributes, images, and prices." },
          { name: "orders", signature: "GET /rest/V1/orders", description: "Sales orders with items, totals, and status." },
          { name: "customers", signature: "GET /rest/V1/customers/search", description: "Customers with addresses." },
          { name: "categories", signature: "GET /rest/V1/categories", description: "Category tree." },
          { name: "inventory", signature: "GET /rest/V1/inventory/source-items", description: "Inventory per source and SKU." },
          { name: "configurable", signature: "GET /rest/V1/configurable-products/{sku}/children", description: "Configurable product children." },
        ],
      },
    ],
  },

  WOOCOMMERCE: {
    description: "WooCommerce REST API v3 connector. Pipeline integration is in progress; test connection is available.",
    importPath: "@/lib/connectors",
    docs: "https://woocommerce.github.io/woocommerce-rest-api-docs",
    groups: [
      {
        title: "Available resources",
        methods: [
          { name: "orders", signature: "GET /wp-json/wc/v3/orders", description: "Orders with line items, shipping, billing, and status." },
          { name: "products", signature: "GET /wp-json/wc/v3/products", description: "Products with variations, attributes, and images." },
          { name: "customers", signature: "GET /wp-json/wc/v3/customers", description: "Customers with billing/shipping addresses." },
          { name: "product_categories", signature: "GET /wp-json/wc/v3/products/categories", description: "Product category hierarchy." },
          { name: "reports", signature: "GET /wp-json/wc/v3/reports", description: "Sales reports and statistics." },
          { name: "settings", signature: "GET /wp-json/wc/v3/settings", description: "Store settings grouped by section." },
        ],
      },
    ],
  },

  OPENAI: {
    description: "OpenAI API connection. Use your stored API key in any server action or route handler.",
    importPath: "openai",
    docs: "https://platform.openai.com/docs/api-reference",
    groups: [
      {
        title: "Usage pattern",
        methods: [
          {
            name: "init",
            signature: 'new OpenAI({ apiKey: creds.apiKey })',
            description: "Instantiate the SDK with the stored API key from the connection credentials.",
            badge: "server",
          },
        ],
      },
      {
        title: "Core endpoints",
        methods: [
          { name: "chat.completions", signature: "openai.chat.completions.create({ model, messages })", description: "Generate chat responses. Supports streaming via stream: true.", badge: "server" },
          { name: "embeddings", signature: "openai.embeddings.create({ model, input })", description: "Generate vector embeddings for text.", badge: "server" },
          { name: "images.generate", signature: "openai.images.generate({ model, prompt, n, size })", description: "Generate images with DALL·E 3.", badge: "server" },
          { name: "audio.transcriptions", signature: "openai.audio.transcriptions.create({ model, file })", description: "Transcribe audio files with Whisper.", badge: "server" },
          { name: "files", signature: "openai.files.create({ file, purpose })", description: "Upload files for fine-tuning or batch processing.", badge: "server" },
        ],
      },
    ],
  },

  DEEPSEEK: {
    description: "DeepSeek API connection — OpenAI-compatible interface. Use with the OpenAI SDK pointed at the DeepSeek base URL.",
    importPath: "openai",
    docs: "https://api-docs.deepseek.com",
    groups: [
      {
        title: "Usage pattern",
        methods: [
          {
            name: "init",
            signature: 'new OpenAI({ apiKey: creds.apiKey, baseURL: "https://api.deepseek.com" })',
            description: "DeepSeek is OpenAI-API-compatible. Use the OpenAI SDK with the DeepSeek base URL.",
            badge: "server",
          },
        ],
      },
      {
        title: "Core endpoints",
        methods: [
          { name: "chat", signature: 'openai.chat.completions.create({ model: "deepseek-chat", messages })', description: "DeepSeek-V3 chat completions. Fast and cost-efficient for most tasks.", badge: "server" },
          { name: "reasoner", signature: 'openai.chat.completions.create({ model: "deepseek-reasoner", messages })', description: "DeepSeek-R1 — chain-of-thought reasoning model for complex problems.", badge: "server" },
          { name: "fim", signature: 'openai.completions.create({ model: "deepseek-chat", prompt, suffix })', description: "Fill-in-the-middle completions for code generation.", badge: "server" },
        ],
      },
    ],
  },

  MAILGUN: {
    description: "Mailgun transactional email API. Send messages, manage templates, and track delivery via the lib/mail.ts helper.",
    importPath: "@/lib/mail",
    docs: "https://documentation.mailgun.com/docs/mailgun",
    groups: [
      {
        title: "Helper functions",
        methods: [
          {
            name: "sendMail",
            signature: "sendMail({ to, subject, html, text? }): Promise<void>",
            description: "Send a transactional email using the active Mailgun connection. Reads domain and API key from DB.",
            params: [
              { name: "to", type: "string | string[]", description: "Recipient address(es)" },
              { name: "subject", type: "string", description: "Email subject line" },
              { name: "html", type: "string", description: "HTML body content" },
              { name: "text", type: "string", description: "Plain-text fallback", optional: true },
            ],
            badge: "server",
          },
        ],
      },
      {
        title: "API capabilities",
        methods: [
          { name: "send", signature: "POST /v3/{domain}/messages", description: "Send email with full control over headers, tags, and tracking." },
          { name: "templates", signature: "GET /v3/{domain}/templates", description: "Manage reusable email templates with Handlebars variables." },
          { name: "events", signature: "GET /v3/{domain}/events", description: "Query delivery events: delivered, bounced, complained, clicked, opened." },
          { name: "suppressions", signature: "GET /v3/{domain}/bounces", description: "Manage bounce, unsubscribe, and complaint lists." },
          { name: "routes", signature: "GET /v3/routes", description: "Configure inbound email routing rules." },
        ],
      },
    ],
  },

  BUNNY_CDN: {
    description: "Bunny CDN storage helper. Upload and delete files via the lib/bunny.ts functions. Returns public CDN URLs.",
    importPath: "@/lib/bunny",
    docs: "https://docs.bunny.net/reference/storage-api",
    groups: [
      {
        title: "Helper functions",
        methods: [
          {
            name: "bunnyUpload",
            signature: "bunnyUpload(path, body, contentType): Promise<string>",
            description: "Upload a Buffer to Bunny Storage. Returns the public CDN URL.",
            params: [
              { name: "path", type: "string", description: 'Storage path relative to zone root, e.g. "avatars/user123.webp"' },
              { name: "body", type: "Buffer", description: "File contents as a Node.js Buffer" },
              { name: "contentType", type: "string", description: 'MIME type, e.g. "image/webp"' },
            ],
            returns: "Public CDN URL for the uploaded file",
            badge: "server",
          },
          {
            name: "bunnyDelete",
            signature: "bunnyDelete(cdnUrl): Promise<void>",
            description: "Delete a file from Bunny Storage by its CDN URL. Safe to call even if the file does not exist.",
            params: [
              { name: "cdnUrl", type: "string", description: "Full CDN URL of the file to delete" },
            ],
            badge: "server",
          },
        ],
      },
      {
        title: "Environment variables used",
        methods: [
          { name: "BUNNY_STORAGE_ZONE", signature: "string", description: "Storage zone name." },
          { name: "BUNNY_ACCESS_KEY", signature: "string", description: "Storage zone API key (found in Bunny dashboard)." },
          { name: "BUNNY_STORAGE_API_HOST", signature: "string (optional)", description: 'Region-specific storage host. Defaults to "storage.bunnycdn.com".' },
          { name: "BUNNY_CDN_HOSTNAME", signature: "string", description: "Pull zone hostname for constructing public URLs." },
        ],
      },
    ],
  },

  CUSTOM_REST: {
    description: "Generic REST API connector. Supports API key, Bearer token, and Basic auth. Build your own fetch calls using the stored credentials.",
    importPath: "native fetch",
    groups: [
      {
        title: "Usage pattern",
        methods: [
          {
            name: "fetch",
            signature: "fetch(url, { headers: buildHeaders(creds) })",
            description: "Use the credentials stored in this connection to authenticate any REST endpoint. Build the auth header based on the authType field.",
            badge: "server",
          },
        ],
      },
      {
        title: "Auth types",
        methods: [
          { name: "none", signature: 'authType: "none"', description: "No authentication — open API or handled at network level." },
          { name: "apikey", signature: 'authType: "apikey"', description: "Sends the API key in a custom header (apiKeyHeader) or X-Api-Key by default." },
          { name: "bearer", signature: 'authType: "bearer"', description: 'Sends Authorization: Bearer {bearerToken}.' },
          { name: "basic", signature: 'authType: "basic"', description: 'Sends Authorization: Basic {base64(username:password)}.' },
        ],
      },
    ],
  },

  BRAVE_SEARCH: {
    description: "Brave Search API — web search with 2 000 free requests/month. Used for company website and email discovery.",
    importPath: "@/lib/brave-search",
    docs: "https://api.search.brave.com/app/documentation/web-search",
    groups: [
      {
        title: "Helper functions",
        methods: [
          {
            name: "braveSearch",
            signature: "braveSearch(query, count?): Promise<BraveWebResult[]>",
            description: "Raw web search. Returns up to `count` results with title, URL, and description snippet.",
            params: [
              { name: "query",  type: "string", description: "Search query string" },
              { name: "count",  type: "number", description: "Max results to return (default 5)", optional: true },
            ],
            returns: "BraveWebResult[] — { title, url, description }",
            badge: "server",
          },
          {
            name: "findCompanyWeb",
            signature: "findCompanyWeb(name, city): Promise<CompanyWebInfo>",
            description: "Find a company's official website and email. Runs two searches: one for the website (prefers .gr domains, skips directories), one for email (extracts from snippets via regex).",
            params: [
              { name: "name", type: "string", description: "Company name, e.g. from AEEDE onomasia or commerTitle" },
              { name: "city", type: "string", description: "City from AEEDE postalAreaDescription" },
            ],
            returns: "{ website: string|null, email: string|null, source: string|null }",
            badge: "server",
          },
        ],
      },
    ],
  },

  AEEDE_VAT: {
    description: "Greek business registry lookup via AFM (ΑΦΜ). No credentials required — public API. Returns company info and KAD activities. Read-only.",
    importPath: "@/lib/aeede",
    groups: [
      {
        title: "Helper function",
        methods: [
          {
            name: "aeedeVatLookup",
            signature: "aeedeVatLookup(afm): Promise<AeedeResult>",
            description: "POST the AFM to the AEEDE endpoint and return structured company data and KAD business activities.",
            params: [
              { name: "afm", type: "string", description: "Greek VAT number (ΑΦΜ), 9 digits, e.g. \"099095556\"" },
            ],
            returns: "{ basicRec: AeedeBasicRec, activities: AeedeFirmActivity[] }",
            badge: "server",
          },
        ],
      },
      {
        title: "basicRec fields",
        methods: [
          { name: "afm",                   signature: "string",  description: "ΑΦΜ (VAT number)" },
          { name: "onomasia",              signature: "string",  description: "Επωνυμία — full legal name" },
          { name: "commerTitle",           signature: "string",  description: "Διακριτικός τίτλος — trading name" },
          { name: "legalStatusDescr",      signature: "string",  description: "Νομική μορφή, e.g. ΙΚΕ, ΑΕ, ΕΠΕ" },
          { name: "doy / doyDescr",        signature: "string",  description: "ΔΟΥ code and description" },
          { name: "deactivationFlagDescr", signature: "string",  description: "ΕΝΕΡΓΟΣ ΑΦΜ or ΔΙΑΓΡΑΜΜΕΝΟΣ ΑΦΜ" },
          { name: "postalAddress",         signature: "string",  description: "Street address" },
          { name: "postalZipCode",         signature: "string",  description: "Postal code" },
          { name: "postalAreaDescription", signature: "string",  description: "City / area" },
          { name: "registDate",            signature: "string",  description: "Ημερομηνία έναρξης (YYYY-MM-DD)" },
          { name: "stopDate",              signature: "string | null", description: "Ημερομηνία διακοπής — null if still active" },
        ],
      },
      {
        title: "activities[] fields",
        methods: [
          { name: "firmActCode",     signature: "string", description: "KAD code (8-digit)" },
          { name: "firmActDescr",    signature: "string", description: "KAD description" },
          { name: "firmActKind",     signature: "string", description: "1 = ΚΥΡΙΑ, 2 = ΔΕΥΤΕΡΕΥΟΥΣΑ" },
          { name: "firmActKindDescr", signature: "string", description: "Human-readable kind label" },
        ],
      },
      {
        title: "Pipeline objects",
        methods: [
          { name: "company",    signature: 'fetchRecords("company",    { filter: "afm=099095556" })', description: "Returns a single company record from basicRec.", badge: "pipeline" },
          { name: "activities", signature: 'fetchRecords("activities", { filter: "afm=099095556" })', description: "Returns the full list of KAD activities for the given AFM.", badge: "pipeline" },
        ],
      },
    ],
  },

  VIVA_PAYMENTS: {
    description: "Viva Payments REST API. Supports Smart Checkout (OAuth2), Native Checkout, and payment order management for Greek and European merchants.",
    importPath: "native fetch",
    docs: "https://developer.viva.com/apis-for-payments/",
    groups: [
      {
        title: "Auth",
        methods: [
          {
            name: "basicAuth",
            signature: "Authorization: Basic base64(merchantId:apiKey)",
            description: "All Native Checkout API calls use HTTP Basic auth — merchantId as username, apiKey as password.",
            badge: "server",
          },
        ],
      },
      {
        title: "Payment orders",
        methods: [
          { name: "createOrder", signature: "POST https://www.vivapayments.com/api/orders", description: "Create a payment order and receive an orderCode. Use Basic auth (merchantId:apiKey). Demo: demo.vivapayments.com", badge: "server" },
          { name: "getOrder", signature: "GET https://www.vivapayments.com/api/orders/{orderCode}", description: "Retrieve payment order status and details.", badge: "server" },
          { name: "cancelOrder", signature: "DELETE https://www.vivapayments.com/api/orders/{orderCode}", description: "Cancel a pending payment order.", badge: "server" },
        ],
      },
      {
        title: "Transactions",
        methods: [
          { name: "getTransaction", signature: "GET https://www.vivapayments.com/api/transactions/{transactionId}", description: "Fetch full transaction details by ID.", badge: "server" },
          { name: "cancelTransaction", signature: "DELETE https://www.vivapayments.com/api/transactions/{transactionId}", description: "Cancel or refund a transaction.", badge: "server" },
          { name: "getTransactions", signature: "GET https://www.vivapayments.com/api/transactions", description: "List transactions with optional filters (date, amount, status).", badge: "server" },
        ],
      },
      {
        title: "Native Checkout flow",
        methods: [
          { name: "createOrder", signature: "POST https://www.vivapayments.com/api/orders → orderCode", description: "Step 1 — create the order server-side with Basic auth. Returns orderCode.", badge: "server" },
          { name: "redirect", signature: "https://www.vivapayments.com/web/newtransaction.aspx?ref={orderCode}", description: "Step 2 — redirect the customer to the Viva payment gateway page." },
          { name: "verify", signature: "GET https://www.vivapayments.com/api/transactions?ordercode={orderCode}", description: "Step 3 — verify payment by checking transaction status after redirect back.", badge: "server" },
        ],
      },
      {
        title: "Environments",
        methods: [
          { name: "production", signature: "https://www.vivapayments.com", description: "Live environment. Use live merchantId + apiKey." },
          { name: "demo", signature: "https://demo.vivapayments.com", description: "Sandbox environment. Use demo credentials from demo.vivapayments.com." },
        ],
      },
    ],
  },

  YUBOTO_SMS: {
    description: "Yuboto Octapush OMNI SMS gateway. Send transactional SMS, check account balance, and request delivery receipts. Uses Basic auth with the API key from the Yuboto developer console.",
    importPath: "@/lib/sms",
    docs: "https://octapush.yuboto.com",
    groups: [
      {
        title: "Helper functions",
        methods: [
          {
            name: "sendSms",
            signature: "sendSms({ to, text, sender?, type?, longSms?, validity?, dlr? }): Promise<SmsResult[]>",
            description: "Send one or more SMS messages. Uses YUBOTO_API_KEY and YUBOTO_SENDER from env. Returns one SmsResult per recipient.",
            params: [
              { name: "to",       type: "string | string[]", description: "Recipient phone number(s) in international format, e.g. 3069XXXXXXXX" },
              { name: "text",     type: "string",            description: "Message body. Use longsms: true for messages over 160 chars." },
              { name: "sender",   type: "string",            description: "Override the default sender name.", optional: true },
              { name: "type",     type: '"sms" | "Flash" | "unicode"', description: 'Message type. Defaults to "sms".', optional: true },
              { name: "longSms",  type: "boolean",           description: "Allow multi-part messages. Defaults to true.", optional: true },
              { name: "validity", type: "number",            description: "Minutes the message stays valid (30–4320). Default 1440.", optional: true },
              { name: "dlr",      type: "boolean",           description: "Request delivery receipt callback.", optional: true },
            ],
            returns: "SmsResult[] — { messageId, phone, status, errorCode }",
            badge: "server",
          },
          {
            name: "getSmsBalance",
            signature: "getSmsBalance(): Promise<{ balance: number; type: string }>",
            description: "Fetch the current account balance from Yuboto. Useful for low-credit alerts.",
            returns: "{ balance: number, type: string }",
            badge: "server",
          },
        ],
      },
      {
        title: "API endpoints",
        methods: [
          { name: "Send",            signature: "POST https://services.yuboto.com/omni/v1/Send",            description: "Send SMS or Viber messages to up to 1000 recipients." },
          { name: "UserBalance",     signature: "POST https://services.yuboto.com/omni/v1/UserBalance",     description: "Retrieve current account balance and subscription info." },
          { name: "UserSubscription", signature: "POST https://services.yuboto.com/omni/v1/UserSubscription", description: "Active subscriptions and channel limits." },
          { name: "Dlr",             signature: "POST https://services.yuboto.com/omni/v1/Dlr",             description: "Delivery report for a previously sent message." },
          { name: "Cost",            signature: "POST https://services.yuboto.com/omni/v1/Cost",            description: "Estimate cost before sending." },
          { name: "Cancel",          signature: "POST https://services.yuboto.com/omni/v1/Cancel",          description: "Cancel a scheduled message." },
        ],
      },
      {
        title: "Auth",
        methods: [
          {
            name: "basicAuth",
            signature: "Authorization: Basic base64(apiKey)",
            description: "All requests use HTTP Basic auth. The API key from the Yuboto console is already in Base64 — pass it directly without re-encoding.",
            badge: "server",
          },
        ],
      },
      {
        title: "Environment variables",
        methods: [
          { name: "YUBOTO_API_KEY", signature: "string", description: "Base64 API key from Yuboto Developers > API Key." },
          { name: "YUBOTO_SENDER",  signature: "string", description: "Default sender name (max 11 alphanumeric chars) or phone number." },
        ],
      },
    ],
  },

  GEOCODE_MAPS: {
    description: "Forward and reverse geocoding via geocode.maps.co. Reads the API key from this connection. Server-side only.",
    importPath: "@/lib/geocode",
    docs: "https://geocode.maps.co",
    groups: [
      {
        title: "Helper functions",
        methods: [
          {
            name: "forwardGeocode",
            signature: "forwardGeocode(address): Promise<ForwardGeocodeResult[]>",
            description: "Convert an address string into geographic coordinates. Returns an array of candidate matches ordered by relevance.",
            params: [
              { name: "address", type: "string", description: "Free-form address or place name, e.g. \"Ερμού 10, Αθήνα\"" },
            ],
            returns: "Array of { placeId, lat, lon, displayName, type, boundingBox }",
            badge: "server",
          },
          {
            name: "reverseGeocode",
            signature: "reverseGeocode(lat, lon): Promise<ReverseGeocodeResult>",
            description: "Convert latitude/longitude coordinates into a structured address.",
            params: [
              { name: "lat", type: "number", description: "Latitude (decimal degrees)" },
              { name: "lon", type: "number", description: "Longitude (decimal degrees)" },
            ],
            returns: "{ placeId, lat, lon, displayName, address: { road, city, postcode, country, ... } }",
            badge: "server",
          },
        ],
      },
      {
        title: "API endpoints",
        methods: [
          { name: "search", signature: "GET https://geocode.maps.co/search?q={address}&api_key={key}", description: "Forward geocoding — address to coordinates." },
          { name: "reverse", signature: "GET https://geocode.maps.co/reverse?lat={lat}&lon={lon}&api_key={key}", description: "Reverse geocoding — coordinates to address." },
        ],
      },
    ],
  },
}

// ─── Badge ─────────────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, string> = {
  server:   "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  pipeline: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  util:     "bg-amber-500/10 text-amber-400 border border-amber-500/20",
}
const BADGE_LABELS: Record<string, string> = {
  server:   "server-only",
  pipeline: "pipeline",
  util:     "util",
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  connectionName: string
  connectionType: string
  open: boolean
  onClose: () => void
}

export function ConnectionInfoDialog({ connectionName, connectionType, open, onClose }: Props) {
  const info = CONNECTOR_INFO[connectionType]

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl rounded-2xl border shadow-2xl animate-in fade-in zoom-in-95 duration-150 focus:outline-none flex flex-col max-h-[88vh]"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700 shadow">
                <BookOpen className="size-4 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-[14px] font-semibold leading-tight" style={{ color: "var(--foreground)" }}>
                  {connectionName}
                </Dialog.Title>
                <Dialog.Description className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {info ? info.description : "No documentation available for this connection type."}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="size-7 rounded-lg flex items-center justify-center shrink-0 ml-4" style={{ color: "var(--muted-foreground)" }}>
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {/* Meta bar */}
          {info && (
            <div className="flex items-center gap-4 px-6 py-2.5 shrink-0 text-[11px]" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/20" }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color: "var(--muted-foreground)" }}>Import</span>
                <code className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                  {info.importPath}
                </code>
              </div>
              {info.docs && (
                <a
                  href={info.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                >
                  Official docs ↗
                </a>
              )}
            </div>
          )}

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-7">
            {!info ? (
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                No reference documentation is defined for <strong>{connectionType}</strong> yet.
              </p>
            ) : (
              info.groups.map((group) => (
                <section key={group.title}>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted-foreground)" }}>
                    {group.title}
                  </h3>
                  <div className="space-y-3">
                    {group.methods.map((method) => (
                      <div
                        key={method.name}
                        className="rounded-xl border p-3.5 space-y-2"
                        style={{ borderColor: "var(--border)", background: "var(--background)" }}
                      >
                        {/* Name row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold font-mono" style={{ color: "var(--foreground)" }}>
                            {method.name}
                          </span>
                          {method.badge && (
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full", BADGE_STYLES[method.badge])}>
                              {BADGE_LABELS[method.badge]}
                            </span>
                          )}
                        </div>

                        {/* Signature */}
                        <pre className="text-[11px] font-mono px-3 py-2 rounded-lg overflow-x-auto leading-relaxed"
                          style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                          {method.signature}
                        </pre>

                        {/* Description */}
                        <p className="text-[12px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                          {method.description}
                        </p>

                        {/* Params */}
                        {method.params && method.params.length > 0 && (
                          <div className="mt-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                              Parameters
                            </p>
                            <div className="space-y-1">
                              {method.params.map((p) => (
                                <div key={p.name} className="flex gap-2 text-[11px]">
                                  <code className="shrink-0 font-mono font-semibold" style={{ color: "var(--foreground)", minWidth: "7rem" }}>
                                    {p.name}{p.optional ? "?" : ""}
                                  </code>
                                  <code className="shrink-0 font-mono" style={{ color: "var(--muted-foreground)", minWidth: "8rem" }}>
                                    {p.type}
                                  </code>
                                  <span style={{ color: "var(--muted-foreground)" }}>{p.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Returns */}
                        {method.returns && (
                          <div className="flex items-start gap-2 text-[11px] pt-0.5">
                            <span className="shrink-0 font-semibold" style={{ color: "var(--muted-foreground)" }}>Returns</span>
                            <code className="font-mono" style={{ color: "var(--foreground)" }}>{method.returns}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
