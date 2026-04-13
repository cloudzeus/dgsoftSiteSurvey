"use client"

import { useState, useTransition, useMemo } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as Checkbox from "@radix-ui/react-checkbox"
import {
  Plus, X, Search, MoreHorizontal, Check,
  ChevronUp, ChevronDown, ChevronsUpDown, Columns3,
  Trash2, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { useTablePrefs, PAGE_SIZES, type ColDef, type PageSize } from "@/hooks/use-table-prefs"
import {
  createSoftwareProduct, updateSoftwareProduct,
  deleteSoftwareProduct, deleteSoftwareProducts,
  type SoftwareProductRow,
} from "@/app/(dashboard)/master-options/software-products/actions"
import type { SoftwareType } from "@prisma/client"

// ─── Constants ────────────────────────────────────────────────────────────────

const SOFTWARE_TYPES: SoftwareType[] = [
  "ERP", "CRM", "WMS", "RETAIL", "MOBILE_SFA",
  "E_INVOICING", "E_COMMERCE", "HR_PAYROLL", "BI_ANALYTICS",
  "CYBERSECURITY", "PRODUCTIVITY", "BACKUP", "AI_TOOL",
]

const TYPE_LABELS: Record<SoftwareType, string> = {
  ERP:           "ERP",
  CRM:           "CRM",
  WMS:           "WMS",
  RETAIL:        "Retail",
  MOBILE_SFA:    "Mobile SFA",
  E_INVOICING:   "e-Invoicing",
  E_COMMERCE:    "e-Commerce",
  HR_PAYROLL:    "HR / Payroll",
  BI_ANALYTICS:  "BI / Analytics",
  CYBERSECURITY: "Cybersecurity",
  PRODUCTIVITY:  "Productivity",
  BACKUP:        "Backup",
  AI_TOOL:       "AI Tool",
}

const TYPE_COLORS: Record<SoftwareType, { bg: string; fg: string }> = {
  ERP:           { bg: "#ede9fe", fg: "#6d28d9" },
  CRM:           { bg: "#dbeafe", fg: "#1d4ed8" },
  WMS:           { bg: "#d1fae5", fg: "#065f46" },
  RETAIL:        { bg: "#ffedd5", fg: "#c2410c" },
  MOBILE_SFA:    { bg: "#fef3c7", fg: "#92400e" },
  E_INVOICING:   { bg: "#ecfdf5", fg: "#047857" },
  E_COMMERCE:    { bg: "#f0f9ff", fg: "#0369a1" },
  HR_PAYROLL:    { bg: "#fdf4ff", fg: "#7e22ce" },
  BI_ANALYTICS:  { bg: "#f0fdf4", fg: "#166534" },
  CYBERSECURITY: { bg: "#fce7f3", fg: "#9d174d" },
  PRODUCTIVITY:  { bg: "#f8fafc", fg: "#475569" },
  BACKUP:        { bg: "#fff7ed", fg: "#9a3412" },
  AI_TOOL:       { bg: "#f0fdf4", fg: "#166534" },
}

const COLUMNS: ColDef[] = [
  { key: "name",   label: "Product",  sortable: true, defaultVisible: true, alwaysVisible: true },
  { key: "vendor", label: "Vendor",   sortable: true, defaultVisible: true },
  { key: "type",   label: "Type",     sortable: true, defaultVisible: true },
]

const DEFAULT_COL_WIDTHS: Record<string, number> = { name: 280, vendor: 160, type: 160 }

type SortDir = "asc" | "desc"
type VendorOption = { id: number; name: string }

// ─── Primitives ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: SoftwareType }) {
  const c = TYPE_COLORS[type]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: c.bg, color: c.fg }}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function RowCheckbox({ checked, onCheckedChange }: {
  checked: boolean | "indeterminate"; onCheckedChange: (v: boolean) => void
}) {
  return (
    <Checkbox.Root checked={checked} onCheckedChange={v => onCheckedChange(v === true)}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer",
        outline: "none", display: "flex", alignItems: "center", justifyContent: "center",
        border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
        background: checked ? "var(--primary)" : "transparent",
        transition: "background 120ms, border-color 120ms",
      }}>
      <Checkbox.Indicator>
        {checked === "indeterminate"
          ? <span style={{ width: 8, height: 2, background: "white", display: "block", borderRadius: 1 }} />
          : <Check className="size-2.5 text-white" strokeWidth={3} />}
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

