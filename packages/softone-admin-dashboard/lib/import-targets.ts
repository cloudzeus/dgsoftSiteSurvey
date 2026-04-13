// Field templates for each supported connection type.
// Used by the Excel Import Wizard to let users map Excel columns → service fields.

export type TargetField = {
  key: string
  label: string
  description?: string
  required?: boolean
  type?: "text" | "number" | "date" | "boolean"
}

export type TargetObject = {
  key: string
  label: string
  description?: string
  fields: TargetField[]
}

// ─── Softone ERP ──────────────────────────────────────────────────────────────

const SOFTONE_TRDR: TargetObject = {
  key: "TRDR",
  label: "Customers / Suppliers",
  description: "Trade partners — customers, suppliers, employees",
  fields: [
    { key: "CODE",       label: "Code",          required: true,  type: "text" },
    { key: "NAME",       label: "Name",           required: true,  type: "text" },
    { key: "AFM",        label: "VAT Number",                      type: "text" },
    { key: "DOY",        label: "Tax Office",                      type: "text" },
    { key: "ADDRESS",    label: "Address",                         type: "text" },
    { key: "CITY",       label: "City",                            type: "text" },
    { key: "ZIP",        label: "ZIP Code",                        type: "text" },
    { key: "PHONE01",    label: "Phone 1",                         type: "text" },
    { key: "PHONE02",    label: "Phone 2",                         type: "text" },
    { key: "FAX",        label: "Fax",                             type: "text" },
    { key: "EMAIL",      label: "Email",                           type: "text" },
    { key: "WEB",        label: "Website",                         type: "text" },
    { key: "TRDRTYPE",   label: "Partner Type",                    type: "number" },
    { key: "CONTACT",    label: "Contact Person",                  type: "text" },
    { key: "NOTES",      label: "Notes",                           type: "text" },
    { key: "COUNTRY",    label: "Country Code",                    type: "text" },
    { key: "REGION",     label: "Region",                          type: "text" },
  ],
}

