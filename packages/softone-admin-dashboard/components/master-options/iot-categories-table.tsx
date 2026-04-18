"use client"

import { useState, useTransition, useMemo } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as Checkbox from "@radix-ui/react-checkbox"
import {
  Plus, X, Search, MoreHorizontal, Check,
  ChevronUp, ChevronDown, ChevronsUpDown,
  Trash2, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { useTablePrefs, PAGE_SIZES, type ColDef, type PageSize } from "@/hooks/use-table-prefs"
import {
  createIotCategory, updateIotCategory,
  deleteIotCategory, deleteIotCategories,
  type IotCategoryRow,
} from "@/app/[locale]/(dashboard)/master-options/iot-categories/actions"

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: "name",     label: "Category",  sortable: true, defaultVisible: true, alwaysVisible: true },
  { key: "products", label: "Products",  sortable: true, defaultVisible: true },
]

const DEFAULT_COL_WIDTHS: Record<string, number> = { name: 340, products: 120 }

type SortDir = "asc" | "desc"

// ─── Primitives ───────────────────────────────────────────────────────────────

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

function AddCategoryDialog({ onSuccess }: { onSuccess: (c: IotCategoryRow) => void }) {
  const [open, setOpen]   = useState(false)
  const [name, setName]   = useState("")
  const [error, setError] = useState("")
  const [pending, start]  = useTransition()

  function reset() { setName(""); setError("") }
  function close() { reset(); setOpen(false) }

  function submit() {
    if (!name.trim()) { setError("Name is required"); return }
    start(async () => {
      const res = await createIotCategory({ name })
      if (res.error) { setError(res.error); return }
      onSuccess(res.category!)
      close()
    })
  }

  return (
    <>
      <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5 mr-1" />Add category
      </Btn>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", zIndex: 200 }}>
          <div className="modal-card w-full max-w-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Add IoT category</h2>
              <button onClick={close} className="p-1 rounded-md"
                style={{ color: "var(--foreground-muted)" }}><X className="size-4" /></button>
            </div>

            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg"
                style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>{error}</p>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--foreground-muted)" }}>Category name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. LoRaWAN Gateways" className="input-field"
                onKeyDown={e => e.key === "Enter" && submit()} />
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

function EditDialog({ category, onSuccess, onClose }: {
  category: IotCategoryRow; onSuccess: (c: IotCategoryRow) => void; onClose: () => void
}) {
  const [name, setName]   = useState(category.name)
  const [error, setError] = useState("")
  const [pending, start]  = useTransition()

  function submit() {
    if (!name.trim()) { setError("Name is required"); return }
    start(async () => {
      const res = await updateIotCategory(category.id, { name })
      if (res.error) { setError(res.error); return }
      onSuccess(res.category!)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", zIndex: 200 }}>
      <div className="modal-card w-full max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Edit IoT category</h2>
          <button onClick={onClose} className="p-1 rounded-md"
            style={{ color: "var(--foreground-muted)" }}><X className="size-4" /></button>
        </div>

        {error && (
          <p className="text-[12px] px-3 py-2 rounded-lg"
            style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>{error}</p>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--foreground-muted)" }}>Category name *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field"
            onKeyDown={e => e.key === "Enter" && submit()} />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" size="sm" loading={pending} onClick={submit}>Save</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function IotCategoriesTable({ initialCategories }: { initialCategories: IotCategoryRow[] }) {
  const [categories, setCategories] = useState<IotCategoryRow[]>(initialCategories)
  const [search, setSearch]         = useState("")
  const [sortKey, setSortKey]       = useState<string>("name")
  const [sortDir, setSortDir]       = useState<SortDir>("asc")
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Set<number>>(new Set())
  const [editing, setEditing]       = useState<IotCategoryRow | null>(null)
  const [, start]                   = useTransition()

  const { pageSize, setPageSize } =
    useTablePrefs("iot-categories", COLUMNS, 25, DEFAULT_COL_WIDTHS)

  const filtered = useMemo(() => {
    let rows = categories
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.name.toLowerCase().includes(q))
    }
    return [...rows].sort((a, b) => {
      const av = sortKey === "products" ? String(a._count.products) : a.name
      const bv = sortKey === "products" ? String(b._count.products) : b.name
      if (sortKey === "products") {
        const diff = a._count.products - b._count.products
        return sortDir === "asc" ? diff : -diff
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [categories, search, sortKey, sortDir])

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
      const res = await deleteIotCategory(id)
      if (!res.error) setCategories(prev => prev.filter(c => c.id !== id))
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selected)
    start(async () => {
      const res = await deleteIotCategories(ids)
      if (!res.error) { setCategories(prev => prev.filter(c => !ids.includes(c.id))); setSelected(new Set()) }
    })
  }

  return (
    <>
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 flex-1">
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
              <div className="relative max-w-[260px] w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
                  style={{ color: "var(--foreground-subtle)" }} />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search categories…" style={{ paddingLeft: 32 }} className="input-field" />
              </div>
            )}
          </div>
          <AddCategoryDialog onSuccess={c => { setCategories(prev => [c, ...prev]); setPage(1) }} />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="text-[13px]"
            style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: DEFAULT_COL_WIDTHS.name }} />
              <col style={{ width: DEFAULT_COL_WIDTHS.products }} />
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
                {COLUMNS.map(col => (
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
                  <td colSpan={4} className="px-4 py-14 text-center text-[13px]"
                    style={{ color: "var(--foreground-muted)" }}>
                    {search ? "No categories match your search" : "No categories yet — add one above"}
                  </td>
                </tr>
              ) : pageRows.map((cat, i) => {
                const isSel = selected.has(cat.id)
                return (
                  <tr key={cat.id}
                    style={{
                      borderBottom: i < pageRows.length - 1 ? "1px solid var(--border)" : "none",
                      background: isSel ? "var(--primary-light)" : "transparent",
                    }}
                    onDoubleClick={() => setEditing(cat)}>
                    <td className="pl-4 pr-2 py-3.5">
                      <RowCheckbox checked={isSel}
                        onCheckedChange={v => setSelected(prev => {
                          const n = new Set(prev); v ? n.add(cat.id) : n.delete(cat.id); return n
                        })} />
                    </td>
                    <td className="px-4 py-3.5 font-medium truncate"
                      style={{ color: "var(--foreground)" }}>{cat.name}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: cat._count.products > 0 ? "#dbeafe" : "#f1f5f9",
                          color: cat._count.products > 0 ? "#1d4ed8" : "#64748b" }}>
                        {cat._count.products} {cat._count.products === 1 ? "product" : "products"}
                      </span>
                    </td>
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
                            <DropdownMenu.Item onSelect={() => setEditing(cat)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer select-none outline-none"
                              style={{ color: "var(--foreground)" }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                              Edit
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                            <DropdownMenu.Item onSelect={() => handleDelete(cat.id)}
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
          category={editing}
          onSuccess={updated => setCategories(prev => prev.map(c => c.id === updated.id ? updated : c))}
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