// ─── Add dialog ───────────────────────────────────────────────────────────────

function AddProductDialog({ vendors, onSuccess }: {
  vendors: VendorOption[]; onSuccess: (p: SoftwareProductRow) => void
}) {
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState("")
  const [type, setType]         = useState<SoftwareType>("ERP")
  const [vendorId, setVendorId] = useState<number>(vendors[0]?.id ?? 0)
  const [error, setError]       = useState("")
  const [pending, start]        = useTransition()

  function reset() { setName(""); setType("ERP"); setVendorId(vendors[0]?.id ?? 0); setError("") }
  function close() { reset(); setOpen(false) }

  function submit() {
    if (!name.trim())  { setError("Name is required"); return }
    if (!vendorId)     { setError("Vendor is required"); return }
    start(async () => {
      const res = await createSoftwareProduct({ name, type, vendorId })
      if (res.error) { setError(res.error); return }
      onSuccess(res.product!)
      close()
    })
  }

  return (
    <>
      <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5 mr-1" />Add product
      </Btn>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", zIndex: 200 }}>
          <div className="modal-card w-full max-w-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Add software product</h2>
              <button onClick={close} className="p-1 rounded-md"
                style={{ color: "var(--foreground-muted)" }}><X className="size-4" /></button>
            </div>

            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg"
                style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>{error}</p>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-muted)" }}>Product name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Soft1 ERP" className="input-field"
                  onKeyDown={e => e.key === "Enter" && submit()} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-muted)" }}>Vendor *</label>
                <select value={vendorId} onChange={e => setVendorId(Number(e.target.value))}
                  className="input-field">
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-muted)" }}>Type</label>
                <select value={type} onChange={e => setType(e.target.value as SoftwareType)}
                  className="input-field">
                  {SOFTWARE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Btn variant="secondary" size="sm" onClick={close}>Cancel</Btn>
              <Btn variant="primary" size="sm" loading={pending} onClick={submit}>Create</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({ product, vendors, onSuccess, onClose }: {
  product: SoftwareProductRow; vendors: VendorOption[]
  onSuccess: (p: SoftwareProductRow) => void; onClose: () => void
}) {
  const [name, setName]         = useState(product.name)
  const [type, setType]         = useState<SoftwareType>(product.type)
  const [vendorId, setVendorId] = useState<number>(product.vendorId)
  const [error, setError]       = useState("")
  const [pending, start]        = useTransition()

  function submit() {
    if (!name.trim()) { setError("Name is required"); return }
    start(async () => {
      const res = await updateSoftwareProduct(product.id, { name, type, vendorId })
      if (res.error) { setError(res.error); return }
      onSuccess(res.product!)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", zIndex: 200 }}>
      <div className="modal-card w-full max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Edit software product</h2>
          <button onClick={onClose} className="p-1 rounded-md"
            style={{ color: "var(--foreground-muted)" }}><X className="size-4" /></button>
        </div>

        {error && (
          <p className="text-[12px] px-3 py-2 rounded-lg"
            style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>{error}</p>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-muted)" }}>Product name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field"
              onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-muted)" }}>Vendor</label>
            <select value={vendorId} onChange={e => setVendorId(Number(e.target.value))}
              className="input-field">
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-muted)" }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as SoftwareType)}
              className="input-field">
              {SOFTWARE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" size="sm" loading={pending} onClick={submit}>Save</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Column picker ────────────────────────────────────────────────────────────

function ColumnPicker({ visibleCols, onToggle }: {
  visibleCols: Set<string>; onToggle: (key: string) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-lg text-[12px] font-medium"
          style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--foreground-muted)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <Columns3 className="size-3.5" />Columns
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4}
          style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: 6, minWidth: 160, zIndex: 100 }}>
          {COLUMNS.filter(c => !c.alwaysVisible).map(col => (
            <DropdownMenu.Item key={col.key}
              onSelect={e => { e.preventDefault(); onToggle(col.key) }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer select-none outline-none"
              style={{ color: "var(--foreground)" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
              <Check className="size-3.5"
                style={{ opacity: visibleCols.has(col.key) ? 1 : 0, color: "var(--primary)" }} />
              {col.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function SoftwareProductsTable({ initialProducts, vendors }: {
  initialProducts: SoftwareProductRow[]; vendors: VendorOption[]
}) {
  const [products, setProducts] = useState<SoftwareProductRow[]>(initialProducts)
  const [search, setSearch]     = useState("")
  const [filterVendor, setFilterVendor] = useState<number | "all">("all")
  const [sortKey, setSortKey]   = useState<string>("vendor")
  const [sortDir, setSortDir]   = useState<SortDir>("asc")
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editing, setEditing]   = useState<SoftwareProductRow | null>(null)
  const [, start]               = useTransition()

  const { visibleCols, toggleCol, pageSize, setPageSize, hydrated } =
    useTablePrefs("software-products", COLUMNS, 25, DEFAULT_COL_WIDTHS)

  const filtered = useMemo(() => {
    let rows = products
    if (filterVendor !== "all") rows = rows.filter(r => r.vendorId === filterVendor)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.vendor.name.toLowerCase().includes(q) ||
        TYPE_LABELS[r.type].toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => {
      const av = sortKey === "vendor" ? a.vendor.name : sortKey === "type" ? TYPE_LABELS[a.type] : a.name
      const bv = sortKey === "vendor" ? b.vendor.name : sortKey === "type" ? TYPE_LABELS[b.type] : b.name
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [products, search, filterVendor, sortKey, sortDir])

  const totalPages      = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage        = Math.min(page, totalPages)
  const pageRows        = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
  const someSelected    = pageRows.some(r => selected.has(r.id))

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
    setPage(1)
  }

  function handleDelete(id: number) {
    start(async () => {
      const res = await deleteSoftwareProduct(id)
      if (!res.error) setProducts(prev => prev.filter(p => p.id !== id))
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selected)
    start(async () => {
      const res = await deleteSoftwareProducts(ids)
      if (!res.error) { setProducts(prev => prev.filter(p => !ids.includes(p.id))); setSelected(new Set()) }
    })
  }

  const visibleColDefs = COLUMNS.filter(c => visibleCols.has(c.key))

  return (
    <>
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {selected.size > 0 ? (
              <>
                <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                  {selected.size} selected
                </span>
                <button onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
                  style={{ background: "var(--danger-light)", color: "var(--danger-fg)", border: "1px solid #fca5a5" }}>
                  <Trash2 className="size-3.5" />Delete selected
                </button>
                <button onClick={() => setSelected(new Set())} className="text-[12px]"
                  style={{ color: "var(--foreground-muted)" }}>Clear</button>
              </>
            ) : (
              <>
                <div className="relative max-w-[220px] w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
                    style={{ color: "var(--foreground-subtle)" }} />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Search products…" style={{ paddingLeft: 32 }} className="input-field" />
                </div>
                <select value={filterVendor === "all" ? "all" : String(filterVendor)}
                  onChange={e => { setFilterVendor(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1) }}
                  className="input-field" style={{ width: "auto", minWidth: 130 }}>
                  <option value="all">All vendors</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hydrated && <ColumnPicker visibleCols={visibleCols} onToggle={toggleCol} />}
            <AddProductDialog vendors={vendors}
              onSuccess={p => { setProducts(prev => [p, ...prev]); setPage(1) }} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="text-[13px]"
            style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: 44 }} />
              {visibleColDefs.map(col => (
                <col key={col.key} style={{ width: DEFAULT_COL_WIDTHS[col.key] ?? 160 }} />
              ))}
              <col style={{ width: 44 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
                <th className="pl-4 pr-2 py-3">
                  <RowCheckbox
                    checked={allPageSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={v => {
                      if (v) setSelected(prev => new Set([...prev, ...pageRows.map(r => r.id)]))
                      else setSelected(prev => { const n = new Set(prev); pageRows.forEach(r => n.delete(r.id)); return n })
                    }} />
                </th>
                {visibleColDefs.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider select-none"
                      style={{ color: sortKey === col.key ? "var(--foreground)" : "var(--foreground-muted)" }}>
                      {col.label}
                      {sortKey === col.key
                        ? sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                        : <ChevronsUpDown className="size-3 opacity-30" />}
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColDefs.length + 2}
                    className="px-4 py-14 text-center text-[13px]"
                    style={{ color: "var(--foreground-muted)" }}>
                    {search || filterVendor !== "all"
                      ? "No products match your filters"
                      : "No products yet — add one above"}
                  </td>
                </tr>
              ) : pageRows.map((product, i) => {
                const isSel = selected.has(product.id)
                return (
                  <tr key={product.id}
                    style={{
                      borderBottom: i < pageRows.length - 1 ? "1px solid var(--border)" : "none",
                      background: isSel ? "var(--primary-light)" : "transparent",
                    }}
                    onDoubleClick={() => setEditing(product)}>
                    <td className="pl-4 pr-2 py-3.5">
                      <RowCheckbox checked={isSel}
                        onCheckedChange={v => setSelected(prev => {
                          const n = new Set(prev); v ? n.add(product.id) : n.delete(product.id); return n
                        })} />
                    </td>
                    {visibleCols.has("name") && (
                      <td className="px-4 py-3.5 font-medium truncate"
                        style={{ color: "var(--foreground)" }}>{product.name}</td>
                    )}
                    {visibleCols.has("vendor") && (
                      <td className="px-4 py-3.5 text-[13px]"
                        style={{ color: "var(--foreground-muted)" }}>{product.vendor.name}</td>
                    )}
                    {visibleCols.has("type") && (
                      <td className="px-4 py-3.5"><TypeBadge type={product.type} /></td>
                    )}
                    <td className="px-3 py-3.5">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="p-1.5 rounded-md"
                            style={{ color: "var(--foreground-muted)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content align="end" sideOffset={4}
                            style={{ background: "var(--surface)", border: "1px solid var(--border)",
                              borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
                              padding: 6, minWidth: 140, zIndex: 100 }}>
                            <DropdownMenu.Item onSelect={() => setEditing(product)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer select-none outline-none"
                              style={{ color: "var(--foreground)" }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                              Edit
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                            <DropdownMenu.Item onSelect={() => handleDelete(product.id)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer select-none outline-none"
                              style={{ color: "var(--danger)" }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--danger-light)")}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 gap-4"
            style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              <span>Rows per page</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value) as PageSize); setPage(1) }}
                className="input-field" style={{ width: "auto", padding: "3px 8px", fontSize: 12 }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              <span>
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
              </span>
              <button onClick={() => setPage(p => p - 1)} disabled={safePage <= 1} className="p-1 rounded"
                style={{ color: safePage <= 1 ? "var(--foreground-subtle)" : "var(--foreground-muted)", cursor: safePage <= 1 ? "not-allowed" : "pointer" }}>
                <ChevronLeft className="size-4" />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={safePage >= totalPages} className="p-1 rounded"
                style={{ color: safePage >= totalPages ? "var(--foreground-subtle)" : "var(--foreground-muted)", cursor: safePage >= totalPages ? "not-allowed" : "pointer" }}>
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditDialog
          product={editing} vendors={vendors}
          onSuccess={updated => setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onClose={() => setEditing(null)}
        />
      )}

      <style>{`
        .input-field {
          width: 100%;
          padding: 7px 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-strong);
          background: var(--background);
          color: var(--foreground);
          font-size: 13px;
          outline: none;
          transition: border-color 150ms;
        }
        .input-field:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 12%, transparent);
        }
        .input-field::placeholder { color: var(--foreground-subtle); }
        .modal-card {
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-xl);
          border-radius: var(--radius-xl);
          padding: 24px;
        }
      `}</style>
    </>
  )
}