const SOFTONE_MTRL: TargetObject = {
  key: "MTRL",
  label: "Products / Materials",
  description: "Inventory items, products, raw materials (MTRL object)",
  fields: [
    // ── Identity ────────────────────────────────────────────────────────────
    { key: "CODE",          label: "Code",                required: true,  type: "text",   description: "Internal item code" },
    { key: "NAME",          label: "Name",                required: true,  type: "text",   description: "Item name / description" },
    { key: "UNIT1",         label: "Base Unit",           required: true,  type: "text",   description: "Primary unit of measure (e.g. ΤΕΜ)" },
    { key: "CODE1",         label: "Barcode / EAN",                        type: "text",   description: "Barcode or EAN-13" },
    { key: "CODE2",         label: "Alt Code 2",                           type: "text",   description: "Second alternative code" },
    { key: "CODE3",         label: "Alt Code 3",                           type: "text",   description: "Third alternative code (e.g. manufacturer code)" },
    { key: "ALTCODE",       label: "Alt Code",                             type: "text",   description: "General alternative code" },
    { key: "PERIGRAFI",     label: "Extended Description",                 type: "text",   description: "Long description / detailed info" },

    // ── Classification ───────────────────────────────────────────────────────
    { key: "MTRTP",         label: "Item Type",                            type: "number", description: "0=Goods, 1=Service, 2=Expense, 3=Fixed Asset" },
    { key: "MTRCATEGORY",   label: "Category",                             type: "text",   description: "Item category code (MTRCATEGORY.CODE)" },
    { key: "VATCATEGORY",   label: "VAT Category",                         type: "number", description: "VAT category ID" },
    { key: "COUNTRY",       label: "Country of Origin",                    type: "text",   description: "ISO country code (e.g. GR, DE)" },

    // ── Units & Conversion ───────────────────────────────────────────────────
    { key: "UNIT2",         label: "Secondary Unit",                       type: "text",   description: "Second unit of measure" },
    { key: "MLTP2",         label: "Conversion Factor (Unit2)",            type: "number", description: "How many Unit1 = 1 Unit2" },
    { key: "UNIT3",         label: "Tertiary Unit",                        type: "text",   description: "Third unit of measure" },
    { key: "MLTP3",         label: "Conversion Factor (Unit3)",            type: "number", description: "How many Unit1 = 1 Unit3" },

    // ── Pricing ──────────────────────────────────────────────────────────────
    { key: "PRICE",         label: "Retail Price",                         type: "number", description: "Default sale price (price list 1)" },
    { key: "BUYPRICE",      label: "Purchase Price",                       type: "number", description: "Default purchase / cost price" },
    { key: "VPRICE01",      label: "Price List 1",                         type: "number" },
    { key: "VPRICE02",      label: "Price List 2",                         type: "number" },
    { key: "VPRICE03",      label: "Price List 3",                         type: "number" },
    { key: "VPRICE04",      label: "Price List 4",                         type: "number" },
    { key: "VPRICE05",      label: "Price List 5",                         type: "number" },

    // ── Physical Characteristics ─────────────────────────────────────────────
    { key: "WEIGHT",        label: "Weight (kg)",                          type: "number" },
    { key: "VOLUME",        label: "Volume (L)",                           type: "number" },
    { key: "LENGTH",        label: "Length (m)",                           type: "number" },
    { key: "WIDTH",         label: "Width (m)",                            type: "number" },
    { key: "HEIGHT",        label: "Height (m)",                           type: "number" },
    { key: "SURFACE",       label: "Surface (m²)",                         type: "number" },
    { key: "DIAMETER",      label: "Diameter (m)",                         type: "number" },
    { key: "THICKNESS",     label: "Thickness (m)",                        type: "number" },
    { key: "COLOR",         label: "Color",                                type: "text" },
    { key: "SIZE",          label: "Size",                                 type: "text" },

    // ── Stock Settings ───────────────────────────────────────────────────────
    { key: "MINSTOCK",      label: "Min Stock",                            type: "number", description: "Minimum stock level" },
    { key: "MAXSTOCK",      label: "Max Stock",                            type: "number", description: "Maximum stock level" },
    { key: "SAFSTOCK",      label: "Safety Stock",                         type: "number" },
    { key: "REORDER",       label: "Reorder Point",                        type: "number" },
    { key: "LEADTIME",      label: "Lead Time (days)",                     type: "number" },
    { key: "STORAGE",       label: "Storage Location",                     type: "text" },
    { key: "SHELF",         label: "Shelf / Position",                     type: "text" },

    // ── Accounting ───────────────────────────────────────────────────────────
    { key: "ACC63",         label: "Purchases Account (63)",               type: "text",   description: "GL account for purchases" },
    { key: "ACC70",         label: "Sales Account (70)",                   type: "text",   description: "GL account for retail sales" },
    { key: "ACC73",         label: "Wholesale Account (73)",               type: "text",   description: "GL account for wholesale sales" },
    { key: "ACC64",         label: "Returns Account (64)",                 type: "text" },

    // ── Supplier ─────────────────────────────────────────────────────────────
    { key: "MAINSUPP",      label: "Main Supplier Code",                   type: "text",   description: "TRDR.CODE of the main supplier" },
    { key: "SUPPLIERCODE",  label: "Supplier Item Code",                   type: "text",   description: "The supplier's own code for this item" },

    // ── Flags ────────────────────────────────────────────────────────────────
    { key: "ACTIVE",        label: "Active",                               type: "boolean", description: "1=active, 0=inactive" },
    { key: "ISWEB",         label: "Visible on Web",                       type: "boolean", description: "1=publish to e-shop" },
    { key: "ISPOS",         label: "POS Item",                             type: "boolean" },
    { key: "PICKLIST",      label: "Pick List",                            type: "boolean" },

    // ── Web / Notes ──────────────────────────────────────────────────────────
    { key: "WEBNAME",       label: "Web Name",                             type: "text" },
    { key: "WEBDESCRIPTION",label: "Web Description",                      type: "text" },
    { key: "METATITLE",     label: "Meta Title",                           type: "text" },
    { key: "METADESCRIPTION",label: "Meta Description",                    type: "text" },
    { key: "KEYWORDS",      label: "Keywords",                             type: "text" },
    { key: "NOTES",         label: "Notes",                                type: "text" },
  ],
}

