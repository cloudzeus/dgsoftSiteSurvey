import type { Connector, ConnectorRecord, DiscoveredField, DiscoveredObject, FetchOptions, ShopifyCredentials } from "./types"

// Known Shopify resources with their canonical fields
const SHOPIFY_RESOURCES: Record<string, { label: string; fields: DiscoveredField[]; primaryKey: string }> = {
  orders: {
    label: "Orders",
    primaryKey: "id",
    fields: [
      { name: "id",                 label: "Order ID",          dataType: "numeric",   isPrimaryKey: true },
      { name: "order_number",       label: "Order Number",       dataType: "numeric"   },
      { name: "email",              label: "Customer Email",     dataType: "character" },
      { name: "financial_status",   label: "Financial Status",   dataType: "character" },
      { name: "fulfillment_status", label: "Fulfillment Status", dataType: "character" },
      { name: "total_price",        label: "Total Price",        dataType: "numeric"   },
      { name: "subtotal_price",     label: "Subtotal",           dataType: "numeric"   },
      { name: "total_tax",          label: "Total Tax",          dataType: "numeric"   },
      { name: "currency",           label: "Currency",           dataType: "character" },
      { name: "created_at",         label: "Created At",         dataType: "datetime"  },
      { name: "updated_at",         label: "Updated At",         dataType: "datetime"  },
      { name: "customer.id",        label: "Customer ID",        dataType: "numeric"   },
      { name: "customer.email",     label: "Customer Email",     dataType: "character" },
      { name: "customer.first_name",label: "Customer First Name",dataType: "character" },
      { name: "customer.last_name", label: "Customer Last Name", dataType: "character" },
      { name: "note",               label: "Notes",              dataType: "character" },
      { name: "tags",               label: "Tags",               dataType: "character" },
    ],
  },
  products: {
    label: "Products",
    primaryKey: "id",
    fields: [
      { name: "id",           label: "Product ID",   dataType: "numeric",   isPrimaryKey: true },
      { name: "title",        label: "Title",         dataType: "character" },
      { name: "body_html",    label: "Description",   dataType: "character" },
      { name: "vendor",       label: "Vendor",        dataType: "character" },
      { name: "product_type", label: "Product Type",  dataType: "character" },
      { name: "status",       label: "Status",        dataType: "character" },
      { name: "tags",         label: "Tags",          dataType: "character" },
      { name: "created_at",   label: "Created At",    dataType: "datetime"  },
      { name: "updated_at",   label: "Updated At",    dataType: "datetime"  },
    ],
  },
  customers: {
    label: "Customers",
    primaryKey: "id",
    fields: [
      { name: "id",           label: "Customer ID",   dataType: "numeric",   isPrimaryKey: true },
      { name: "email",        label: "Email",          dataType: "character" },
      { name: "first_name",   label: "First Name",     dataType: "character" },
      { name: "last_name",    label: "Last Name",      dataType: "character" },
      { name: "phone",        label: "Phone",          dataType: "character" },
      { name: "orders_count", label: "Orders Count",   dataType: "numeric"   },
      { name: "total_spent",  label: "Total Spent",    dataType: "numeric"   },
      { name: "tags",         label: "Tags",           dataType: "character" },
      { name: "created_at",   label: "Created At",     dataType: "datetime"  },
    ],
  },
  inventory: {
    label: "Inventory",
    primaryKey: "inventory_item_id",
    fields: [
      { name: "inventory_item_id", label: "Inventory Item ID", dataType: "numeric",   isPrimaryKey: true },
      { name: "location_id",       label: "Location ID",        dataType: "numeric"   },
      { name: "available",         label: "Available Qty",      dataType: "numeric"   },
      { name: "updated_at",        label: "Updated At",         dataType: "datetime"  },
    ],
  },
}

export class ShopifyConnector implements Connector {
  private creds: ShopifyCredentials

  constructor(creds: ShopifyCredentials) {
    this.creds = creds
  }

  private get apiBase() {
    return `https://${this.creds.shopDomain}/admin/api/2024-01`
  }

  private async apiFetch(path: string, opts?: RequestInit) {
    const res = await fetch(`${this.apiBase}${path}`, {
      ...opts,
      headers: {
        "X-Shopify-Access-Token": this.creds.accessToken,
        "Content-Type": "application/json",
        ...(opts?.headers ?? {}),
      },
    })
    if (!res.ok) throw new Error(`Shopify API ${path} → ${res.status} ${res.statusText}`)
    return res.json()
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.apiFetch("/shop.json")
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async discoverObjects(): Promise<DiscoveredObject[]> {
    return Object.entries(SHOPIFY_RESOURCES).map(([name, r]) => ({ name, label: r.label }))
  }

  async discoverFields(objectName: string): Promise<{ fields: DiscoveredField[]; primaryKey?: string }> {
    const resource = SHOPIFY_RESOURCES[objectName]
    if (!resource) throw new Error(`Unknown Shopify resource: ${objectName}`)
    return { fields: resource.fields, primaryKey: resource.primaryKey }
  }

  async fetchRecords(objectName: string, opts: FetchOptions = {}): Promise<{ records: ConnectorRecord[]; total: number }> {
    const { offset = 0, limit = 250 } = opts
    const data = await this.apiFetch(`/${objectName}.json?limit=${limit}`)
    const rows: any[] = data[objectName] ?? []

    return {
      records: rows.map((r) => ({ externalId: String(r.id), data: r })),
      total: rows.length,
    }
  }

  async writeRecord(objectName: string, data: Record<string, unknown>, externalId?: string): Promise<{ externalId: string }> {
    const method = externalId ? "PUT" : "POST"
    const url = externalId ? `/${objectName}/${externalId}.json` : `/${objectName}.json`
    const result = await this.apiFetch(url, { method, body: JSON.stringify({ [objectName.replace(/s$/, "")]: data }) })
    const record = result[objectName.replace(/s$/, "")] ?? result
    return { externalId: String(record.id ?? externalId ?? "") }
  }
}
