"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import * as Dialog from "@radix-ui/react-dialog"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { formatDistanceToNow } from "date-fns"
import {
  Plus, MoreHorizontal, Trash2, Pencil, ExternalLink, RefreshCw,
  Loader2, CheckCircle2, XCircle, Clock, ChevronUp, ChevronDown,
  ChevronsUpDown, Search, X, Columns3, Check, ChevronLeft, ChevronRight,
  Play, Square, GitMerge,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { useTablePrefs, PAGE_SIZES, type ColDef } from "@/hooks/use-table-prefs"
import { XmlFeedMappingModal } from "./xml-feed-mapping-modal"
import { XmlFeedFetchModal }   from "./xml-feed-fetch-modal"

// ─── Cron presets ─────────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour",       value: "0 * * * *"    },
  { label: "Every 2 hours",    value: "0 */2 * * *"  },
  { label: "Every 6 hours",    value: "0 */6 * * *"  },
  { label: "Every 12 hours",   value: "0 */12 * * *" },
  { label: "Daily at midnight",value: "0 0 * * *"    },
  { label: "Daily at 6am",     value: "0 6 * * *"    },
  { label: "Daily at 8am",     value: "0 8 * * *"    },
  { label: "Daily at noon",    value: "0 12 * * *"   },
  { label: "Weekly (Monday)",  value: "0 0 * * 1"    },
  { label: "Custom…",          value: "__custom__"   },
] as const

function cronLabel(value: string) {
  return CRON_PRESETS.find((p) => p.value === value)?.label ?? value
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feed {
  id: string
  name: string
  url: string
  description: string | null
  schedule: string
  isActive: boolean
  lastFetchedAt: string | null
  createdAt: string
  _count: { snapshots: number; fields: number }
}

// ─── Column defs ──────────────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: "name",      label: "Name",        sortable: true,  defaultVisible: true,  alwaysVisible: true  },
  { key: "url",       label: "URL",          sortable: false, defaultVisible: true,  alwaysVisible: false },
  { key: "status",    label: "Status",       sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "schedule",  label: "Schedule",     sortable: false, defaultVisible: true,  alwaysVisible: false },
  { key: "lastFetch", label: "Last Fetched", sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "snapshots", label: "Snapshots",    sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "fields",    label: "Fields",       sortable: true,  defaultVisible: true,  alwaysVisible: false },
]

const DEFAULT_WIDTHS: Record<string, number> = {
  name: 200, url: 260, status: 110, schedule: 170, lastFetch: 150, snapshots: 100, fields: 80,
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortFeeds(feeds: Feed[], by: string, dir: "asc" | "desc"): Feed[] {
  return [...feeds].sort((a, b) => {
    let va: string | number = ""
    let vb: string | number = ""
    switch (by) {
      case "name":      va = a.name;               vb = b.name;               break
      case "status":    va = a.isActive ? 1 : 0;   vb = b.isActive ? 1 : 0;  break
      case "lastFetch": va = a.lastFetchedAt ?? ""; vb = b.lastFetchedAt ?? "";break
      case "snapshots": va = a._count.snapshots;    vb = b._count.snapshots;   break
      case "fields":    va = a._count.fields;       vb = b._count.fields;      break
      default: return 0
    }
    if (va < vb) return dir === "asc" ? -1 : 1
    if (va > vb) return dir === "asc" ? 1 : -1
    return 0
  })
}

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: "asc" | "desc" }) {
  if (col !== sortBy) return <ChevronsUpDown className="size-3 opacity-30 ml-1" />
  return sortDir === "asc"
    ? <ChevronUp   className="size-3 ml-1" style={{ color: "#818cf8" }} />
    : <ChevronDown className="size-3 ml-1" style={{ color: "#818cf8" }} />
}

// ─── Cron picker ─────────────────────────────────────────────────────────────

function CronPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isCustom = !CRON_PRESETS.find((p) => p.value === value && p.value !== "__custom__")
  const [showCustom, setShowCustom] = useState(isCustom)

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (v === "__custom__") {
      setShowCustom(true)
      onChange(value) // keep current value
    } else {
      setShowCustom(false)
      onChange(v)
    }
  }

  const selectCls = "w-full rounded-md border px-2.5 py-2 text-sm bg-transparent outline-none focus:ring-1 cursor-pointer"
  const inputCls  = "w-full rounded-md border px-2.5 py-2 text-sm bg-transparent outline-none focus:ring-1 mt-2 font-mono"
  const baseStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as React.CSSProperties

  return (
    <div>
      <select
        className={selectCls}
        style={{ ...baseStyle, background: "var(--card)" }}
        value={showCustom ? "__custom__" : value}
        onChange={handleSelect}
      >
        {CRON_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      {showCustom && (
        <input
          className={inputCls}
          style={baseStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 0 */6 * * *"
        />
      )}
    </div>
  )
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function FeedModal({ open, onClose, initial, onSaved }: {
  open: boolean
  onClose: () => void
  initial?: Partial<Feed>
  onSaved: () => void
}) {
  const [name,        setName]        = useState(initial?.name ?? "")
  const [url,         setUrl]         = useState(initial?.url ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [schedule,    setSchedule]    = useState(initial?.schedule ?? "0 */6 * * *")
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState("")

  const isEdit = !!initial?.id

  async function handleSave() {
    setSaving(true); setError("")
    try {
      const res = await fetch(isEdit ? `/api/xml-feeds/${initial!.id}` : "/api/xml-feeds", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, description, schedule }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      onSaved(); onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally { setSaving(false) }
  }

  const inputCls  = "w-full rounded-md border px-3 py-2 text-sm bg-transparent outline-none focus:ring-1"
  const inputStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as React.CSSProperties

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-xl w-full max-w-lg"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <Dialog.Title className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            {isEdit ? "Edit Feed" : "Add XML Feed"}
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>Name *</label>
              <input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product Catalog" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>XML URL *</label>
              <input className={inputCls} style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/feed.xml" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>Description</label>
              <input className={inputCls} style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>Refresh Schedule</label>
              <CronPicker value={schedule} onChange={setSchedule} />
            </div>
          </div>

          {error && <p className="text-xs mt-3 text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end mt-5">
            <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn size="sm" onClick={handleSave} disabled={saving || !name || !url}>
              {saving && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              {isEdit ? "Save changes" : "Add Feed"}
            </Btn>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function XmlFeedsClient({ feeds: initial, canEdit }: { feeds: Feed[]; canEdit: boolean }) {
  const router = useRouter()
  const [feeds,       setFeeds]       = useState<Feed[]>(initial)
  const [search,      setSearch]      = useState("")
  const [sortBy,      setSortBy]      = useState("createdAt")
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc")
  const [page,        setPage]        = useState(1)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [togglingId,  setTogglingId]  = useState<string | null>(null)
  const [createOpen,  setCreateOpen]  = useState(false)
  const [editTarget,  setEditTarget]  = useState<Feed | null>(null)
  const [mappingFeed, setMappingFeed] = useState<Feed | null>(null)
  const [fetchFeed,   setFetchFeed]   = useState<Feed | null>(null)
  const [selected,    setSelected]    = useState<Set<string>>(new Set())

  const { visibleCols, pageSize, colWidths, setPageSize, toggleCol } =
    useTablePrefs("xml-feeds", COLUMNS, 25, DEFAULT_WIDTHS)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/xml-feeds")
    if (res.ok) setFeeds(await res.json())
  }, [])

  const filtered  = feeds.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.url.toLowerCase().includes(search.toLowerCase())
  )
  const sorted     = sortFeeds(filtered, sortBy, sortDir)
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated  = sorted.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortBy(col); setSortDir("asc") }
  }

  function triggerFetch(feed: Feed) {
    setFetchFeed(feed)
  }

  async function toggleActive(feedId: string) {
    setTogglingId(feedId)
    try {
      const res = await fetch(`/api/xml-feeds/${feedId}/toggle`, { method: "POST" })
      if (res.ok) {
        const { isActive } = await res.json()
        setFeeds((prev) => prev.map((f) => f.id === feedId ? { ...f, isActive } : f))
      }
    } finally { setTogglingId(null) }
  }

  async function deleteFeed(feedId: string) {
    if (!confirm("Delete this feed and all its snapshots?")) return
    setDeletingId(feedId)
    try {
      await fetch(`/api/xml-feeds/${feedId}`, { method: "DELETE" })
      setFeeds((prev) => prev.filter((f) => f.id !== feedId))
    } finally { setDeletingId(null) }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected((prev) => prev.size === paginated.length ? new Set() : new Set(paginated.map((f) => f.id)))
  }

  const thCls = "text-left text-[11px] font-semibold uppercase tracking-wide py-2.5 px-3 select-none"
  const tdCls = "px-3 py-2.5 text-sm"

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}>
        {canEdit && (
          <Btn size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5 mr-1.5" /> Add Feed
          </Btn>
        )}

        <div className="relative ml-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
            style={{ color: "var(--muted-foreground)" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search…"
            className="pl-8 pr-8 py-1.5 text-sm rounded-md border bg-transparent outline-none focus:ring-1 w-52"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="size-3" style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {filtered.length} feed{filtered.length !== 1 ? "s" : ""}
          </span>

          {/* Column picker */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                <Columns3 className="size-3.5" /> Columns
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 rounded-lg border p-1 shadow-lg min-w-[160px]"
                style={{ background: "var(--card)", borderColor: "var(--border)" }} align="end">
                {COLUMNS.filter((c) => !c.alwaysVisible).map((col) => (
                  <DropdownMenu.Item key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none"
                    style={{ color: "var(--foreground)" }}
                    onSelect={(e) => { e.preventDefault(); toggleCol(col.key) }}>
                    <Check className={cn("size-3", visibleCols.has(col.key) ? "opacity-100" : "opacity-0")} />
                    {col.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Page size */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                {pageSize} / page
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 rounded-lg border p-1 shadow-lg min-w-[100px]"
                style={{ background: "var(--card)", borderColor: "var(--border)" }} align="end">
                {PAGE_SIZES.map((s) => (
                  <DropdownMenu.Item key={s}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none"
                    style={{ color: "var(--foreground)" }}
                    onSelect={() => { setPageSize(s); setPage(1) }}>
                    <Check className={cn("size-3", pageSize === s ? "opacity-100" : "opacity-0")} />
                    {s}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead style={{ background: "var(--muted)", position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox"
                  checked={selected.size === paginated.length && paginated.length > 0}
                  onChange={toggleAll} className="rounded" />
              </th>
              {Array.from(visibleCols).map((key) => {
                const col = COLUMNS.find((c) => c.key === key)!
                return (
                  <th key={key} className={cn(thCls, col.sortable && "cursor-pointer")}
                    style={{ color: "var(--muted-foreground)", width: colWidths[key] ?? DEFAULT_WIDTHS[key] ?? 140 }}
                    onClick={() => col.sortable && toggleSort(key)}>
                    <span className="flex items-center">
                      {col.label}
                      {col.sortable && <SortIcon col={key} sortBy={sortBy} sortDir={sortDir} />}
                    </span>
                  </th>
                )
              })}
              <th className="w-12" />
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={visibleCols.size + 2} className="text-center py-16 text-sm"
                  style={{ color: "var(--muted-foreground)" }}>
                  {search ? "No feeds match your search" : "No XML feeds yet. Add one to get started."}
                </td>
              </tr>
            )}

            {paginated.map((feed) => (
              <tr key={feed.id} className="border-b group transition-colors"
                style={{
                  borderColor: "var(--border)",
                  background: selected.has(feed.id) ? "var(--muted)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!selected.has(feed.id)) (e.currentTarget as HTMLElement).style.background = "var(--muted)" }}
                onMouseLeave={(e) => { if (!selected.has(feed.id)) (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                {/* Checkbox */}
                <td className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(feed.id)}
                    onChange={() => toggleSelect(feed.id)} className="rounded" />
                </td>

                {visibleCols.has("name") && (
                  <td className={tdCls}>
                    <Link href={`/xml-feeds/${feed.id}`} className="font-medium hover:underline"
                      style={{ color: "var(--foreground)" }}>
                      {feed.name}
                    </Link>
                    {feed.description && (
                      <p className="text-xs mt-0.5 truncate max-w-xs"
                        style={{ color: "var(--muted-foreground)" }}>{feed.description}</p>
                    )}
                  </td>
                )}

                {visibleCols.has("url") && (
                  <td className={tdCls}>
                    <a href={feed.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 hover:underline"
                      style={{ color: "var(--muted-foreground)", maxWidth: 240, display: "flex" }}>
                      <span className="truncate">{feed.url}</span>
                      <ExternalLink className="size-3 flex-shrink-0" />
                    </a>
                  </td>
                )}

                {visibleCols.has("status") && (
                  <td className={tdCls}>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      feed.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                    )}>
                      {feed.isActive ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                      {feed.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                )}

                {visibleCols.has("schedule") && (
                  <td className={tdCls}>
                    <span className="flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Clock className="size-3 flex-shrink-0" />
                      {cronLabel(feed.schedule)}
                    </span>
                  </td>
                )}

                {visibleCols.has("lastFetch") && (
                  <td className={tdCls}>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {feed.lastFetchedAt
                        ? formatDistanceToNow(new Date(feed.lastFetchedAt), { addSuffix: true })
                        : "Never"}
                    </span>
                  </td>
                )}

                {visibleCols.has("snapshots") && (
                  <td className={tdCls}>
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {feed._count.snapshots}
                    </span>
                  </td>
                )}

                {visibleCols.has("fields") && (
                  <td className={tdCls}>
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {feed._count.fields}
                    </span>
                  </td>
                )}

                {/* Actions dropdown */}
                <td className="px-2 py-2.5">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--muted-foreground)" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--muted)"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="z-50 rounded-lg border p-1 shadow-lg min-w-[180px]"
                        style={{ background: "var(--card)", borderColor: "var(--border)" }}
                        align="end"
                      >
                        {/* View details */}
                        <DropdownMenu.Item
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none"
                          style={{ color: "var(--foreground)" }}
                          onSelect={() => router.push(`/xml-feeds/${feed.id}`)}>
                          <ExternalLink className="size-3.5" /> View details
                        </DropdownMenu.Item>

                        {canEdit && (
                          <>
                            <DropdownMenu.Separator className="my-1 h-px"
                              style={{ background: "var(--border)" }} />

                            {/* Data Mapping */}
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none"
                              style={{ color: "var(--foreground)" }}
                              onSelect={() => setMappingFeed(feed)}>
                              <GitMerge className="size-3.5" style={{ color: "#818cf8" }} />
                              Data Mapping
                            </DropdownMenu.Item>

                            {/* Fetch now */}
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none"
                              style={{ color: "var(--foreground)" }}
                              onSelect={() => triggerFetch(feed)}>
                              <RefreshCw className="size-3.5" />
                              Fetch now
                            </DropdownMenu.Item>

                            {/* Start / Stop */}
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none"
                              style={{ color: feed.isActive ? "#f59e0b" : "#34d399" }}
                              onSelect={() => toggleActive(feed.id)}>
                              {togglingId === feed.id
                                ? <Loader2 className="size-3.5 animate-spin" />
                                : feed.isActive
                                  ? <Square className="size-3.5" />
                                  : <Play  className="size-3.5" />}
                              {feed.isActive ? "Stop cron" : "Start cron"}
                            </DropdownMenu.Item>

                            <DropdownMenu.Separator className="my-1 h-px"
                              style={{ background: "var(--border)" }} />

                            {/* Edit */}
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none"
                              style={{ color: "var(--foreground)" }}
                              onSelect={() => setEditTarget(feed)}>
                              <Pencil className="size-3.5" /> Edit
                            </DropdownMenu.Item>

                            {/* Delete */}
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer outline-none text-red-400"
                              onSelect={() => deleteFeed(feed.id)}>
                              {deletingId === feed.id
                                ? <Loader2 className="size-3.5 animate-spin" />
                                : <Trash2 className="size-3.5" />}
                              Delete
                            </DropdownMenu.Item>
                          </>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t flex-shrink-0"
        style={{ borderColor: "var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {filtered.length === 0
            ? "0"
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}`} of {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1.5 rounded-md disabled:opacity-30"
            style={{ color: "var(--muted-foreground)" }}>
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs px-2" style={{ color: "var(--muted-foreground)" }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-1.5 rounded-md disabled:opacity-30"
            style={{ color: "var(--muted-foreground)" }}>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Modals */}
      {canEdit && (
        <>
          <FeedModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} />

          {editTarget && (
            <FeedModal
              open
              onClose={() => setEditTarget(null)}
              initial={editTarget}
              onSaved={() => { refresh(); setEditTarget(null) }}
            />
          )}

          {mappingFeed && (
            <XmlFeedMappingModal
              open
              feedId={mappingFeed.id}
              feedName={mappingFeed.name}
              feedUrl={mappingFeed.url}
              onClose={() => setMappingFeed(null)}
            />
          )}

          {fetchFeed && (
            <XmlFeedFetchModal
              open
              feedId={fetchFeed.id}
              feedName={fetchFeed.name}
              onClose={() => setFetchFeed(null)}
              onDone={() => { refresh(); router.refresh() }}
            />
          )}
        </>
      )}
    </div>
  )
}