const SOFTONE_FINDOC: TargetObject = {
  key: "FINDOC",
  label: "Financial Documents",
  description: "Invoices, credit notes, receipts",
  fields: [
    { key: "SERIES",     label: "Series",        required: true,  type: "text" },
    { key: "TRDR",       label: "Partner Code",  required: true,  type: "text" },
    { key: "FPRMS",      label: "Doc Number",                     type: "text" },
    { key: "SODATE",     label: "Document Date",                  type: "date" },
    { key: "REMARK",     label: "Remarks",                        type: "text" },
    { key: "LINEAMNT",   label: "Line Amount",                    type: "number" },
    { key: "LINECODE",   label: "Line Product Code",              type: "text" },
    { key: "LINENAME",   label: "Line Description",               type: "text" },
    { key: "LINEQTY",    label: "Quantity",                       type: "number" },
    { key: "LINEUNIT",   label: "Unit",                           type: "text" },
    { key: "LINEPRICE",  label: "Unit Price",                     type: "number" },
    { key: "LINEVAT",    label: "VAT %",                          type: "number" },
  ],
}

// ─── Shopify ──────────────────────────────────────────────────────────────────

const SHOPIFY_PRODUCTS: TargetObject = {
  key: "products",
  label: "Products",
  fields: [
    { key: "title",          label: "Title",          required: true, type: "text" },
    { key: "body_html",      label: "Description",                    type: "text" },
    { key: "vendor",         label: "Vendor",                        type: "text" },
    { key: "product_type",   label: "Product Type",                  type: "text" },
    { key: "tags",           label: "Tags",                          type: "text" },
    { key: "status",         label: "Status (active/draft)",         type: "text" },
    { key: "variants.price", label: "Price",          required: true, type: "number" },
    { key: "variants.sku",   label: "SKU",                           type: "text" },
    { key: "variants.barcode",label: "Barcode",                      type: "text" },
    { key: "variants.inventory_quantity", label: "Stock Qty",        type: "number" },
    { key: "variants.weight",label: "Weight (kg)",                   type: "number" },
  ],
}

const SHOPIFY_CUSTOMERS: TargetObject = {
  key: "customers",
  label: "Customers",
  fields: [
    { key: "first_name",     label: "First Name",    required: true, type: "text" },
    { key: "last_name",      label: "Last Name",     required: true, type: "text" },
    { key: "email",          label: "Email",         required: true, type: "text" },
    { key: "phone",          label: "Phone",                         type: "text" },
    { key: "tags",           label: "Tags",                          type: "text" },
    { key: "note",           label: "Notes",                         type: "text" },
    { key: "addresses.address1", label: "Address",                   type: "text" },
    { key: "addresses.city",     label: "City",                      type: "text" },
    { key: "addresses.zip",      label: "ZIP Code",                  type: "text" },
    { key: "addresses.country",  label: "Country",                   type: "text" },
    { key: "addresses.company",  label: "Company",                   type: "text" },
  ],
}

// ─── WooCommerce ──────────────────────────────────────────────────────────────

const WOO_PRODUCTS: TargetObject = {
  key: "products",
  label: "Products",
  fields: [
    { key: "name",           label: "Name",          required: true, type: "text" },
    { key: "sku",            label: "SKU",                           type: "text" },
    { key: "regular_price",  label: "Regular Price",                 type: "number" },
    { key: "sale_price",     label: "Sale Price",                    type: "number" },
    { key: "description",    label: "Description",                   type: "text" },
    { key: "short_description", label: "Short Description",          type: "text" },
    { key: "stock_quantity", label: "Stock Qty",                     type: "number" },
    { key: "weight",         label: "Weight (kg)",                   type: "number" },
    { key: "categories",     label: "Categories (comma)",            type: "text" },
    { key: "tags",           label: "Tags (comma)",                  type: "text" },
    { key: "status",         label: "Status",                        type: "text" },
  ],
}

