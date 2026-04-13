"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Filter, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { OPERATORS, describeFilter, type FeedFilter } from "@/lib/xml-feed-filters"

interface FeedField { path: string; label: string }

const FILTER_TYPES = [
  { value: "EXCLUDE_FIELD",  label: "Exclude field" },
  { value: "EXCLUDE_RECORD", label: "Exclude records where…" },
]

export function XmlFeedFiltersTab({ feedId, fields }: { feedId: string; fields: FeedField[] }) {
  const [filters,  setFilters]  = useState<FeedFilter[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  // Form state
  const [type,     setType]     = useState<"EXCLUDE_FIELD" | "EXCLUDE_RECORD">("EXCLUDE_FIELD")
  const [field,    setField]    = useState(fields[0]?.path ?? "")
  const [operator, setOperator] = useState("equals")
  const [value,    setValue]    = useState("")

  const needsValue = OPERATORS.find((o) => o.value === operator)?.needsValue ?? true

  useEffect(() => {
    fetch(`/api/xml-feeds/${feedId}/filters`)
      .then((r) => r.json())
      .then((data) => { setFilters(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [feedId])

  async function addFilter() {
    if (!field) return
    setSaving(true)
    try {
      const res = await fetch(`/api/xml-feeds/${feedId}/filters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          field,
          operator: type === "EXCLUDE_RECORD" ? operator : null,
          value:    type === "EXCLUDE_RECORD" && needsValue ? value : null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setFilters((prev) => [...prev, created])
        setValue("")
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteFilter(id: string) {
    await fetch(`/api/xml-feeds/${feedId}/filters/${id}`, { method: "DELETE" })
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  const fieldFilters  = filters.filter((f) => f.type === "EXCLUDE_FIELD")
  const recordFilters = filters.filter((f) => f.type === "EXCLUDE_RECORD")

  return (
    <div className="p-4 max-w-2xl space-y-6">

      {/* Add filter form */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Add exclusion rule</p>

        <div className="flex flex-wrap gap-2 items-end">
          {/* Type */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--muted-foreground)" }}>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="text-sm rounded-md border px-2 py-1.5 bg-transparent outline-none"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              {FILTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--muted-foreground)" }}>Field</label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="text-sm rounded-md border px-2 py-1.5 bg-transparent outline-none max-w-[200px]"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              {fields.map((f) => (
                <option key={f.path} value={f.path}>{f.label !== f.path ? `${f.label} (${f.path})` : f.path}</option>
              ))}
            </select>
          </div>

          {/* Operator (record rules only) */}
          {type === "EXCLUDE_RECORD" && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--muted-foreground)" }}>Condition</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="text-sm rounded-md border px-2 py-1.5 bg-transparent outline-none"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Value */}
          {type === "EXCLUDE_RECORD" && needsValue && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--muted-foreground)" }}>Value</label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. inactive"
                className="text-sm rounded-md border px-2 py-1.5 bg-transparent outline-none w-36"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                onKeyDown={(e) => e.key === "Enter" && addFilter()}
              />
            </div>
          )}

          <button
            onClick={addFilter}
            disabled={saving || !field || (type === "EXCLUDE_RECORD" && needsValue && !value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 self-end"
            style={{ background: "#818cf8", color: "#fff" }}>
            {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add
          </button>
        </div>
      </div>

      {/* Active filters */}
      {loading ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--muted-foreground)" }}>Loading…</p>
      ) : filters.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Filter className="size-8 opacity-20" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No filters yet — all fields and records will be imported</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fieldFilters.length > 0 && (
            <section>
              <p className="text-[11px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                Field exclusions — instant effect, no re-fetch needed
              </p>
              <div className="space-y-1.5">
                {fieldFilters.map((f) => <FilterRow key={f.id} filter={f} onDelete={deleteFilter} />)}
              </div>
            </section>
          )}
          {recordFilters.length > 0 && (
            <section>
              <p className="text-[11px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                Record exclusions — applied on next fetch
              </p>
              <div className="space-y-1.5">
                {recordFilters.map((f) => <FilterRow key={f.id} filter={f} onDelete={deleteFilter} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function FilterRow({ filter, onDelete }: { filter: FeedFilter; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(filter.id)
  }

  const isField = filter.type === "EXCLUDE_FIELD"

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border",
    )} style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0",
          isField ? "bg-violet-500/10 text-violet-400" : "bg-orange-500/10 text-orange-400",
        )}>
          {isField ? "field" : "record"}
        </span>
        <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>
          {describeFilter(filter)}
        </span>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-40"
        style={{ color: "var(--muted-foreground)" }}>
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
