// Magento / Adobe Commerce REST API V1 Connector
// Multilingual: each store view = one locale. Locale fields fetched per store view
// and stored as field_storeCode (e.g. name_el, description_el).
// Auth: Bearer Integration Admin Token

import type {
  Connector, ConnectorRecord, DiscoveredField, DiscoveredObject, FetchOptions,
  MagentoCredentials, MagentoStoreView,
} from "./types"

// Fields that Magento stores per store view (locale-scope)
const LOCALE_FIELDS = ["name", "description", "short_description", "url_key", "meta_title", "meta_description", "meta_keyword"]
const CATEGORY_LOCALE_FIELDS = ["name", "description", "url_key", "meta_title", "meta_description", "meta_keywords"]

// ─── Base field definitions (non-locale) ─────────────────────────────────────

const BASE_FIELDS: Record<string, DiscoveredField[]> = {
  categories: [
    { name: "id",              label: "Category ID",   dataType: "numeric",   isPrimaryKey: true, nullable: false },
    { name: "parent_id",       label: "Parent ID",     dataType: "numeric",   nullable: true },
    { name: "name",            label: "Name (default)", dataType: "character", nullable: false },
    { name: "is_active",       label: "Active",        dataType: "logical",   nullable: true },
    { name: "position",        label: "Position",      dataType: "numeric",   nullable: true },
    { name: "level",           label: "Level",         dataType: "numeric",   nullable: true },
    { name: "url_key",         label: "URL Key (default)", dataType: "character", nullable: true },
    { name: "include_in_menu", label: "In Menu",       dataType: "logical",   nullable: true },
    { name: "path",            label: "Path",          dataType: "character", nullable: true },
    { name: "description",     label: "Description (default)", dataType: "character", nullable: true },
    { name: "meta_title",      label: "Meta Title (default)",  dataType: "character", nullable: true },
    { name: "meta_description",label: "Meta Desc (default)",   dataType: "character", nullable: true },
  ],
  products: [
    { name: "sku",               label: "SKU",               dataType: "character", isPrimaryKey: true, nullable: false },
    { name: "name",              label: "Name (default)",    dataType: "character", nullable: false },
    { name: "price",             label: "Price",             dataType: "numeric",   nullable: true },
    { name: "status",            label: "Status (1=enabled,2=disabled)", dataType: "numeric", nullable: true },
    { name: "visibility",        label: "Visibility (1–4)",  dataType: "numeric",   nullable: true },
    { name: "type_id",           label: "Type",              dataType: "character", nullable: false },
    { name: "attribute_set_id",  label: "Attribute Set ID",  dataType: "numeric",   nullable: false },
    { name: "weight",            label: "Weight",            dataType: "numeric",   nullable: true },
    { name: "description",       label: "Description (default)",       dataType: "character", nullable: true },
    { name: "short_description", label: "Short Description (default)", dataType: "character", nullable: true },
    { name: "url_key",           label: "URL Key (default)", dataType: "character", nullable: true },
    { name: "meta_title",        label: "Meta Title (default)",        dataType: "character", nullable: true },
    { name: "meta_description",  label: "Meta Desc (default)",         dataType: "character", nullable: true },
    { name: "manufacturer",      label: "Brand/Manufacturer",          dataType: "character", nullable: true },
    { name: "category_ids",      label: "Category IDs (comma-sep)",    dataType: "character", nullable: true },
    { name: "special_price",     label: "Special Price",    dataType: "numeric",   nullable: true },
    { name: "special_from_date", label: "Special Price From", dataType: "datetime", nullable: true },
    { name: "special_to_date",   label: "Special Price To",  dataType: "datetime",  nullable: true },
  ],
  product_attributes: [
    { name: "attribute_code",  label: "Attribute Code", dataType: "character", isPrimaryKey: true },
    { name: "attribute_id",    label: "Attribute ID",   dataType: "numeric",   nullable: true },
    { name: "frontend_label",  label: "Label",          dataType: "character", nullable: true },
    { name: "frontend_input",  label: "Input Type",     dataType: "character", nullable: true },
    { name: "is_required",     label: "Required",       dataType: "logical",   nullable: true },
    { name: "scope",           label: "Scope",          dataType: "character", nullable: true },
  ],
  attribute_options: [
    { name: "value",      label: "Option Value", dataType: "character", isPrimaryKey: true },
    { name: "label",      label: "Label",        dataType: "character", nullable: false },
    { name: "is_default", label: "Is Default",   dataType: "logical",   nullable: true },
    { name: "sort_order", label: "Sort Order",   dataType: "numeric",   nullable: true },
  ],
  attribute_sets: [
    { name: "attribute_set_id",   label: "Set ID",   dataType: "numeric",   isPrimaryKey: true },
    { name: "attribute_set_name", label: "Set Name", dataType: "character", nullable: false },
    { name: "sort_order",         label: "Sort Order", dataType: "numeric", nullable: true },
    { name: "entity_type_id",     label: "Entity Type ID", dataType: "numeric", nullable: true },
  ],
  inventory: [
    { name: "sku",         label: "SKU",          dataType: "character", isPrimaryKey: true, nullable: false },
    { name: "source_code", label: "Source Code",  dataType: "character", nullable: false },
    { name: "quantity",    label: "Quantity",     dataType: "numeric",   nullable: false },
    { name: "status",      label: "In Stock (1/0)", dataType: "numeric", nullable: false },
  ],
  inventory_sources: [
    { name: "source_code", label: "Source Code", dataType: "character", isPrimaryKey: true },
    { name: "name",        label: "Name",        dataType: "character", nullable: false },
    { name: "enabled",     label: "Enabled",     dataType: "logical",   nullable: true },
    { name: "description", label: "Description", dataType: "character", nullable: true },
    { name: "country_id",  label: "Country",     dataType: "character", nullable: true },
    { name: "city",        label: "City",        dataType: "character", nullable: true },
    { name: "street",      label: "Street",      dataType: "character", nullable: true },
    { name: "postcode",    label: "Postcode",    dataType: "character", nullable: true },
    { name: "latitude",    label: "Latitude",    dataType: "numeric",   nullable: true },
    { name: "longitude",   label: "Longitude",   dataType: "numeric",   nullable: true },
  ],
  customers: [
    { name: "id",               label: "Customer ID",       dataType: "numeric",   isPrimaryKey: true, nullable: false },
    { name: "email",            label: "Email",             dataType: "character", nullable: false },
    { name: "firstname",        label: "First Name",        dataType: "character", nullable: false },
    { name: "lastname",         label: "Last Name",         dataType: "character", nullable: false },
    { name: "group_id",         label: "Customer Group ID", dataType: "numeric",   nullable: true },
    { name: "store_id",         label: "Store ID",          dataType: "numeric",   nullable: true },
    { name: "website_id",       label: "Website ID",        dataType: "numeric",   nullable: true },
    { name: "created_at",       label: "Created At",        dataType: "datetime",  nullable: true },
    { name: "updated_at",       label: "Updated At",        dataType: "datetime",  nullable: true },
    { name: "dob",              label: "Date of Birth",     dataType: "datetime",  nullable: true },
    { name: "gender",           label: "Gender",            dataType: "numeric",   nullable: true },
    { name: "taxvat",           label: "Tax/VAT Number",    dataType: "character", nullable: true },
    { name: "is_subscribed",    label: "Newsletter",        dataType: "logical",   nullable: true },
    { name: "default_billing",  label: "Default Billing Addr ID",  dataType: "numeric", nullable: true },
    { name: "default_shipping", label: "Default Shipping Addr ID", dataType: "numeric", nullable: true },
  ],
  orders: [
    { name: "entity_id",          label: "Order ID",         dataType: "numeric",   isPrimaryKey: true, nullable: false },
    { name: "increment_id",       label: "Order Number",     dataType: "character", nullable: false },
    { name: "status",             label: "Status",           dataType: "character", nullable: false },
    { name: "state",              label: "State",            dataType: "character", nullable: false },
    { name: "created_at",         label: "Created At",       dataType: "datetime",  nullable: false },
    { name: "updated_at",         label: "Updated At",       dataType: "datetime",  nullable: true },
    { name: "grand_total",        label: "Grand Total",      dataType: "numeric",   nullable: false },
    { name: "subtotal",           label: "Subtotal",         dataType: "numeric",   nullable: true },
    { name: "tax_amount",         label: "Tax Amount",       dataType: "numeric",   nullable: true },
    { name: "discount_amount",    label: "Discount Amount",  dataType: "numeric",   nullable: true },
    { name: "shipping_amount",    label: "Shipping Amount",  dataType: "numeric",   nullable: true },
    { name: "base_currency_code", label: "Currency",         dataType: "character", nullable: true },
    { name: "customer_id",        label: "Customer ID",      dataType: "numeric",   nullable: true },
    { name: "customer_email",     label: "Customer Email",   dataType: "character", nullable: true },
    { name: "customer_firstname", label: "Customer First Name", dataType: "character", nullable: true },
    { name: "customer_lastname",  label: "Customer Last Name",  dataType: "character", nullable: true },
    { name: "customer_is_guest",  label: "Guest Order",      dataType: "logical",   nullable: true },
    { name: "payment_method",     label: "Payment Method",   dataType: "character", nullable: true },
    { name: "shipping_description", label: "Shipping Method", dataType: "character", nullable: true },
    { name: "total_item_count",   label: "Item Count",       dataType: "numeric",   nullable: true },
    { name: "total_qty_ordered",  label: "Total Qty",        dataType: "numeric",   nullable: true },
    { name: "billing_address",    label: "Billing Address (JSON)",  dataType: "character", nullable: true },
    { name: "shipping_address",   label: "Shipping Address (JSON)", dataType: "character", nullable: true },
    { name: "items",              label: "Order Items (JSON)",      dataType: "character", nullable: true },
  ],
}