const WOO_CUSTOMERS: TargetObject = {
  key: "customers",
  label: "Customers",
  fields: [
    { key: "first_name",     label: "First Name",    required: true, type: "text" },
    { key: "last_name",      label: "Last Name",     required: true, type: "text" },
    { key: "email",          label: "Email",         required: true, type: "text" },
    { key: "username",       label: "Username",                      type: "text" },
    { key: "billing.phone",  label: "Phone",                         type: "text" },
    { key: "billing.address_1", label: "Address",                    type: "text" },
    { key: "billing.city",   label: "City",                          type: "text" },
    { key: "billing.postcode", label: "ZIP Code",                    type: "text" },
    { key: "billing.country", label: "Country",                      type: "text" },
    { key: "billing.company", label: "Company",                      type: "text" },
  ],
}

// ─── Magento ──────────────────────────────────────────────────────────────────

const MAGENTO_PRODUCTS: TargetObject = {
  key: "products",
  label: "Products",
  fields: [
    { key: "sku",                label: "SKU",           required: true, type: "text" },
    { key: "name",               label: "Name",          required: true, type: "text" },
    { key: "price",              label: "Price",         required: true, type: "number" },
    { key: "status",             label: "Status (1=enabled)", type: "number" },
    { key: "type_id",            label: "Type (simple/virtual)", type: "text" },
    { key: "weight",             label: "Weight",                     type: "number" },
    { key: "custom_attributes.description", label: "Description",     type: "text" },
    { key: "custom_attributes.short_description", label: "Short Desc",type: "text" },
  ],
}

const MAGENTO_CUSTOMERS: TargetObject = {
  key: "customers",
  label: "Customers",
  fields: [
    { key: "firstname",      label: "First Name",    required: true, type: "text" },
    { key: "lastname",       label: "Last Name",     required: true, type: "text" },
    { key: "email",          label: "Email",         required: true, type: "text" },
    { key: "group_id",       label: "Customer Group",                type: "number" },
    { key: "dob",            label: "Date of Birth",                 type: "date" },
    { key: "gender",         label: "Gender (1=M, 2=F)",             type: "number" },
    { key: "taxvat",         label: "VAT Number",                    type: "text" },
  ],
}

// ─── Custom REST ──────────────────────────────────────────────────────────────

const CUSTOM_REST_GENERIC: TargetObject = {
  key: "custom",
  label: "Custom Endpoint",
  description: "Define any JSON fields for your REST endpoint",
  fields: [
    { key: "id",     label: "ID / Primary Key",                      type: "text" },
    { key: "name",   label: "Name",                                  type: "text" },
    { key: "code",   label: "Code",                                  type: "text" },
    { key: "email",  label: "Email",                                 type: "text" },
    { key: "phone",  label: "Phone",                                 type: "text" },
    { key: "value",  label: "Value",                                 type: "text" },
    { key: "status", label: "Status",                                type: "text" },
    { key: "notes",  label: "Notes",                                 type: "text" },
  ],
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TARGET_OBJECTS_BY_TYPE: Record<string, TargetObject[]> = {
  SOFTONE:     [SOFTONE_TRDR, SOFTONE_MTRL, SOFTONE_FINDOC],
  SHOPIFY:     [SHOPIFY_PRODUCTS, SHOPIFY_CUSTOMERS],
  WOOCOMMERCE: [WOO_PRODUCTS, WOO_CUSTOMERS],
  MAGENTO:     [MAGENTO_PRODUCTS, MAGENTO_CUSTOMERS],
  CUSTOM_REST: [CUSTOM_REST_GENERIC],
}

export function getTargetObjects(connectionType: string): TargetObject[] {
  return TARGET_OBJECTS_BY_TYPE[connectionType] ?? [CUSTOM_REST_GENERIC]
}

export function getTargetFields(connectionType: string, objectKey: string): TargetField[] {
  const objects = getTargetObjects(connectionType)
  return objects.find(o => o.key === objectKey)?.fields ?? []
}

// Auto-suggest a target field key for a given Excel column name
export function autoMatchField(columnName: string, fields: TargetField[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const col = norm(columnName)
  // Exact match on key or label
  const exact = fields.find(f => norm(f.key) === col || norm(f.label) === col)
  if (exact) return exact.key
  // Partial match
  const partial = fields.find(f => norm(f.key).includes(col) || col.includes(norm(f.key))
    || norm(f.label).includes(col) || col.includes(norm(f.label)))
  if (partial) return partial.key
  return ""
}
