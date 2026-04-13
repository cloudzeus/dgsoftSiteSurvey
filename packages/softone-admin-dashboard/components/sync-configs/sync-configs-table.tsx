"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as Dialog from "@radix-ui/react-dialog"
import { formatDistanceToNow } from "date-fns"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Trash2, Play, Power, Pencil, ExternalLink, Settings2,
  MoreHorizontal, Search, Columns3, Check, ChevronUp, ChevronDown,
  ChevronsUpDown, ChevronLeft, ChevronRight, Table2, X, Loader2,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { deleteSyncConfig, toggleSyncConfig } from "@/app/actions/sync-config"
import { useTablePrefs, PAGE_SIZES, type ColDef } from "@/hooks/use-table-prefs"
import { CreateSyncConfigDialog } from "./create-sync-config-dialog"
import { EditSyncConfigDialog } from "./edit-sync-config-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Config {
  id: string
  objectName: string
  tableName: string
  usageType: string
  isActive: boolean
  syncDirection: string
  syncSchedule: string
  lastSyncedAt: Date | null
  conflictStrategy: string
  batchSize: number
  showInMenu: boolean
  menuLabel: string | null
  menuIcon: string | null
  _count: { syncJobs: number; fieldMappings: number }
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: "object",    label: "Object / Table",    sortable: true,  defaultVisible: true,  alwaysVisible: true  },
  { key: "status",    label: "Status",            sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "type",      label: "Type",              sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "schedule",  label: "Schedule",          sortable: false, defaultVisible: true,  alwaysVisible: false },
  { key: "conflict",  label: "Conflict Strategy", sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "lastSync",  label: "Last Sync",         sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "jobs",      label: "Jobs / Fields",     sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "batch",     label: "Batch",             sortable: true,  defaultVisible: false, alwaysVisible: false },
]

const DEFAULT_WIDTHS: Record<string, number> = {
  object:   220, status: 110, type: 110, schedule: 140,
  conflict: 160, lastSync: 140, jobs: 110, batch: 80,
}

// ─── Sort helper ──────────────────────────────────────────────────────────────