// ─── Connector ────────────────────────────────────────────────────────────────

export class MagentoConnector implements Connector {
  private base: string
  private token: string
  private adminView: string       // store view for all-scope writes ("all")
  private brandAttr: string
  private storeViews: MagentoStoreView[]

  constructor(creds: MagentoCredentials) {
    this.base       = creds.baseUrl.replace(/\/$/, "")
    this.token      = creds.accessToken
    this.adminView  = creds.adminStoreView ?? "all"
    this.brandAttr  = creds.brandAttributeCode ?? "manufacturer"
    this.storeViews = creds.storeViews ?? []
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  private headers() {
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", Accept: "application/json" }
  }

  private urlFor(storeView: string, path: string) {
    return `${this.base}/rest/${storeView}/V1/${path.replace(/^\//, "")}`
  }

  private async req(method: string, storeView: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(this.urlFor(storeView, path), {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    })
    const text = await res.text()
    let data: any
    try { data = JSON.parse(text) } catch { data = { message: text } }
    if (!res.ok) throw new Error(`Magento ${method} [${storeView}] ${path}: ${data?.message ?? `HTTP ${res.status}`}`)
    return data
  }

  // Shorthand helpers using admin store view
  private get  = (path: string)              => this.req("GET",    this.adminView, path)
  private post = (path: string, b: unknown)  => this.req("POST",   this.adminView, path, b)
  private put  = (path: string, b: unknown)  => this.req("PUT",    this.adminView, path, b)

  // Per locale view
  private getLocale = (code: string, path: string) => this.req("GET", code, path)
  private putLocale = (code: string, path: string, b: unknown) => this.req("PUT", code, path, b)

  private sc(opts: {
    page: number; pageSize: number
    filters?: Array<{ field: string; value: string | number; condition?: string }>
    sortField?: string; sortDir?: "ASC" | "DESC"
  }): string {
    const p = new URLSearchParams()
    p.set("searchCriteria[currentPage]", String(opts.page))
    p.set("searchCriteria[pageSize]", String(opts.pageSize))
    if (opts.sortField) {
      p.set("searchCriteria[sortOrders][0][field]", opts.sortField)
      p.set("searchCriteria[sortOrders][0][direction]", opts.sortDir ?? "ASC")
    }
    opts.filters?.forEach((f, i) => {
      p.set(`searchCriteria[filter_groups][0][filters][${i}][field]`, f.field)
      p.set(`searchCriteria[filter_groups][0][filters][${i}][value]`, String(f.value))
      p.set(`searchCriteria[filter_groups][0][filters][${i}][condition_type]`, f.condition ?? "eq")
    })
    return p.toString()
  }

  // ─── Locale helpers ────────────────────────────────────────────────────────

  /** Fetch locale-scoped fields for a product from each configured store view */
  private async fetchProductLocales(sku: string): Promise<Record<string, unknown>> {
    if (this.storeViews.length === 0) return {}
    const merged: Record<string, unknown> = {}
    await Promise.all(this.storeViews.map(async (sv) => {
      try {
        const p = await this.getLocale(sv.code, `products/${encodeURIComponent(sku)}`)
        const flat = flattenCustomAttributes(p)
        for (const field of LOCALE_FIELDS) {
          if (flat[field] !== undefined && flat[field] !== null) {
            merged[`${field}_${sv.code}`] = flat[field]
          }
        }
      } catch { /* store view may not have this product */ }
    }))
    return merged
  }

  /** Fetch locale-scoped fields for a category from each configured store view */
  private async fetchCategoryLocales(id: string | number): Promise<Record<string, unknown>> {
    if (this.storeViews.length === 0) return {}
    const merged: Record<string, unknown> = {}
    await Promise.all(this.storeViews.map(async (sv) => {
      try {
        const c = await this.getLocale(sv.code, `categories/${id}`)
        const flat = flattenCustomAttributes(c)
        for (const field of CATEGORY_LOCALE_FIELDS) {
          if (flat[field] !== undefined && flat[field] !== null) {
            merged[`${field}_${sv.code}`] = flat[field]
          }
        }
      } catch {}
    }))
    return merged
  }

  /** Write locale-scoped fields back to each store view */
  private async writeProductLocales(sku: string, data: Record<string, unknown>): Promise<void> {
    await Promise.all(this.storeViews.map(async (sv) => {
      const localeProduct: Record<string, unknown> = {}
      let hasLocale = false
      for (const field of LOCALE_FIELDS) {
        const key = `${field}_${sv.code}`
        if (data[key] !== undefined) {
          localeProduct[field] = data[key]
          hasLocale = true
        }
      }
      if (!hasLocale) return
      await this.putLocale(sv.code, `products/${encodeURIComponent(sku)}`, { product: localeProduct })
    }))
  }

  private async writeCategoryLocales(id: string, data: Record<string, unknown>): Promise<void> {
    await Promise.all(this.storeViews.map(async (sv) => {
      const localeCat: Record<string, unknown> = {}
      let hasLocale = false
      for (const field of CATEGORY_LOCALE_FIELDS) {
        const key = `${field}_${sv.code}`
        if (data[key] !== undefined) {
          localeCat[field] = data[key]
          hasLocale = true
        }
      }
      if (!hasLocale) return
      await this.putLocale(sv.code, `categories/${id}`, { category: localeCat })
    }))
  }

  // ─── Interface ─────────────────────────────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.get("store/storeConfigs")
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async discoverObjects(): Promise<DiscoveredObject[]> {
    const localeNote = this.storeViews.length > 0
      ? ` · ${this.storeViews.length} locale(s): ${this.storeViews.map((s) => s.code).join(", ")}`
      : " · no locales configured"
    return [
      { name: "categories",         label: `Categories${localeNote}`,       type: "tree" },
      { name: "products",           label: `Products (all types)${localeNote}`, type: "list" },
      { name: "configurable",       label: `Configurable Products${localeNote}`, type: "list" },
      { name: "bundle",             label: `Bundle Products${localeNote}`,   type: "list" },
      { name: "product_attributes", label: "Product Attributes",             type: "list" },
      { name: "attribute_options",  label: `Brands (${this.brandAttr})`,     type: "list" },
      { name: "attribute_sets",     label: "Attribute Sets",                 type: "list" },
      { name: "inventory",          label: "Inventory (MSI source items)",   type: "list" },
      { name: "inventory_sources",  label: "Inventory Sources",              type: "list" },
      { name: "customers",          label: "Customers",                      type: "list" },
      { name: "orders",             label: "Orders",                         type: "list" },
    ]
  }

  async discoverFields(objectName: string): Promise<{ fields: DiscoveredField[]; primaryKey?: string }> {
    const base = BASE_FIELDS[objectName] ?? []
    const localeFields: DiscoveredField[] = []

    // Inject locale-variant fields for translatable resources
    if (["products", "configurable", "bundle"].includes(objectName)) {
      for (const sv of this.storeViews) {
        const viewLabel = sv.label ?? sv.code
        for (const f of LOCALE_FIELDS) {
          localeFields.push({
            name:      `${f}_${sv.code}`,
            label:     `${f.replace(/_/g, " ")} (${viewLabel} · ${sv.locale})`,
            dataType:  "character",
            nullable:  true,
          })
        }
      }
    }
    if (objectName === "categories") {
      for (const sv of this.storeViews) {
        const viewLabel = sv.label ?? sv.code
        for (const f of CATEGORY_LOCALE_FIELDS) {
          localeFields.push({
            name:     `${f}_${sv.code}`,
            label:    `${f.replace(/_/g, " ")} (${viewLabel} · ${sv.locale})`,
            dataType: "character",
            nullable: true,
          })
        }
      }
    }

    const fields = [...base, ...localeFields]
    const pk = fields.find((f) => f.isPrimaryKey)?.name
    return { fields, primaryKey: pk }
  }

  async fetchRecords(objectName: string, opts: FetchOptions = {}): Promise<{ records: ConnectorRecord[]; total: number }> {
    const { offset = 0, limit = 50, filter } = opts
    const page = Math.floor(offset / limit) + 1

    switch (objectName) {
      case "categories":         return this._fetchCategories(page, limit)
      case "products":           return this._fetchProducts(page, limit)
      case "configurable":       return this._fetchProducts(page, limit, "configurable")
      case "bundle":             return this._fetchProducts(page, limit, "bundle")
      case "product_attributes": return this._fetchProductAttributes(page, limit)
      case "attribute_options":  return this._fetchAttributeOptions(this.brandAttr)
      case "attribute_sets":     return this._fetchAttributeSets(page, limit)
      case "inventory":          return this._fetchInventory(page, limit)
      case "inventory_sources":  return this._fetchInventorySources()
      case "customers":          return this._fetchCustomers(page, limit, filter)
      case "orders":             return this._fetchOrders(page, limit, filter)
      default:
        throw new Error(`Unknown Magento resource: ${objectName}`)
    }
  }

  async writeRecord(
    objectName: string,
    data: Record<string, unknown>,
    externalId?: string,
    method?: string,
  ): Promise<{ externalId: string }> {
    switch (objectName) {
      case "categories":                   return this._writeCategory(data, externalId)
      case "products":
      case "configurable":
      case "bundle":                       return this._writeProduct(data, externalId)
      case "attribute_options":            return this._writeAttributeOption(data, this.brandAttr)
      case "inventory":                    return this._writeInventory(data)
      case "customers":                    return this._writeCustomer(data, externalId)
      case "orders":                       return this._writeOrder(data, externalId, method)
      default:
        throw new Error(`Write not supported for: ${objectName}`)
    }
  }

  // ─── Categories ────────────────────────────────────────────────────────────

  private async _fetchCategories(page: number, pageSize: number) {
    const qs = this.sc({ page, pageSize, sortField: "entity_id", sortDir: "ASC" })
    const data = await this.get(`categories/list?${qs}`)
    const items: any[] = data.items ?? []

    const records = await Promise.all(items.map(async (c: any) => {
      const base = flattenCustomAttributes(c)
      const locales = await this.fetchCategoryLocales(c.id)
      return { externalId: String(c.id), data: { ...base, ...locales } }
    }))

    return { records, total: data.total_count ?? items.length }
  }

  private async _writeCategory(data: Record<string, unknown>, externalId?: string) {
    const { categoryData, hasLocale } = splitLocaleFields(data, CATEGORY_LOCALE_FIELDS, this.storeViews)
    const payload = { category: categoryData }

    let id: string
    if (externalId) {
      const result = await this.put(`categories/${externalId}`, payload)
      id = String(result.id)
    } else {
      const result = await this.post("categories", payload)
      id = String(result.id)
    }

    if (hasLocale) await this.writeCategoryLocales(id, data)
    return { externalId: id }
  }

  // ─── Products ──────────────────────────────────────────────────────────────

  private async _fetchProducts(page: number, pageSize: number, typeFilter?: string) {
    const filters = typeFilter ? [{ field: "type_id", value: typeFilter }] : undefined
    const qs = this.sc({ page, pageSize, filters, sortField: "entity_id", sortDir: "ASC" })
    const data = await this.get(`products?${qs}`)
    const items: any[] = data.items ?? []

    const records = await Promise.all(items.map(async (p: any) => {
      const base = {
        ...flattenCustomAttributes(p),
        category_ids: (p.extension_attributes?.category_links ?? []).map((c: any) => c.category_id).join(","),
      }
      const locales = await this.fetchProductLocales(p.sku)
      return { externalId: p.sku, data: { ...base, ...locales } }
    }))

    return { records, total: data.total_count ?? items.length }
  }

  private async _writeProduct(data: Record<string, unknown>, externalId?: string) {
    const { categoryData: productData, hasLocale } = splitLocaleFields(data, LOCALE_FIELDS, this.storeViews)

    // category_ids → category_links extension attribute
    const raw = { ...productData }
    const categoryLinks = raw.category_ids
      ? String(raw.category_ids).split(",").map((id) => ({ category_id: id.trim() }))
      : undefined
    delete raw.category_ids

    const product: Record<string, unknown> = { ...raw }
    if (categoryLinks) product.extension_attributes = { category_links: categoryLinks }

    const sku = externalId ?? String(data.sku ?? "")
    let finalSku: string

    if (sku) {
      try {
        await this.get(`products/${encodeURIComponent(sku)}`)
        const result = await this.put(`products/${encodeURIComponent(sku)}`, { product })
        finalSku = result.sku
      } catch {
        const result = await this.post("products", { product })
        finalSku = result.sku
      }
    } else {
      const result = await this.post("products", { product })
      finalSku = result.sku
    }

    if (hasLocale) await this.writeProductLocales(finalSku, data)
    return { externalId: finalSku }
  }

  // ─── Product Attributes ───────────────────────────────────────────────────

  private async _fetchProductAttributes(page: number, pageSize: number) {
    const qs = this.sc({ page, pageSize })
    const data = await this.get(`products/attributes?${qs}`)
    const items: any[] = data.items ?? []
    return {
      records: items.map((a: any) => ({
        externalId: a.attribute_code,
        data: {
          attribute_code: a.attribute_code, attribute_id: a.attribute_id,
          frontend_label: a.default_frontend_label ?? a.attribute_code,
          frontend_input: a.frontend_input, is_required: a.is_required, scope: a.scope,
        },
      })),
      total: data.total_count ?? items.length,
    }
  }

  // ─── Attribute Options (Brands) ────────────────────────────────────────────

  private async _fetchAttributeOptions(attributeCode: string) {
    const data: any[] = await this.get(`products/attributes/${attributeCode}/options`)
    const options = (data ?? []).filter((o: any) => o.value !== "")
    return {
      records: options.map((o: any) => ({
        externalId: String(o.value),
        data: { value: o.value, label: o.label, is_default: o.is_default, sort_order: o.sort_order ?? 0 },
      })),
      total: options.length,
    }
  }

  private async _writeAttributeOption(data: Record<string, unknown>, attributeCode: string) {
    const payload = { option: { label: data.label, value: data.value ?? "", sort_order: data.sort_order ?? 0, is_default: data.is_default ?? false } }
    const result = await this.post(`products/attributes/${attributeCode}/options`, payload)
    return { externalId: String(result) }
  }

  // ─── Attribute Sets ────────────────────────────────────────────────────────

  private async _fetchAttributeSets(page: number, pageSize: number) {
    const qs = this.sc({ page, pageSize, filters: [{ field: "entity_type_code", value: "catalog_product" }] })
    const data = await this.get(`products/attribute-sets/sets/list?${qs}`)
    const items: any[] = data.items ?? []
    return {
      records: items.map((s: any) => ({
        externalId: String(s.attribute_set_id),
        data: { attribute_set_id: s.attribute_set_id, attribute_set_name: s.attribute_set_name, sort_order: s.sort_order, entity_type_id: s.entity_type_id },
      })),
      total: data.total_count ?? items.length,
    }
  }

  // ─── Inventory (MSI) ───────────────────────────────────────────────────────

  private async _fetchInventory(page: number, pageSize: number) {
    const qs = this.sc({ page, pageSize })
    const data = await this.get(`inventory/source-items?${qs}`)
    const items: any[] = data.items ?? []
    return {
      records: items.map((item: any) => ({
        externalId: `${item.sku}::${item.source_code}`,
        data: { sku: item.sku, source_code: item.source_code, quantity: item.quantity, status: item.status },
      })),
      total: data.total_count ?? items.length,
    }
  }

  private async _writeInventory(data: Record<string, unknown>) {
    const items = Array.isArray(data) ? data : [data]
    await this.post("inventory/source-items", { sourceItems: items })
    return { externalId: `${data.sku}::${data.source_code}` }
  }

  private async _fetchInventorySources() {
    const data = await this.get("inventory/sources")
    const items: any[] = data.items ?? []
    return {
      records: items.map((s: any) => ({
        externalId: s.source_code,
        data: { source_code: s.source_code, name: s.name, enabled: s.enabled, description: s.description,
          country_id: s.country_id, city: s.city, street: s.street, postcode: s.postcode,
          latitude: s.latitude, longitude: s.longitude },
      })),
      total: items.length,
    }
  }

  // ─── Customers ─────────────────────────────────────────────────────────────

  private async _fetchCustomers(page: number, pageSize: number, filter?: string) {
    const filters = filter ? [{ field: "email", value: `%${filter}%`, condition: "like" }] : undefined
    const qs = this.sc({ page, pageSize, filters, sortField: "entity_id", sortDir: "ASC" })
    const data = await this.get(`customers/search?${qs}`)
    const items: any[] = data.items ?? []
    return {
      records: items.map((c: any) => ({
        externalId: String(c.id),
        data: {
          id: c.id, email: c.email, firstname: c.firstname, lastname: c.lastname,
          group_id: c.group_id, store_id: c.store_id, website_id: c.website_id,
          created_at: c.created_at, updated_at: c.updated_at,
          dob: c.dob, gender: c.gender, taxvat: c.taxvat,
          is_subscribed: c.extension_attributes?.is_subscribed ?? false,
          default_billing: c.default_billing, default_shipping: c.default_shipping,
        },
      })),
      total: data.total_count ?? items.length,
    }
  }

  private async _writeCustomer(data: Record<string, unknown>, externalId?: string) {
    const payload = { customer: data }
    if (externalId) {
      const result = await this.put(`customers/${externalId}`, payload)
      return { externalId: String(result.id) }
    }
    const result = await this.post("customers", payload)
    return { externalId: String(result.id) }
  }

  // ─── Orders ────────────────────────────────────────────────────────────────

  private async _fetchOrders(page: number, pageSize: number, filter?: string) {
    const filters = filter ? [{ field: "status", value: filter }] : undefined
    const qs = this.sc({ page, pageSize, filters, sortField: "entity_id", sortDir: "DESC" })
    const data = await this.get(`orders?${qs}`)
    const items: any[] = data.items ?? []
    return {
      records: items.map((o: any) => ({
        externalId: String(o.entity_id),
        data: {
          entity_id: o.entity_id, increment_id: o.increment_id,
          status: o.status, state: o.state,
          created_at: o.created_at, updated_at: o.updated_at,
          grand_total: o.grand_total, subtotal: o.subtotal,
          tax_amount: o.tax_amount, discount_amount: o.discount_amount,
          shipping_amount: o.shipping_amount, base_currency_code: o.base_currency_code,
          customer_id: o.customer_id, customer_email: o.customer_email,
          customer_firstname: o.customer_firstname, customer_lastname: o.customer_lastname,
          customer_is_guest: o.customer_is_guest,
          payment_method: o.payment?.method,
          shipping_description: o.shipping_description,
          total_item_count: o.total_item_count, total_qty_ordered: o.total_qty_ordered,
          billing_address: JSON.stringify(o.billing_address ?? {}),
          shipping_address: JSON.stringify(
            o.extension_attributes?.shipping_assignments?.[0]?.shipping?.address ?? {}
          ),
          items: JSON.stringify((o.items ?? []).map((i: any) => ({
            sku: i.sku, name: i.name,
            qty_ordered: i.qty_ordered, price: i.price, row_total: i.row_total,
          }))),
        },
      })),
      total: data.total_count ?? items.length,
    }
  }

  /**
   * writeRecord for orders:
   * - method "invoice"  → POST /orders/{id}/invoice
   * - method "ship"     → POST /orders/{id}/ship
   * - method "cancel"   → POST /orders/{id}/cancel
   * - method "comment"  → POST /orders/{id}/comments
   * - default           → POST /orders (create)
   */
  private async _writeOrder(data: Record<string, unknown>, externalId?: string, method?: string) {
    if (externalId && method === "invoice") {
      await this.post(`orders/${externalId}/invoice`, { capture: true, notify: true })
      return { externalId }
    }
    if (externalId && method === "ship") {
      await this.post(`orders/${externalId}/ship`, data)
      return { externalId }
    }
    if (externalId && method === "cancel") {
      await this.post(`orders/${externalId}/cancel`, {})
      return { externalId }
    }
    if (externalId && method === "comment") {
      await this.post(`orders/${externalId}/comments`, { statusHistory: data })
      return { externalId }
    }
    const result = await this.post("orders", { entity: data })
    return { externalId: String(result.entity_id ?? "") }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenCustomAttributes(obj: Record<string, any>): Record<string, unknown> {
  const { custom_attributes, ...rest } = obj
  const flat: Record<string, unknown> = { ...rest }
  if (Array.isArray(custom_attributes)) {
    for (const attr of custom_attributes) flat[attr.attribute_code] = attr.value
  }
  return flat
}

/** Split canonical data into base fields (non-locale) and detect if any locale keys exist */
function splitLocaleFields(
  data: Record<string, unknown>,
  localeFieldNames: string[],
  storeViews: MagentoStoreView[],
): { categoryData: Record<string, unknown>; hasLocale: boolean } {
  const localeSuffixes = new Set(storeViews.map((sv) => sv.code))
  const categoryData: Record<string, unknown> = {}
  let hasLocale = false

  for (const [key, value] of Object.entries(data)) {
    // Detect keys like "name_el", "description_el" etc.
    const parts = key.split("_")
    if (parts.length >= 2) {
      const suffix = parts[parts.length - 1]
      const base = parts.slice(0, -1).join("_")
      if (localeSuffixes.has(suffix) && localeFieldNames.includes(base)) {
        hasLocale = true
        continue // don't include locale key in base payload
      }
    }
    categoryData[key] = value
  }

  return { categoryData, hasLocale }
}
