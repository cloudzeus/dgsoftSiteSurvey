"use client"

import React, { useState } from "react"
import Link from "next/link"
import * as Tabs from "@radix-ui/react-tabs"
import { formatDistanceToNow, format } from "date-fns"
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock,
  Plus, Minus, Pencil, Tag, Hash,
  ChevronDown, ChevronUp, ExternalLink, Database,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { XmlFeedFetchModal } from "./xml-feed-fetch-modal"
import { XmlFeedFiltersTab } from "./xml-feed-filters-tab"

// ─── Image detection ──────────────────────────────────────────────────────────

const IMAGE_URL_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i
const IMAGE_FIELD_HINTS = /image|img|photo|thumb|picture|pic|logo|banner|icon|avatar/i

function looksLikeImageUrl(value: string | null, path?: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    if (IMAGE_URL_RE.test(url.pathname)) return true
  } catch {}
  if (path && IMAGE_FIELD_HINTS.test(path)) return true
  return false
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
  fields: Field[]
  _count: { snapshots: number }
}

interface Field {
  id: string
  path: string
  label: string
  dataType: string
  isAttribute: boolean
  frequency: number
  sampleValue: string | null
}

interface Snapshot {
  id: string
  fetchedAt: string
  recordCount: number
  status: string
  errorMessage: string | null
  _count: { changes: number }
}

interface Change {
  id: string
  snapshotId: string
  changeType: string
  recordKey: string | null
  fieldPath: string | null
  oldValue: string | null
  newValue: string | null
  detectedAt: string
  snapshot: { fetchedAt: string }
}

// ─── Change type badge ────────────────────────────────────────────────────────

function ChangeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    RECORD_ADDED:    { label: "Added",         cls: "bg-emerald-500/10 text-emerald-400", icon: <Plus className="size-3" /> },
    RECORD_REMOVED:  { label: "Removed",       cls: "bg-red-500/10 text-red-400",         icon: <Minus className="size-3" /> },
    FIELD_MODIFIED:  { label: "Modified",      cls: "bg-amber-500/10 text-amber-400",     icon: <Pencil className="size-3" /> },
    NEW_FIELD:       { label: "New field",     cls: "bg-blue-500/10 text-blue-400",       icon: <Tag className="size-3" /> },
    REMOVED_FIELD:   { label: "Field removed", cls: "bg-orange-500/10 text-orange-400",   icon: <Tag className="size-3" /> },
  }
  const def = map[type] ?? { label: type, cls: "bg-zinc-500/10 text-zinc-400", icon: null }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", def.cls)}>
      {def.icon} {def.label}
    </span>
  )
}

