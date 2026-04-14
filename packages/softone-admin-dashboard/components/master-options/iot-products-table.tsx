"use client"

import { useState, useTransition, useMemo } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as Checkbox from "@radix-ui/react-checkbox"
import {
  Plus, X, Search, MoreHorizontal, Check,
  ChevronUp, ChevronDown, ChevronsUpDown, Columns3,
  Trash2, ChevronLeft, ChevronRight, FileSpreadsheet,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { useTablePrefs, PAGE_SIZES, type ColDef, type PageSize } from "@/hooks/use-table-prefs"
import {
  createIotProduct, updateIotProduct,
  deleteIotProduct, deleteIotProducts,
  type IotProductRow,
} from "@/app/(dashboard)/master-options/iot-products/actions"
import type { IotTech } from "@prisma/client"

// ─── Constants ────────────────────────────────────────────────────────────────

const IOT_TECHS: IotTech[] = ["LORAWAN", "AI_VISION", "WIFI_HALOW", "FIVE_G"]

const TECH_LABELS: Record<IotTech, string> = {
  LORAWAN:    "LoRaWAN",
  AI_VISION:  "AI Vision",
  WIFI_HALOW: "Wi-Fi HaLow",
  FIVE_G:     "5G AIoT",
}

const TECH_COLORS: Record<IotTech, { bg: string; fg: string }> = {
  LORAWAN:    { bg: "#dbeafe", fg: "#1d4ed8" },
  AI_VISION:  { bg: "#fdf4ff", fg: "#7e22ce" },
  WIFI_HALOW: { bg: "#d1fae5", fg: "#065f46" },
  FIVE_G:     { bg: "#ffedd5", fg: "#c2410c" },
}

const COLUMNS: ColDef[] = [
  { key: "modelName",   label: "Model",       sortable: true, defaultVisible: true, alwaysVisible: true },
  { key: "category",    label: "Category",    sortable: true, defaultVisible: true },
  { key: "technology",  label: "Technology",  sortable: true, defaultVisible: true },
  { key: "description", label: "Description", sortable: false, defaultVisible: true },
]

const DEFAULT_COL_WIDTHS: Record<string, number> = { modelName: 160, category: 220, technology: 130, description: 300 }

type SortDir = "asc" | "desc"
type CategoryOption = { id: number; name: string }

// ─── Primitives ───────────────────────────────────────────────────────────────

function TechBadge({ tech }: { tech: IotTech }) {
  const c = TECH_COLORS[tech]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: c.bg, color: c.fg }}>
      {TECH_LABELS[tech]}
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

