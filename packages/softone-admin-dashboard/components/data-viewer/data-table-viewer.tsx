"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
  Search, MoreHorizontal, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Columns3, RefreshCw, Check, Copy,
  AlertTriangle, Database, Loader2, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTablePrefs, PAGE_SIZES, type ColDef } from "@/hooks/use-table-prefs"
import { format, parseISO } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColumnMeta {
  key: string
  label: string
  dataType: string
  isPrimaryKey: boolean
  isCustom: boolean
}

interface ApiResponse {
  records: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  columns: ColumnMeta[]
  tableNotFound?: boolean
  error?: string
}

interface ConfigMeta {
  id: string
  objectName: string
  tableName: string
  menuLabel: string | null
  lastSyncedAt: Date | string | null
  fieldMappings: ColumnMeta[]
  isLive?: boolean
}

// ─── Cell renderers ───────────────────────────────────────────────────────────

function CellValue({ value, dataType }: { value: unknown; dataType: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-[var(--muted-foreground)]/40">—</span>
  }

  if (dataType === "logical") {
    const bool = value === true || value === 1 || value === "1" || value === "true"
    return (
      <span className={cn(
        "inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold border",
        bool
          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
          : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
      )}>
        {bool ? "Yes" : "No"}
      </span>
    )
  }

  if (dataType === "datetime") {
    try {
      const d = value instanceof Date ? value : parseISO(String(value))
      return <span className="text-[var(--muted-foreground)]">{format(d, "dd MMM yyyy HH:mm")}</span>
    } catch {
      return <span>{String(value)}</span>
    }
  }

  if (dataType === "numeric") {
    const n = Number(value)
    return (
      <span className="tabular-nums font-mono text-right block">
        {isNaN(n) ? String(value) : n.toLocaleString()}
      </span>
    )
  }

  const str = String(value)
  return (
    <span className="truncate block max-w-[240px]" title={str.length > 40 ? str : undefined}>
      {str}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DataTableViewer({ config }: { config: ConfigMeta }) {
  const isLive = config.isLive ?? false
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Data state ──
  const [data,       setData]       = useState<ApiResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  // ── Table interaction state ──
  const [search,     setSearch]     = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy,     setSortBy]     = useState(
    isLive
      ? (config.fieldMappings.find((f) => f.isPrimaryKey)?.key ?? config.fieldMappings[0]?.key ?? "")
      : "_synced_at"
  )
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc")
  const [page,       setPage]       = useState(1)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())

  // Build ColDef[] from config fieldMappings (+ _synced_at for local tables)
  const COLUMNS: ColDef[] = [
    ...config.fieldMappings.map((f) => ({
      key:          f.key,
      label:        f.label,
      sortable:     true,
      defaultVisible: true,
      alwaysVisible: f.isPrimaryKey,
    })),
    ...(!isLive ? [{
      key:          "_synced_at",
      label:        "Synced At",
      sortable:     true,
      defaultVisible: true,
      alwaysVisible: false,
    }] : []),
  ]

  const tableId = `data-${config.id}`
  const { visibleCols, toggleCol, pageSize, setPageSize, hydrated } =
    useTablePrefs(tableId, COLUMNS, 25)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  // Fetch data
  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page:     String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      })
      const res = await fetch(`/api/data/${config.id}?${qs}`)
      const json: ApiResponse = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setSelected(new Set())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [config.id, page, pageSize, sortBy, sortDir, debouncedSearch])

  useEffect(() => { fetchData() }, [fetchData])

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  function handleRefresh() {
    startTransition(() => {
      router.refresh()
      fetchData({ silent: true })
    })
  }

  // ── Selection helpers ──
  const pkCol  = config.fieldMappings.find((f) => f.isPrimaryKey)?.key
  const rowKey = (row: Record<string, unknown>) =>
    pkCol ? String(row[pkCol] ?? "") : JSON.stringify(row).slice(0, 32)

  const allOnPage = data?.records.map((row, i) => { const rk = rowKey(row); return rk || String(i) }) ?? []
  const allSelected = allOnPage.length > 0 && allOnPage.every((k) => selected.has(k))
  const someSelected = allOnPage.some((k) => selected.has(k)) && !allSelected

  function toggleAll() {
    if (allSelected) {
      setSelected((s) => { const n = new Set(s); allOnPage.forEach((k) => n.delete(k)); return n })
    } else {
      setSelected((s) => { const n = new Set(s); allOnPage.forEach((k) => n.add(k)); return n })
    }
  }
  function toggleRow(key: string) {
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // ── Visible columns for rendering ──
  // For live configs, use actual columns returned by the API (keys match real Softone response)
  const liveColumns = isLive && data?.columns?.length ? data.columns : null
  const effectiveDefs = liveColumns
    ? liveColumns.map((c) => ({ key: c.key, label: c.label, sortable: false, defaultVisible: true, alwaysVisible: c.isPrimaryKey }))
    : COLUMNS
  const visibleDefs = liveColumns ? effectiveDefs : COLUMNS.filter((c) => visibleCols.has(c.key))
  const allColMeta  = liveColumns ?? [
    ...config.fieldMappings,
    ...(!isLive ? [{ key: "_synced_at", label: "Synced At", dataType: "datetime", isPrimaryKey: false, isCustom: false }] : []),
  ]

  const total     = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const fromRow   = (page - 1) * pageSize + 1
  const toRow     = Math.min(page * pageSize, total)

  // ── Table-not-found state (PERSISTENT only) ──
  if (!isLive && data?.tableNotFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/10">
        <div className="size-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
          <Database className="size-7 text-[var(--muted-foreground)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--foreground)]">Table not synced yet</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            The <span className="font-mono">softone_{config.tableName.toLowerCase()}</span> table will be created after the first sync run.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--muted-foreground)]" />
          <input
            type="search"
            placeholder="Search records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-1.5">
            <span className="text-xs font-semibold text-[var(--foreground)]">{selected.size} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Clear
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="size-9 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("size-4", (loading || isPending) && "animate-spin")} />
          </button>

          {/* Column picker */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                <Columns3 className="size-4" />
                Columns
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150"
              >
                {effectiveDefs.map((col) => {
                  const isVisible = liveColumns ? true : visibleCols.has(col.key)
                  const locked    = col.alwaysVisible
                  return (
                    <DropdownMenu.Item
                      key={col.key}
                      onSelect={(e) => { e.preventDefault(); if (!locked) toggleCol(col.key) }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none transition-colors",
                        locked ? "opacity-50 cursor-default" : "hover:bg-[var(--muted)]"
                      )}
                    >
                      <div className={cn(
                        "size-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors",
                        isVisible ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]"
                      )}>
                        {isVisible && <Check className="size-2.5 text-[var(--primary-foreground)]" strokeWidth={3} />}
                      </div>
                      <span className="flex-1 truncate">{col.label}</span>
                      {locked && <span className="text-[10px] text-[var(--muted-foreground)]">locked</span>}
                    </DropdownMenu.Item>
                  )
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3">
          <AlertTriangle className="size-4 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--destructive)]">{error}</p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                {/* Checkbox col */}
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleAll}
                    className="rounded accent-indigo-500 cursor-pointer"
                  />
                </th>

                {/* Data cols */}
                {visibleDefs.map((col) => {
                  const isActive = sortBy === col.key
                  const meta     = allColMeta.find((m) => m.key === col.key)
                  return (
                    <th
                      key={col.key}
                      className={cn(
                        "px-3 py-3 text-left whitespace-nowrap",
                        col.sortable && "cursor-pointer select-none hover:bg-[var(--muted)]/60 transition-colors"
                      )}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className={cn("flex items-center gap-1.5", meta?.dataType === "numeric" && "justify-end")}>
                        <span className={cn(
                          "text-[11px] font-bold uppercase tracking-wider",
                          isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                        )}>
                          {col.label}
                        </span>
                        {col.sortable && (
                          isActive
                            ? sortDir === "asc"
                              ? <ChevronUp   className="size-3.5 text-[var(--foreground)]" />
                              : <ChevronDown className="size-3.5 text-[var(--foreground)]" />
                            : <ChevronsUpDown className="size-3.5 text-[var(--muted-foreground)]/40" />
                        )}
                      </div>
                    </th>
                  )
                })}

                {/* Actions col */}
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={visibleDefs.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="size-6 animate-spin text-[var(--muted-foreground)]" />
                      <p className="text-sm text-[var(--muted-foreground)]">Loading records…</p>
                    </div>
                  </td>
                </tr>
              ) : data?.records.length === 0 ? (
                <tr>
                  <td colSpan={visibleDefs.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {debouncedSearch ? `No records match "${debouncedSearch}"` : "No records found"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.records.map((row, i) => {
                  const rk      = rowKey(row)
                  const key     = rk || String(i)
                  const isSelected = selected.has(key)
                  const isEven  = i % 2 === 0
                  return (
                    <tr
                      key={key}
                      className={cn(
                        "border-b border-[var(--border)]/50 last:border-0 transition-colors",
                        isSelected
                          ? "bg-[var(--primary)]/5"
                          : isEven ? "bg-transparent" : "bg-[var(--muted)]/10",
                        "hover:bg-[var(--muted)]/30"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          className="rounded accent-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Data cells */}
                      {visibleDefs.map((col) => {
                        const meta = allColMeta.find((m) => m.key === col.key)
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-3 py-2.5 text-sm text-[var(--foreground)]",
                              meta?.dataType === "numeric" && "text-right",
                              meta?.isPrimaryKey && "font-mono font-semibold text-[var(--primary)]"
                            )}
                          >
                            <CellValue value={row[col.key]} dataType={meta?.dataType ?? "character"} />
                          </td>
                        )
                      })}

                      {/* Row actions */}
                      <td className="px-2 py-2.5">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="size-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              className="z-50 min-w-40 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150"
                            >
                              {pkCol && (
                                <DropdownMenu.Item
                                  onSelect={() => navigator.clipboard.writeText(String(row[pkCol] ?? ""))}
                                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                                >
                                  <Copy className="size-3.5 text-[var(--muted-foreground)]" />
                                  Copy ID
                                </DropdownMenu.Item>
                              )}
                              <DropdownMenu.Item
                                onSelect={() => navigator.clipboard.writeText(JSON.stringify(row, null, 2))}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Copy className="size-3.5 text-[var(--muted-foreground)]" />
                                Copy row as JSON
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--muted)]/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value) as any); setPage(1) }}
              className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted-foreground)]">
              {total === 0 ? "0 records" : `${fromRow}–${toRow} of ${total.toLocaleString()}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="size-7 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-xs font-medium text-[var(--foreground)] px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="size-7 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