// ─── Data type badge ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    string:  "bg-violet-500/10 text-violet-400",
    number:  "bg-blue-500/10 text-blue-400",
    boolean: "bg-orange-500/10 text-orange-400",
    date:    "bg-teal-500/10 text-teal-400",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", colors[type] ?? "bg-zinc-500/10 text-zinc-400")}>
      <Hash className="size-2.5" /> {type}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function XmlFeedDetailClient({
  feed: initial,
  snapshots: initialSnapshots,
  changes: initialChanges,
  canEdit,
}: {
  feed: Feed
  snapshots: Snapshot[]
  changes: Change[]
  canEdit: boolean
}) {
  const [feed, setFeed] = useState(initial)
  const [snapshots, setSnapshots] = useState(initialSnapshots)
  const [changes, setChanges] = useState(initialChanges)
  const [fetchModalOpen, setFetchModalOpen] = useState(false)
  const [expandedChange, setExpandedChange] = useState<string | null>(null)

  // ── Data tab state ──
  interface DataField { path: string; label: string; value: unknown; isImage: boolean }
  interface DataRecord { _key: string; fields: DataField[] }

  const [dataTab, setDataTab] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [records, setRecords] = useState<DataRecord[]>([])
  const [dataColumns, setDataColumns] = useState<string[]>([])

  function loadRecords() {
    setDataTab("loading")
    fetch(`/api/xml-feeds/${feed.id}/records`)
      .then((r) => r.json())
      .then((data: { records: DataRecord[] }) => {
        const rows = data.records ?? []
        const colSet = new Set<string>()
        rows.forEach((r) => r.fields.forEach((f) => colSet.add(f.path)))
        setDataColumns(Array.from(colSet))
        setRecords(rows)
        setDataTab("done")
      })
      .catch(() => setDataTab("error"))
  }

  async function refreshData() {
    const [snRes, chRes, feedRes] = await Promise.all([
      fetch(`/api/xml-feeds/${feed.id}/snapshots`),
      fetch(`/api/xml-feeds/${feed.id}/changes`),
      fetch(`/api/xml-feeds/${feed.id}`),
    ])
    if (snRes.ok)   setSnapshots(await snRes.json())
    if (chRes.ok)   setChanges(await chRes.json())
    if (feedRes.ok) setFeed(await feedRes.json())
  }

  const tabTriggerCls = "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/xml-feeds" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "var(--muted-foreground)" }}>
            <ArrowLeft className="size-3.5" /> XML Feeds
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{feed.name}</h1>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              feed.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
            )}>
              {feed.isActive ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
              {feed.isActive ? "Active" : "Paused"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/xml-feeds/${feed.id}/records`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <Database className="size-3.5" /> Browse Records
            </Link>
            {canEdit && (
              <Btn size="sm" onClick={() => setFetchModalOpen(true)}>
                <RefreshCw className="size-3.5 mr-1.5" />
                Fetch now
              </Btn>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2">
          <a href={feed.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs hover:underline"
            style={{ color: "var(--muted-foreground)" }}>
            <ExternalLink className="size-3" /> {feed.url}
          </a>
          <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
            <Clock className="size-3" /> {feed.schedule}
          </span>
          {feed.lastFetchedAt && (
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Last: {formatDistanceToNow(new Date(feed.lastFetchedAt), { addSuffix: true })}
            </span>
          )}
        </div>

      </div>

      {/* Tabs */}
      <Tabs.Root
        defaultValue="fields"
        className="flex flex-col flex-1 overflow-hidden"
        onValueChange={(v) => { if (v === "data" && dataTab === "idle") loadRecords() }}
      >
        <Tabs.List
          className="flex border-b flex-shrink-0 px-6"
          style={{ borderColor: "var(--border)" }}
        >
          {[
            { value: "fields",    label: `Fields (${feed.fields.length})` },
            { value: "filters",   label: "Filters" },
            { value: "data",      label: "Data" },
            { value: "changes",   label: `Changes (${changes.length})` },
            { value: "snapshots", label: `Snapshots (${snapshots.length})` },
          ].map(({ value, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={tabTriggerCls}
              style={
                {
                  "--active-color": "#818cf8",
                } as React.CSSProperties
              }
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ── Filters tab ── */}
        <Tabs.Content value="filters" className="flex-1 overflow-auto">
          <XmlFeedFiltersTab
            feedId={feed.id}
            fields={feed.fields.map((f) => ({ path: f.path, label: f.label }))}
          />
        </Tabs.Content>

        {/* ── Fields tab ── */}
        <Tabs.Content value="fields" className="flex-1 overflow-auto p-4">
          {feed.fields.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
              No fields detected yet. Click "Fetch now" to discover the feed structure.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead style={{ background: "var(--muted)" }}>
                <tr>
                  {["Field path", "Label", "Type", "Attr?", "Frequency", "Sample value"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feed.fields.map((f) => (
                  <tr key={f.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--foreground)" }}>{f.path}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{f.label}</td>
                    <td className="px-3 py-2.5"><TypeBadge type={f.dataType} /></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{f.isAttribute ? "Yes" : "—"}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{f.frequency}</td>
                    <td className="px-3 py-2.5 text-xs max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                      {looksLikeImageUrl(f.sampleValue, f.path) ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={f.sampleValue!}
                            alt=""
                            className="size-8 rounded object-cover flex-shrink-0 bg-zinc-800"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                          />
                          <span className="truncate text-[10px]" title={f.sampleValue!}>{f.sampleValue}</span>
                        </div>
                      ) : (
                        <span className="truncate block" title={f.sampleValue ?? ""}>{f.sampleValue ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tabs.Content>

        {/* ── Data tab ── */}
        <Tabs.Content value="data" className="flex-1 overflow-auto p-4">
          {dataTab === "idle" && (
            <div className="text-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Loading records…
            </div>
          )}
          {dataTab === "loading" && (
            <div className="text-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
              <RefreshCw className="size-4 animate-spin mx-auto mb-2" />
              Loading records…
            </div>
          )}
          {dataTab === "error" && (
            <div className="text-center py-16 text-sm text-red-400">
              Failed to load records. Make sure the feed has been fetched at least once.
            </div>
          )}
          {dataTab === "done" && records.length === 0 && (
            <div className="text-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
              No records found. Run a fetch first.
            </div>
          )}
          {dataTab === "done" && records.length > 0 && (
            <div className="overflow-auto">
              <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                {records.length} record{records.length !== 1 ? "s" : ""} · {dataColumns.length} fields
              </p>
              <table className="border-collapse text-xs whitespace-nowrap">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>
                    {dataColumns.map((col) => (
                      <th
                        key={col}
                        className="text-left font-semibold uppercase tracking-wide px-3 py-2.5 text-[10px] border-r"
                        style={{ color: "var(--muted-foreground)", borderColor: "var(--border)" }}
                      >
                        {col.split(".").pop()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const fieldMap = new Map(rec.fields.map((f) => [f.path, f]))
                    return (
                      <tr key={rec._key} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: "var(--border)" }}>
                        {dataColumns.map((col) => {
                          const f = fieldMap.get(col)
                          const val = f ? String(f.value ?? "") : ""
                          const isImg = f?.isImage ?? false
                          return (
                            <td
                              key={col}
                              className="px-3 py-2 border-r max-w-[200px]"
                              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                            >
                              {isImg && val ? (
                                <img
                                  src={val}
                                  alt=""
                                  className="size-8 rounded object-cover bg-zinc-800"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                                />
                              ) : (
                                <span className="truncate block max-w-[180px]" title={val}>{val || "—"}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>

        {/* ── Changes tab ── */}
        <Tabs.Content value="changes" className="flex-1 overflow-auto p-4">
          {changes.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
              No changes detected yet. Changes appear after the second successful fetch.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead style={{ background: "var(--muted)" }}>
                <tr>
                  {["Type", "Record key", "Field", "When", "Details"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr
                      className="border-b cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => setExpandedChange(expandedChange === c.id ? null : c.id)}
                    >
                      <td className="px-3 py-2.5"><ChangeBadge type={c.changeType} /></td>
                      <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--foreground)" }}>
                        {c.recordKey ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {c.fieldPath ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {formatDistanceToNow(new Date(c.detectedAt), { addSuffix: true })}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {c.changeType === "FIELD_MODIFIED" ? (
                          <span className="flex items-center gap-1">
                            {expandedChange === c.id ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                            see diff
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                    {expandedChange === c.id && c.changeType === "FIELD_MODIFIED" && (
                      <tr key={`${c.id}-expand`} style={{ borderColor: "var(--border)" }} className="border-b">
                        <td colSpan={5} className="px-6 py-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase mb-1 text-red-400">Before</p>
                              <pre className="text-xs p-2 rounded-md overflow-auto max-h-32"
                                style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                                {c.oldValue ?? "(empty)"}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase mb-1 text-emerald-400">After</p>
                              <pre className="text-xs p-2 rounded-md overflow-auto max-h-32"
                                style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                                {c.newValue ?? "(empty)"}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </Tabs.Content>

        {/* ── Snapshots tab ── */}
        <Tabs.Content value="snapshots" className="flex-1 overflow-auto p-4">
          {snapshots.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
              No snapshots yet. Click "Fetch now" to run the first fetch.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead style={{ background: "var(--muted)" }}>
                <tr>
                  {["Fetched at", "Status", "Records", "Changes detected", "Error"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--foreground)" }}>
                      {format(new Date(s.fetchedAt), "dd MMM yyyy HH:mm:ss")}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        s.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      )}>
                        {s.status === "SUCCESS" ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--foreground)" }}>{s.recordCount}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: s._count.changes > 0 ? "#f59e0b" : "var(--muted-foreground)" }}>
                      {s._count.changes > 0 ? `${s._count.changes} change${s._count.changes !== 1 ? "s" : ""}` : "None"}
                    </td>
                    <td className="px-3 py-2.5 text-xs max-w-xs truncate text-red-400">
                      {s.errorMessage ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tabs.Content>
      </Tabs.Root>

      <XmlFeedFetchModal
        open={fetchModalOpen}
        feedId={feed.id}
        feedName={feed.name}
        onClose={() => setFetchModalOpen(false)}
        onDone={refreshData}
      />
    </div>
  )
}