function AddProductDialog({ categories, onSuccess }: {
  categories: CategoryOption[]; onSuccess: (p: IotProductRow) => void
}) {
  const [open, setOpen]           = useState(false)
  const [modelName, setModelName] = useState("")
  const [description, setDesc]    = useState("")
  const [technology, setTech]     = useState<IotTech>("LORAWAN")
  const [categoryId, setCatId]    = useState<number>(categories[0]?.id ?? 0)
  const [error, setError]         = useState("")
  const [pending, start]          = useTransition()

  function reset() { setModelName(""); setDesc(""); setTech("LORAWAN"); setCatId(categories[0]?.id ?? 0); setError("") }
  function close() { reset(); setOpen(false) }

  function submit() {
    if (!modelName.trim()) { setError("Model name is required"); return }
    if (!categoryId)       { setError("Category is required"); return }
    start(async () => {
      const res = await createIotProduct({ modelName, description, technology, categoryId })
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
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Add IoT product</h2>
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
                  style={{ color: "var(--foreground-muted)" }}>Model name *</label>
                <input value={modelName} onChange={e => setModelName(e.target.value)}
                  placeholder="e.g. AM307" className="input-field"
                  onKeyDown={e => e.key === "Enter" && submit()} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-muted)" }}>Description</label>
                <input value={description} onChange={e => setDesc(e.target.value)}
                  placeholder="e.g. 7-in-1 IAQ Sensor with E-ink" className="input-field" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-muted)" }}>Category *</label>
                <select value={categoryId} onChange={e => setCatId(Number(e.target.value))} className="input-field">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-muted)" }}>Technology</label>
                <select value={technology} onChange={e => setTech(e.target.value as IotTech)} className="input-field">
                  {IOT_TECHS.map(t => <option key={t} value={t}>{TECH_LABELS[t]}</option>)}
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

function EditDialog({ product, categories, onSuccess, onClose }: {
  product: IotProductRow; categories: CategoryOption[]
  onSuccess: (p: IotProductRow) => void; onClose: () => void
}) {
  const [modelName, setModelName] = useState(product.modelName)
  const [description, setDesc]    = useState(product.description ?? "")
  const [technology, setTech]     = useState<IotTech>(product.technology)
  const [categoryId, setCatId]    = useState<number>(product.categoryId)
  const [error, setError]         = useState("")
  const [pending, start]          = useTransition()

  function submit() {
    if (!modelName.trim()) { setError("Model name is required"); return }
    start(async () => {
      const res = await updateIotProduct(product.id, { modelName, description, technology, categoryId })
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
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Edit IoT product</h2>
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
              style={{ color: "var(--foreground-muted)" }}>Model name *</label>
            <input value={modelName} onChange={e => setModelName(e.target.value)} className="input-field"
              onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-muted)" }}>Description</label>
            <input value={description} onChange={e => setDesc(e.target.value)} className="input-field" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-muted)" }}>Category</label>
            <select value={categoryId} onChange={e => setCatId(Number(e.target.value))} className="input-field">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-muted)" }}>Technology</label>
            <select value={technology} onChange={e => setTech(e.target.value as IotTech)} className="input-field">
              {IOT_TECHS.map(t => <option key={t} value={t}>{TECH_LABELS[t]}</option>)}
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

function ColumnPicker({ visibleCols, onToggle }: { visibleCols: Set<string>; onToggle: (key: string) => void }) {
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

export function IotProductsTable({ initialProducts, categories }: {
  initialProducts: IotProductRow[]; categories: CategoryOption[]
}) {
  const [products, setProducts]   = useState<IotProductRow[]>(initialProducts)
  const [search, setSearch]       = useState("")
  const [filterCat, setFilterCat] = useState<number | "all">("all")
  const [filterTech, setFilterTech] = useState<IotTech | "all">("all")
  const [sortKey, setSortKey]     = useState<string>("category")
  const [sortDir, setSortDir]     = useState<SortDir>("asc")
  const [page, setPage]           = useState(1)
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [editing, setEditing]     = useState<IotProductRow | null>(null)
  const [, start]                 = useTransition()

  const { visibleCols, toggleCol, pageSize, setPageSize, hydrated } =
    useTablePrefs("iot-products", COLUMNS, 25, DEFAULT_COL_WIDTHS)

  const filtered = useMemo(() => {
    let rows = products
    if (filterCat !== "all") rows = rows.filter(r => r.categoryId === filterCat)
    if (filterTech !== "all") rows = rows.filter(r => r.technology === filterTech)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.modelName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.category.name.toLowerCase().includes(q) ||
        TECH_LABELS[r.technology].toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => {
      const av = sortKey === "category" ? a.category.name
        : sortKey === "technology" ? TECH_LABELS[a.technology]
        : sortKey === "description" ? (a.description ?? "")
        : a.modelName
      const bv = sortKey === "category" ? b.category.name
        : sortKey === "technology" ? TECH_LABELS[b.technology]
        : sortKey === "description" ? (b.description ?? "")
        : b.modelName
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [products, search, filterCat, filterTech, sortKey, sortDir])

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
      const res = await deleteIotProduct(id)
      if (!res.error) setProducts(prev => prev.filter(p => p.id !== id))
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selected)
    start(async () => {
      const res = await deleteIotProducts(ids)
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
                <div className="relative max-w-[200px] w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
                    style={{ color: "var(--foreground-subtle)" }} />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Search products…" style={{ paddingLeft: 32 }} className="input-field" />
                </div>
                <select value={filterCat === "all" ? "all" : String(filterCat)}
                  onChange={e => { setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1) }}
                  className="input-field" style={{ width: "auto", minWidth: 180 }}>
                  <option value="all">All categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={filterTech}
                  onChange={e => { setFilterTech(e.target.value as IotTech | "all"); setPage(1) }}
                  className="input-field" style={{ width: "auto", minWidth: 130 }}>
                  <option value="all">All technologies</option>
                  {IOT_TECHS.map(t => <option key={t} value={t}>{TECH_LABELS[t]}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hydrated && <ColumnPicker visibleCols={visibleCols} onToggle={toggleCol} />}
            <a href="/import" title="Import IoT devices from Excel">
              <Btn variant="ghost" size="sm">
                <FileSpreadsheet className="size-3.5 mr-1" />Import from Excel
              </Btn>
            </a>
            <AddProductDialog categories={categories}
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
                    {col.sortable ? (
                      <button onClick={() => toggleSort(col.key)}
                        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider select-none"
                        style={{ color: sortKey === col.key ? "var(--foreground)" : "var(--foreground-muted)" }}>
                        {col.label}
                        {sortKey === col.key
                          ? sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                          : <ChevronsUpDown className="size-3 opacity-30" />}
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--foreground-muted)" }}>{col.label}</span>
                    )}
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
                    {search || filterCat !== "all" || filterTech !== "all"
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
                    {visibleCols.has("modelName") && (
                      <td className="px-4 py-3.5 font-medium truncate"
                        style={{ color: "var(--foreground)" }}>{product.modelName}</td>
                    )}
                    {visibleCols.has("category") && (
                      <td className="px-4 py-3.5 text-[13px] truncate"
                        style={{ color: "var(--foreground-muted)" }}>{product.category.name}</td>
                    )}
                    {visibleCols.has("technology") && (
                      <td className="px-4 py-3.5"><TechBadge tech={product.technology} /></td>
                    )}
                    {visibleCols.has("description") && (
                      <td className="px-4 py-3.5 text-[13px] truncate"
                        style={{ color: "var(--foreground-muted)" }}>{product.description ?? "—"}</td>
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
          product={editing} categories={categories}
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