function sortConfigs(configs: Config[], sortBy: string, sortDir: "asc" | "desc"): Config[] {
  return [...configs].sort((a, b) => {
    let valA: string | number | Date | null = null
    let valB: string | number | Date | null = null

    switch (sortBy) {
      case "object":   valA = a.objectName;                  valB = b.objectName;                  break
      case "status":   valA = a.syncDirection;               valB = b.syncDirection;                break
      case "type":     valA = a.usageType;                   valB = b.usageType;                    break
      case "conflict": valA = a.conflictStrategy;            valB = b.conflictStrategy;             break
      case "lastSync": valA = a.lastSyncedAt ?? new Date(0); valB = b.lastSyncedAt ?? new Date(0);  break
      case "jobs":     valA = a._count.syncJobs;             valB = b._count.syncJobs;              break
      case "batch":    valA = a.batchSize;                   valB = b.batchSize;                    break
      default: return 0
    }

    if (valA === null) return sortDir === "asc" ? 1 : -1
    if (valB === null) return sortDir === "asc" ? -1 : 1
    if (valA < valB)   return sortDir === "asc" ? -1 : 1
    if (valA > valB)   return sortDir === "asc" ? 1 : -1
    return 0
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface JobStatus {
  id: string
  status: string
  totalRecords: number | null
  recordsProcessed: number | null
  recordsSuccessful: number | null
  recordsFailed: number | null
  errorMessage: string | null
  completedAt: string | null
}

interface SyncProgress {
  jobId: string
  configName: string
}

export function SyncConfigsTable({ configs }: { configs: Config[] }) {
  const router = useRouter()

  // ── Action loading states ──
  const [triggering, setTriggering] = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [toggling,   setToggling]   = useState<string | null>(null)

  // ── Sync progress dialog ──
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [jobStatus, setJobStatus]       = useState<JobStatus | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!syncProgress) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }

    async function poll() {
      if (!syncProgress) return
      try {
        const res = await fetch(`/api/jobs/${syncProgress.jobId}`)
        if (!res.ok) return
        const data: JobStatus = await res.json()
        setJobStatus(data)
        if (data.status === "COMPLETED" || data.status === "FAILED" || data.status === "PARTIAL_FAILURE") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
          router.refresh()
        }
      } catch { /* ignore transient errors */ }
    }

    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [syncProgress, router])

  // ── Table state ──
  const [search,   setSearch]   = useState("")
  const [sortBy,   setSortBy]   = useState("object")
  const [sortDir,  setSortDir]  = useState<"asc" | "desc">("asc")
  const [page,     setPage]     = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ── Prefs (column visibility, page size, widths) ──
  const { visibleCols, toggleCol, pageSize, setPageSize, colWidths, setColWidth, hydrated } =
    useTablePrefs("sync-configs", COLUMNS, 25, DEFAULT_WIDTHS)

  // ── Column resize ──
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, key: string) => {
      e.preventDefault()
      const startW = colWidths[key] ?? DEFAULT_WIDTHS[key] ?? 120
      resizing.current = { key, startX: e.clientX, startW }

      function onMove(ev: MouseEvent) {
        if (!resizing.current) return
        const delta = ev.clientX - resizing.current.startX
        setColWidth(resizing.current.key, Math.max(60, resizing.current.startW + delta))
      }
      function onUp() {
        resizing.current = null
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [colWidths, setColWidth]
  )

  // ── Actions ──
  async function triggerSync(id: string) {
    const config = configs.find((c) => c.id === id)
    setTriggering(id)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncConfigId: id }),
      })
      if (res.status === 409) return // already running
      const { jobId } = await res.json()
      setJobStatus(null)
      setSyncProgress({ jobId, configName: config ? `${config.objectName} · ${config.tableName}` : id })
    } finally { setTriggering(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sync configuration and all associated jobs?")) return
    setDeleting(id)
    try { await deleteSyncConfig(id) } finally { setDeleting(null) }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setToggling(id)
    try { await toggleSyncConfig(id, !isActive) } finally { setToggling(null) }
  }

  // ── Sort ──
  function handleSort(key: string) {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortBy(key); setSortDir("asc") }
    setPage(1)
  }

  // ── Filter + sort + paginate ──
  const q = search.toLowerCase()
  const filtered = configs.filter(
    (c) =>
      c.objectName.toLowerCase().includes(q) ||
      c.tableName.toLowerCase().includes(q) ||
      (c.menuLabel ?? "").toLowerCase().includes(q)
  )
  const sorted    = sortConfigs(filtered, sortBy, sortDir)
  const total     = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage  = Math.min(page, totalPages)
  const paged     = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  const fromRow   = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const toRow     = Math.min(safePage * pageSize, total)

  // ── Selection ──
  const pageIds    = paged.map((c) => c.id)
  const allSel     = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someSel    = pageIds.some((id) => selected.has(id)) && !allSel

  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s)
      allSel ? pageIds.forEach((id) => n.delete(id)) : pageIds.forEach((id) => n.add(id))
      return n
    })
  }
  function toggleRow(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const visibleDefs = COLUMNS.filter((c) => visibleCols.has(c.key))

  // ── Empty state ──
  if (configs.length === 0) {
    return (
      <div className="rounded-2xl flex flex-col items-center justify-center py-20 border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/10">
        <div className="size-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-indigo-900 to-indigo-700 shadow-lg">
          <Settings2 className="size-6 text-white" />
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)] mb-1">No sync configurations yet</p>
        <p className="text-xs text-[var(--muted-foreground)] mb-5">Connect your first Softone object to start syncing data</p>
        <CreateSyncConfigDialog>
          <Btn variant="primary" size="md">Create your first config</Btn>
        </CreateSyncConfigDialog>
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
            placeholder="Search configs…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
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
            <button onClick={() => setSelected(new Set())} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Clear</button>
          </div>
        )}

        {/* Column picker */}
        <div className="ml-auto">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                <Columns3 className="size-4" />
                Columns
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150">
                {COLUMNS.map((col) => {
                  const isVisible = visibleCols.has(col.key)
                  const locked    = col.alwaysVisible
                  return (
                    <DropdownMenu.Item
                      key={col.key}
                      onSelect={(e) => { e.preventDefault(); if (!locked) toggleCol(col.key) }}
                      className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none transition-colors", locked ? "opacity-50 cursor-default" : "hover:bg-[var(--muted)]")}
                    >
                      <div className={cn("size-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors", isVisible ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]")}>
                        {isVisible && <Check className="size-2.5 text-[var(--primary-foreground)]" strokeWidth={3} />}
                      </div>
                      <span className="flex-1">{col.label}</span>
                      {locked && <span className="text-[10px] text-[var(--muted-foreground)]">locked</span>}
                    </DropdownMenu.Item>
                  )
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 40 }} />
              {visibleDefs.map((col) => (
                <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_WIDTHS[col.key] ?? 120 }} />
              ))}
              <col style={{ width: 48 }} />
            </colgroup>

            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                {/* Select-all */}
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSel}
                    ref={(el) => { if (el) el.indeterminate = someSel }}
                    onChange={toggleAll}
                    className="rounded accent-indigo-500 cursor-pointer"
                  />
                </th>

                {visibleDefs.map((col) => {
                  const isActive = sortBy === col.key
                  const w = colWidths[col.key] ?? DEFAULT_WIDTHS[col.key] ?? 120
                  return (
                    <th
                      key={col.key}
                      className="relative px-3 py-3 text-left group"
                      style={{ width: w }}
                    >
                      <div
                        className={cn("flex items-center gap-1.5", col.sortable && "cursor-pointer select-none")}
                        onClick={() => handleSort(col.key)}
                      >
                        <span className={cn("text-[11px] font-bold uppercase tracking-wider truncate", isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>
                          {col.label}
                        </span>
                        {col.sortable && (
                          isActive
                            ? sortDir === "asc"
                              ? <ChevronUp   className="size-3.5 flex-shrink-0 text-[var(--foreground)]" />
                              : <ChevronDown className="size-3.5 flex-shrink-0 text-[var(--foreground)]" />
                            : <ChevronsUpDown className="size-3.5 flex-shrink-0 text-[var(--muted-foreground)]/40" />
                        )}
                      </div>
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => onResizeMouseDown(e, col.key)}
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-[var(--primary)]/40 transition-opacity"
                      />
                    </th>
                  )
                })}

                {/* Actions col */}
                <th className="px-2 py-3" />
              </tr>
            </thead>

            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={visibleDefs.length + 2} className="py-16 text-center text-sm text-[var(--muted-foreground)]">
                    {search ? `No configs match "${search}"` : "No configurations"}
                  </td>
                </tr>
              ) : (
                paged.map((c, i) => {
                  const isSel = selected.has(c.id)
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b border-[var(--border)]/50 last:border-0 transition-colors",
                        isSel ? "bg-[var(--primary)]/5" : i % 2 === 0 ? "bg-transparent" : "bg-[var(--muted)]/10",
                        "hover:bg-[var(--muted)]/25",
                        !c.isActive && "opacity-50"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={isSel} onChange={() => toggleRow(c.id)} className="rounded accent-indigo-500 cursor-pointer" />
                      </td>

                      {/* Object / Table */}
                      {visibleCols.has("object") && (
                        <td className="px-3 py-3">
                          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{c.menuLabel ?? c.objectName}</p>
                          <p className="text-[11px] font-mono text-[var(--muted-foreground)] truncate mt-0.5">{c.tableName}</p>
                        </td>
                      )}

                      {/* Status */}
                      {visibleCols.has("status") && (
                        <td className="px-3 py-3">
                          <StatusBadge status={c.isActive ? c.syncDirection : "INACTIVE"} />
                        </td>
                      )}

                      {/* Type */}
                      {visibleCols.has("type") && (
                        <td className="px-3 py-3">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            c.usageType === "PERSISTENT"
                              ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/20"
                              : "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                          )}>
                            {c.usageType === "PERSISTENT" ? "Persistent" : "Reference"}
                          </span>
                        </td>
                      )}

                      {/* Schedule */}
                      {visibleCols.has("schedule") && (
                        <td className="px-3 py-3">
                          <code className="text-[11px] px-2 py-0.5 rounded-md font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {c.syncSchedule}
                          </code>
                        </td>
                      )}

                      {/* Conflict */}
                      {visibleCols.has("conflict") && (
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)] truncate">
                          {c.conflictStrategy.replace(/_/g, " ").toLowerCase()}
                        </td>
                      )}

                      {/* Last sync */}
                      {visibleCols.has("lastSync") && (
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          {c.lastSyncedAt
                            ? formatDistanceToNow(c.lastSyncedAt, { addSuffix: true })
                            : <span className="text-[var(--muted-foreground)]/40">Never</span>}
                        </td>
                      )}

                      {/* Jobs / Fields */}
                      {visibleCols.has("jobs") && (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-semibold text-[var(--foreground)]">{c._count.syncJobs}</span>
                            <span className="text-[var(--border)]">·</span>
                            <span className="text-[var(--muted-foreground)]">{c._count.fieldMappings} fields</span>
                          </div>
                        </td>
                      )}

                      {/* Batch */}
                      {visibleCols.has("batch") && (
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)] tabular-nums">
                          {c.batchSize}
                        </td>
                      )}

                      {/* Row actions */}
                      <td className="px-2 py-3">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="size-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                              {(triggering === c.id || deleting === c.id || toggling === c.id)
                                ? <Loader2 className="size-4 animate-spin" />
                                : <MoreHorizontal className="size-4" />}
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              className="z-50 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150"
                            >
                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/data/${c.id}`}
                                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                                >
                                  <Table2 className="size-3.5 text-[var(--muted-foreground)]" />
                                  View records
                                </Link>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => triggerSync(c.id)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Play className="size-3.5 text-[var(--muted-foreground)]" />
                                Run sync now
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/sync-configs/${c.id}`}
                                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                                >
                                  <ExternalLink className="size-3.5 text-[var(--muted-foreground)]" />
                                  View logs & details
                                </Link>
                              </DropdownMenu.Item>

                              <EditSyncConfigDialog config={c}>
                                <DropdownMenu.Item
                                  onSelect={(e) => e.preventDefault()}
                                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                                >
                                  <Pencil className="size-3.5 text-[var(--muted-foreground)]" />
                                  Edit settings
                                </DropdownMenu.Item>
                              </EditSyncConfigDialog>

                              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

                              <DropdownMenu.Item
                                onSelect={() => handleToggle(c.id, c.isActive)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Power className={cn("size-3.5", c.isActive ? "text-amber-500" : "text-emerald-500")} />
                                {c.isActive ? "Disable" : "Enable"}
                              </DropdownMenu.Item>

                              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

                              <DropdownMenu.Item
                                onSelect={() => handleDelete(c.id)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none text-[var(--destructive)] hover:bg-[var(--destructive)]/8 transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                                Delete
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
              {total === 0 ? "0 configs" : `${fromRow}–${toRow} of ${total}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="size-7 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-xs font-medium text-[var(--foreground)] px-2">{safePage} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="size-7 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sync Progress Dialog ── */}
      <Dialog.Root open={!!syncProgress} onOpenChange={(open) => { if (!open) { setSyncProgress(null); setJobStatus(null) } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 focus:outline-none">
            <div className="flex items-start justify-between mb-5">
              <div>
                <Dialog.Title className="text-sm font-semibold text-[var(--foreground)]">Sync in progress</Dialog.Title>
                <Dialog.Description className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate max-w-72">
                  {syncProgress?.configName}
                </Dialog.Description>
              </div>
              {jobStatus && (jobStatus.status === "COMPLETED" || jobStatus.status === "FAILED" || jobStatus.status === "PARTIAL_FAILURE") && (
                <Dialog.Close className="size-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                  <X className="size-4" />
                </Dialog.Close>
              )}
            </div>

            {/* Status icon + label */}
            <div className="flex items-center gap-3 mb-5">
              {!jobStatus || jobStatus.status === "PENDING" || jobStatus.status === "IN_PROGRESS" ? (
                <div className="size-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Loader2 className="size-5 text-indigo-500 animate-spin" />
                </div>
              ) : jobStatus.status === "COMPLETED" ? (
                <div className="size-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                </div>
              ) : jobStatus.status === "PARTIAL_FAILURE" ? (
                <div className="size-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5 text-amber-500" />
                </div>
              ) : (
                <div className="size-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <XCircle className="size-5 text-red-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {!jobStatus || jobStatus.status === "PENDING" ? "Starting…"
                    : jobStatus.status === "IN_PROGRESS" ? "Syncing records…"
                    : jobStatus.status === "COMPLETED" ? "Sync complete"
                    : jobStatus.status === "PARTIAL_FAILURE" ? "Completed with errors"
                    : "Sync failed"}
                </p>
                {jobStatus && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Job {syncProgress?.jobId.slice(0, 8)}…
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {jobStatus && (jobStatus.totalRecords ?? 0) > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-1.5">
                  <span>{jobStatus.recordsProcessed ?? 0} of {jobStatus.totalRecords} records</span>
                  <span>{Math.round(((jobStatus.recordsProcessed ?? 0) / jobStatus.totalRecords!) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.round(((jobStatus.recordsProcessed ?? 0) / jobStatus.totalRecords!) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Counts */}
            {jobStatus && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-xl bg-[var(--muted)]/40 p-3">
                  <p className="text-xs text-[var(--muted-foreground)] mb-0.5">Successful</p>
                  <p className="text-lg font-semibold text-emerald-500">{jobStatus.recordsSuccessful ?? 0}</p>
                </div>
                <div className="rounded-xl bg-[var(--muted)]/40 p-3">
                  <p className="text-xs text-[var(--muted-foreground)] mb-0.5">Failed</p>
                  <p className={cn("text-lg font-semibold", (jobStatus.recordsFailed ?? 0) > 0 ? "text-red-500" : "text-[var(--muted-foreground)]")}>
                    {jobStatus.recordsFailed ?? 0}
                  </p>
                </div>
              </div>
            )}

            {/* Error message */}
            {jobStatus?.errorMessage && (
              <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3 text-xs text-red-400 font-mono break-all">
                {jobStatus.errorMessage}
              </div>
            )}

            {/* Still running hint */}
            {(!jobStatus || jobStatus.status === "PENDING" || jobStatus.status === "IN_PROGRESS") && (
              <p className="text-xs text-[var(--muted-foreground)] text-center mt-3">
                This dialog updates automatically — you can leave it open.
              </p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}
