"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, ChevronRight, ChevronLeft, Loader2, Check, Plus, Trash2,
  Link2, Unlink, ArrowRight, Key, Clock, Sparkles, Database, Search,
  Table2, Users, Package, FileText, ShoppingCart,
  Globe, Building2, Truck, CreditCard, Layers, Tag,
  AlertTriangle, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface S1Field {
  name: string; type: string; edittype?: string
  size?: number | string; nullable?: boolean; primaryKey?: boolean
  required?: boolean; readOnly?: boolean; calculated?: boolean
  caption?: string; fullname?: string
}

interface FieldRow {
  softoneFieldName: string
  caption: string
  localColumnName: string
  dataType: string
  isPrimaryKey: boolean
  isTimestamp: boolean
  isSyncable: boolean
  isCustom: boolean
  relatedConfigId: string | null
  relatedLabelField: string | null
  relatedValueField: string | null
}

interface Settings {
  usageType: "PERSISTENT" | "REFERENCE"
  syncDirection: "READ" | "WRITE" | "BIDIRECTIONAL"
  batchSize: number
  syncSchedule: string
  conflictStrategy: "SOFTONE_WINS" | "LOCAL_WINS" | "MANUAL_REVIEW"
  filterClause: string
  showInMenu: boolean
  menuLabel: string
  menuIcon: string
}

interface RefConfig {
  id: string
  objectName: string
  tableName: string
  menuLabel: string | null
  fieldMappings: { localColumnName: string; dataType: string }[]
}

const STEPS = [
  { label: "Object",    desc: "Choose Softone object"  },
  { label: "Table",     desc: "Select table"           },
  { label: "Fields",    desc: "Map field schema"       },
  { label: "Relations", desc: "Link reference objects" },
  { label: "Settings",  desc: "Configure sync"         },
  { label: "Review",    desc: "Confirm & save"         },
]

const SCHEDULE_PRESETS = [
  { label: "Hourly",  value: "0 * * * *"    },
  { label: "6 hrs",   value: "0 */6 * * *"  },
  { label: "12 hrs",  value: "0 */12 * * *" },
  { label: "Daily",   value: "0 0 * * *"    },
  { label: "Weekly",  value: "0 0 * * 1"    },
]

const MENU_ICONS: { key: string; Icon: React.ElementType }[] = [
  { key: "Database",     Icon: Database     },
  { key: "Table2",       Icon: Table2       },
  { key: "Users",        Icon: Users        },
  { key: "Package",      Icon: Package      },
  { key: "FileText",     Icon: FileText     },
  { key: "ShoppingCart", Icon: ShoppingCart },
  { key: "Globe",        Icon: Globe        },
  { key: "Building2",    Icon: Building2    },
  { key: "Truck",        Icon: Truck        },
  { key: "CreditCard",   Icon: CreditCard   },
  { key: "Layers",       Icon: Layers       },
  { key: "Tag",          Icon: Tag          },
]

const DATA_TYPES = [
  { value: "character", label: "Text",     pill: "bg-sky-500/15 text-sky-400 border-sky-500/20"         },
  { value: "numeric",   label: "Number",   pill: "bg-amber-500/15 text-amber-400 border-amber-500/20"   },
  { value: "datetime",  label: "DateTime", pill: "bg-violet-500/15 text-violet-400 border-violet-500/20"},
  { value: "logical",   label: "Boolean",  pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"},
]

const DEFAULT_SETTINGS: Settings = {
  usageType: "PERSISTENT",
  syncDirection: "READ",
  batchSize: 100,
  syncSchedule: "0 */6 * * *",
  conflictStrategy: "SOFTONE_WINS",
  filterClause: "",
  showInMenu: false,
  menuLabel: "",
  menuIcon: "Database",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalColumn(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, "_")
}
function inferDataType(type: string): string {
  const t = (type ?? "").toLowerCase()
  if (t.includes("date") || t.includes("time")) return "datetime"
  if (t.includes("bool") || t.includes("logical") || t === "checkbox") return "logical"
  if (t.includes("int") || t.includes("num") || t.includes("dec") || t.includes("float") || t === "smallint" || t === "integer") return "numeric"
  return "character"
}
function toLocalTableName(s: string) {
  return `softone_${s.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
}

function TypePill({ type, size = "sm" }: { type: string; size?: "xs" | "sm" }) {
  const t = DATA_TYPES.find((d) => d.value === type)
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border font-semibold tracking-wide",
      size === "xs" ? "text-[9px] px-1.5 py-px" : "text-[10px] px-2 py-0.5",
      t?.pill ?? "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
    )}>
      {size === "xs" ? (t?.label.slice(0, 4) ?? type.slice(0, 4)) : (t?.label ?? type)}
    </span>
  )
}

function Toggle({ checked, onChange, color = "bg-indigo-500" }: { checked: boolean; onChange: () => void; color?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        checked ? color : "bg-[var(--muted)]"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

// ─── Step: Object ─────────────────────────────────────────────────────────────

interface S1Object { name: string; type: string; caption: string }

function StepObject({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [objects, setObjects] = useState<S1Object[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function fetchObjects() {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/softone/discover")
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)
      const data = await res.json() as { objects: S1Object[]; error?: string }
      if (data.error) throw new Error(data.error)
      setObjects(data.objects ?? [])
      setFetched(true)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const q = search.toLowerCase()
  const filtered = objects.filter((o) => o.name.toLowerCase().includes(q) || o.caption.toLowerCase().includes(q))

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Softone Business Object</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">Select the object from your Softone ERP to sync into your local database.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3">
          <AlertTriangle className="size-4 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--destructive)]">{error}</p>
        </div>
      )}

      {!fetched ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-10">
          <div className="size-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
            <Database className="size-7 text-[var(--muted-foreground)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--foreground)]">Connect to Softone</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Browse available business objects from your ERP</p>
          </div>
          <button
            onClick={fetchObjects}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {loading ? "Loading objects…" : "Browse objects"}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--muted-foreground)]" />
            <input
              type="search"
              placeholder="Search objects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]/50">
            {filtered.map((obj) => {
              const active = value === obj.name
              return (
                <button
                  key={`${obj.name}-${obj.type}`}
                  onClick={() => onChange(obj.name)}
                  className={cn(
                    "w-full text-left flex items-center justify-between px-4 py-3 transition-colors border-l-2",
                    active
                      ? "bg-[var(--primary)]/8 border-l-[var(--primary)]"
                      : "hover:bg-[var(--muted)]/50 border-l-transparent"
                  )}
                >
                  <div>
                    <p className={cn("text-sm font-mono font-semibold", active ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>{obj.name}</p>
                    {obj.caption && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{obj.caption}</p>}
                  </div>
                  {active && <Check className="size-4 text-[var(--primary)] flex-shrink-0" />}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-[var(--muted-foreground)]">No objects match "{search}"</p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">{filtered.length} of {objects.length} objects</p>
        </div>
      )}
    </div>
  )
}

// ─── Step: Table ──────────────────────────────────────────────────────────────

function StepTable({ objectName, value, onChange }: { objectName: string; value: string; onChange: (v: string) => void }) {
  const [tables, setTables] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetch_() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/softone/discover?object=${encodeURIComponent(objectName)}`)
        const data = await res.json() as { tables?: string[]; error?: string }
        if (!cancelled) {
          if (data.error) throw new Error(data.error)
          setTables(data.tables ?? [])
        }
      } catch (err: any) { if (!cancelled) setError(err.message) }
      finally { if (!cancelled) setLoading(false) }
    }
    fetch_()
    return () => { cancelled = true }
  }, [objectName])

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Database Table</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Choose which table within <span className="font-mono text-[var(--foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">{objectName}</span> to sync.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3">
          <AlertTriangle className="size-4 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--destructive)]">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-7 animate-spin text-[var(--muted-foreground)]" />
          <p className="text-sm text-[var(--muted-foreground)]">Loading tables…</p>
        </div>
      ) : !loading && tables.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-8">
          <p className="text-sm text-[var(--muted-foreground)]">No tables found for this object.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]/50">
          {tables.map((t) => {
            const active = value === t
            return (
              <button
                key={t}
                onClick={() => onChange(t)}
                className={cn(
                  "w-full text-left flex items-center justify-between px-4 py-3 transition-colors border-l-2",
                  active
                    ? "bg-[var(--primary)]/8 border-l-[var(--primary)]"
                    : "hover:bg-[var(--muted)]/50 border-l-transparent"
                )}
              >
                <span className={cn("text-sm font-mono font-semibold", active ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>{t}</span>
                {active && <Check className="size-4 text-[var(--primary)] flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Step: Fields ─────────────────────────────────────────────────────────────

function StepFields({
  objectName, tableName, fields, onChange,
}: { objectName: string; tableName: string; fields: FieldRow[]; onChange: (rows: FieldRow[]) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [refConfigs, setRefConfigs] = useState<RefConfig[]>([])

  useEffect(() => {
    if (fields.length > 0) return
    let cancelled = false
    async function fetchFields() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/softone/fields?object=${encodeURIComponent(objectName)}&table=${encodeURIComponent(tableName)}`)
        const data = await res.json() as { fields: S1Field[]; error?: string }
        if (!cancelled) {
          if (data.error) throw new Error(data.error)
          const rows: FieldRow[] = (data.fields ?? []).map((f) => ({
            softoneFieldName: f.name,
            caption: f.caption ?? "",
            localColumnName: toLocalColumn(f.name),
            dataType: inferDataType(f.type),
            isPrimaryKey: !!f.primaryKey,
            isTimestamp: ["UPDDATE", "INSDATE"].includes(f.name),
            isSyncable: true,
            isCustom: false,
            relatedConfigId: null,
            relatedLabelField: null,
            relatedValueField: null,
          }))
          onChange(rows)
          setSelectedIdx(0)
        }
      } catch (err: any) { if (!cancelled) setError(err.message) }
      finally { if (!cancelled) setLoading(false) }
    }
    fetchFields()
    return () => { cancelled = true }
  }, [objectName, tableName])

  useEffect(() => {
    fetch("/api/sync-config")
      .then((r) => r.json())
      .then((data: any[]) => setRefConfigs(data.map((c) => ({
        id: c.id, objectName: c.objectName, tableName: c.tableName,
        menuLabel: c.menuLabel,
        fieldMappings: (c.fieldMappings ?? []).map((m: any) => ({ localColumnName: m.localColumnName, dataType: m.dataType })),
      }))))
      .catch(() => {})
  }, [])

  function update(i: number, patch: Partial<FieldRow>) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function setPK(i: number) {
    onChange(fields.map((f, idx) => ({ ...f, isPrimaryKey: idx === i })))
  }
  function addCustomField() {
    const n = fields.filter((f) => f.isCustom).length + 1
    const newField: FieldRow = {
      softoneFieldName: `custom_${n}`, caption: "",
      localColumnName: `custom_${n}`, dataType: "character",
      isPrimaryKey: false, isTimestamp: false, isSyncable: true, isCustom: true,
      relatedConfigId: null, relatedLabelField: null, relatedValueField: null,
    }
    onChange([...fields, newField])
    setSelectedIdx(fields.length)
  }
  function removeField(i: number) {
    onChange(fields.filter((_, idx) => idx !== i))
    setSelectedIdx((prev) => Math.min(prev, fields.length - 2))
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="size-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">Loading fields from Softone…</p>
    </div>
  )
  if (error) return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3">
      <AlertTriangle className="size-4 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
      <p className="text-xs text-[var(--destructive)]">{error}</p>
    </div>
  )
  if (fields.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-8">
      <p className="text-sm text-[var(--muted-foreground)]">No fields found for this table.</p>
    </div>
  )

  const sel = fields[selectedIdx] ?? fields[0]
  const selIdx = fields[selectedIdx] ? selectedIdx : 0
  const syncCount = fields.filter((f) => f.isSyncable).length
  const relConfig = refConfigs.find((c) => c.id === sel?.relatedConfigId)
  // "" means link panel is open but no config selected yet; undefined means unlinked
  const isLinkOpen = sel?.relatedConfigId !== null && sel?.relatedConfigId !== undefined

  return (
    <div className="flex gap-0 rounded-xl border border-[var(--border)] overflow-hidden" style={{ height: 420 }}>

      {/* ── Left: field list ── */}
      <div className="flex flex-col border-r border-[var(--border)] flex-shrink-0" style={{ width: 224 }}>
        {/* toolbar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] bg-[var(--muted)]/20 flex-shrink-0">
          <span className="text-xs font-semibold text-[var(--foreground)]">
            {syncCount} <span className="font-normal text-[var(--muted-foreground)]">/ {fields.length}</span>
          </span>
          <div className="flex gap-2">
            <button onClick={() => onChange(fields.map((f) => ({ ...f, isSyncable: true })))} className="text-[10px] font-semibold text-[var(--primary)] hover:underline">All</button>
            <span className="text-[10px] text-[var(--border)]">·</span>
            <button onClick={() => onChange(fields.map((f) => ({ ...f, isSyncable: false })))} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline">None</button>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto">
          {fields.map((f, i) => {
            const isSelected = i === selIdx
            return (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={cn(
                  "w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-colors border-b border-[var(--border)]/40 last:border-0 border-l-2",
                  isSelected
                    ? "bg-[var(--primary)]/8 border-l-[var(--primary)]"
                    : "hover:bg-[var(--muted)]/40 border-l-transparent"
                )}
              >
                <input
                  type="checkbox"
                  checked={f.isSyncable}
                  onChange={() => update(i, { isSyncable: !f.isSyncable })}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded flex-shrink-0 accent-indigo-500 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-mono font-semibold truncate leading-tight",
                    f.isCustom ? "text-violet-400" : "text-[var(--foreground)]",
                    !f.isSyncable && "opacity-35 line-through"
                  )}>
                    {f.softoneFieldName}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <TypePill type={f.dataType} size="xs" />
                    {f.isPrimaryKey    && <Key   className="size-3 text-amber-400 flex-shrink-0" />}
                    {f.isTimestamp     && <Clock className="size-3 text-violet-400 flex-shrink-0" />}
                    {f.relatedConfigId && <Link2 className="size-3 text-indigo-400 flex-shrink-0" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* add custom */}
        <div className="px-3 py-2.5 border-t border-[var(--border)] bg-[var(--muted)]/10 flex-shrink-0">
          <button
            onClick={addCustomField}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] py-2 text-xs text-[var(--muted-foreground)] hover:text-violet-400 hover:border-violet-400/40 hover:bg-violet-500/3 transition-all"
          >
            <Plus className="size-3.5" /> Add custom field
          </button>
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      <div className="flex-1 overflow-y-auto bg-[var(--background)]">
        {!sel ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] gap-2">
            <p className="text-sm">Select a field to configure it</p>
          </div>
        ) : (
          <div className="p-5 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {sel.isCustom ? (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <input
                      value={sel.softoneFieldName}
                      onChange={(e) => update(selIdx, {
                        softoneFieldName: e.target.value,
                        localColumnName: toLocalColumn(e.target.value),
                      })}
                      className="text-base font-mono font-bold text-violet-400 bg-transparent border-b-2 border-violet-400/40 focus:outline-none focus:border-violet-400 w-44 min-w-0"
                      placeholder="field_name"
                    />
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-bold border border-violet-500/20 flex-shrink-0">CUSTOM</span>
                  </div>
                ) : (
                  <h3 className="text-base font-mono font-bold text-[var(--foreground)]">{sel.softoneFieldName}</h3>
                )}
                {sel.caption && <p className="text-xs text-[var(--muted-foreground)] mt-1">{sel.caption}</p>}
                {!sel.isSyncable && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] rounded-full px-2 py-0.5">
                    <X className="size-2.5" /> Excluded from sync
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {sel.isCustom && (
                  <button
                    onClick={() => removeField(selIdx)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--destructive)]/25 px-2.5 py-1.5 text-xs text-[var(--destructive)] hover:bg-[var(--destructive)]/5 transition-colors"
                  >
                    <Trash2 className="size-3" /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* ── Column settings ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Column settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1.5">Local column name</label>
                  <input
                    type="text"
                    value={sel.localColumnName}
                    onChange={(e) => update(selIdx, { localColumnName: e.target.value })}
                    disabled={!sel.isSyncable}
                    className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1.5">Data type</label>
                  {sel.isCustom ? (
                    <select
                      value={sel.dataType}
                      onChange={(e) => update(selIdx, { dataType: e.target.value })}
                      className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      {DATA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2">
                      <TypePill type={sel.dataType} size="sm" />
                      <span className="text-xs text-[var(--muted-foreground)]">from Softone</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Flags ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Field flags</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPK(sel.isPrimaryKey ? -1 : selIdx)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all",
                    sel.isPrimaryKey
                      ? "border-amber-400/60 bg-amber-400/8"
                      : "border-[var(--border)] hover:border-amber-400/30 hover:bg-amber-400/3"
                  )}
                >
                  <div className={cn("size-7 rounded-lg flex items-center justify-center flex-shrink-0", sel.isPrimaryKey ? "bg-amber-400/20" : "bg-[var(--muted)]")}>
                    <Key className={cn("size-3.5", sel.isPrimaryKey ? "text-amber-400" : "text-[var(--muted-foreground)]")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--foreground)]">Primary Key</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Unique row identifier</p>
                  </div>
                  {sel.isPrimaryKey && <Check className="size-3.5 text-amber-400 flex-shrink-0" />}
                </button>

                <button
                  onClick={() => update(selIdx, { isTimestamp: !sel.isTimestamp })}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all",
                    sel.isTimestamp
                      ? "border-violet-500/60 bg-violet-500/8"
                      : "border-[var(--border)] hover:border-violet-500/30 hover:bg-violet-500/3"
                  )}
                >
                  <div className={cn("size-7 rounded-lg flex items-center justify-center flex-shrink-0", sel.isTimestamp ? "bg-violet-500/20" : "bg-[var(--muted)]")}>
                    <Clock className={cn("size-3.5", sel.isTimestamp ? "text-violet-400" : "text-[var(--muted-foreground)]")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--foreground)]">Timestamp</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">UPDDATE / INSDATE</p>
                  </div>
                  {sel.isTimestamp && <Check className="size-3.5 text-violet-400 flex-shrink-0" />}
                </button>
              </div>
            </div>

            {/* ── Relationship ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Relationship</p>
                {isLinkOpen && (
                  <button
                    onClick={() => update(selIdx, { relatedConfigId: null, relatedLabelField: null, relatedValueField: null })}
                    className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                  >
                    <Unlink className="size-3" /> Unlink
                  </button>
                )}
              </div>

              {!isLinkOpen ? (
                <button
                  onClick={() => update(selIdx, { relatedConfigId: "" as string })}
                  className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] px-4 py-3 hover:border-indigo-400/40 hover:bg-indigo-500/3 transition-all text-left group"
                >
                  <div className="size-8 rounded-lg bg-[var(--muted)] group-hover:bg-indigo-500/15 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Link2 className="size-4 text-[var(--muted-foreground)] group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--foreground)]">Link to another table</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Power combo boxes with data from a synced config</p>
                  </div>
                  <ChevronRight className="size-3.5 text-[var(--muted-foreground)] ml-auto flex-shrink-0" />
                </button>
              ) : (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-500/20 bg-indigo-500/5">
                    <Link2 className="size-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-indigo-400">Linked table</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">Sync configuration</label>
                      <select
                        value={sel.relatedConfigId ?? ""}
                        onChange={(e) => update(selIdx, {
                          relatedConfigId: e.target.value || ("" as string),
                          relatedLabelField: null,
                          relatedValueField: null,
                        })}
                        className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      >
                        <option value="">— select a sync config —</option>
                        {refConfigs.map((c) => (
                          <option key={c.id} value={c.id}>{c.menuLabel ?? c.objectName} ({c.tableName})</option>
                        ))}
                      </select>
                    </div>
                    {sel.relatedConfigId && relConfig ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">Display label</label>
                          <select
                            value={sel.relatedLabelField ?? ""}
                            onChange={(e) => update(selIdx, { relatedLabelField: e.target.value || null })}
                            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                          >
                            <option value="">— pick column —</option>
                            {relConfig.fieldMappings.map((m) => <option key={m.localColumnName} value={m.localColumnName}>{m.localColumnName}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">Stored value (FK)</label>
                          <select
                            value={sel.relatedValueField ?? ""}
                            onChange={(e) => update(selIdx, { relatedValueField: e.target.value || null })}
                            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                          >
                            <option value="">— pick column —</option>
                            {relConfig.fieldMappings.map((m) => <option key={m.localColumnName} value={m.localColumnName}>{m.localColumnName}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : sel.relatedConfigId === "" ? (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Select a config above to map label and value columns.</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step: Relations ──────────────────────────────────────────────────────────

function StepRelations({ fields, onChange }: { fields: FieldRow[]; onChange: (rows: FieldRow[]) => void }) {
  const [refConfigs, setRefConfigs] = useState<RefConfig[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    fetch("/api/sync-config")
      .then((r) => r.json())
      .then((data: any[]) =>
        setRefConfigs(
          data
            .filter((c) => c.usageType === "REFERENCE")
            .map((c) => ({
              id: c.id,
              objectName: c.objectName,
              tableName: c.tableName,
              menuLabel: c.menuLabel,
              fieldMappings: (c.fieldMappings ?? []).map((m: any) => ({
                localColumnName: m.localColumnName,
                dataType: m.dataType,
              })),
            }))
        )
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function update(i: number, patch: Partial<FieldRow>) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  const syncable = fields.map((f, i) => ({ f, i })).filter(({ f }) => f.isSyncable)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Field Relations</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Link fields to Reference configs to power combo boxes and dropdowns. This step is optional — leave blank to skip.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6">
          <Loader2 className="size-4 animate-spin text-[var(--muted-foreground)]" />
          <span className="text-sm text-[var(--muted-foreground)]">Loading reference configs…</span>
        </div>
      ) : refConfigs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/10 py-12">
          <div className="size-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
            <Link2 className="size-6 text-[var(--muted-foreground)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--foreground)]">No Reference configs found</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Create a Reference / Lookup config first to use as a combo box source.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider w-40">Field</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider w-20">Type</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Linked Reference Config</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider w-36">Display label</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider w-36">Stored value (FK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/50">
              {syncable.map(({ f, i }) => {
                const refConfig = refConfigs.find((c) => c.id === f.relatedConfigId)
                return (
                  <tr key={i} className={cn("transition-colors", f.relatedConfigId ? "bg-indigo-500/3" : "hover:bg-[var(--muted)]/10")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {f.relatedConfigId && <Link2 className="size-3 text-indigo-400 flex-shrink-0" />}
                        <span className="font-mono text-xs font-semibold text-[var(--foreground)] truncate">{f.softoneFieldName}</span>
                      </div>
                      <p className="text-[10px] text-[var(--muted-foreground)] font-mono pl-0.5 truncate">{f.localColumnName}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <TypePill type={f.dataType} size="xs" />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={f.relatedConfigId ?? ""}
                        onChange={(e) => update(i, {
                          relatedConfigId:  e.target.value || null,
                          relatedLabelField: null,
                          relatedValueField: null,
                        })}
                        className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      >
                        <option value="">— none —</option>
                        {refConfigs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.menuLabel ?? c.objectName} ({c.tableName})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      {refConfig ? (
                        <select
                          value={f.relatedLabelField ?? ""}
                          onChange={(e) => update(i, { relatedLabelField: e.target.value || null })}
                          className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                        >
                          <option value="">— pick —</option>
                          {refConfig.fieldMappings.map((m) => (
                            <option key={m.localColumnName} value={m.localColumnName}>{m.localColumnName}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {refConfig ? (
                        <select
                          value={f.relatedValueField ?? ""}
                          onChange={(e) => update(i, { relatedValueField: e.target.value || null })}
                          className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                        >
                          <option value="">— pick —</option>
                          {refConfig.fieldMappings.map((m) => (
                            <option key={m.localColumnName} value={m.localColumnName}>{m.localColumnName}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]/30">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Step: Settings ───────────────────────────────────────────────────────────

function StepSettings({ value, onChange }: { value: Settings; onChange: (v: Settings) => void }) {
  function set<K extends keyof Settings>(key: K, val: Settings[K]) {
    onChange({ ...value, [key]: val })
  }
  const isPersistent = value.usageType === "PERSISTENT"

  return (
    <div className="flex flex-col gap-5 h-full">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Sync Configuration</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">Define how and when data is synced between Softone and your database.</p>
      </div>

      {/* Usage type */}
      <div className="grid grid-cols-2 gap-3">
        {(["PERSISTENT", "REFERENCE"] as const).map((type) => {
          const active = value.usageType === type
          const isP = type === "PERSISTENT"
          return (
            <button
              key={type}
              onClick={() => set("usageType", type)}
              className={cn(
                "rounded-xl border-2 px-4 py-4 text-left transition-all",
                active
                  ? isP ? "border-indigo-500 bg-indigo-500/8" : "border-emerald-500 bg-emerald-500/8"
                  : "border-[var(--border)] hover:border-[var(--muted-foreground)]/40"
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("size-7 rounded-lg flex items-center justify-center flex-shrink-0", active ? (isP ? "bg-indigo-500/20" : "bg-emerald-500/20") : "bg-[var(--muted)]")}>
                  {isP
                    ? <Database className={cn("size-3.5", active ? "text-indigo-400" : "text-[var(--muted-foreground)]")} />
                    : <Zap className={cn("size-3.5", active ? "text-emerald-400" : "text-[var(--muted-foreground)]")} />
                  }
                </div>
                <span className={cn("text-sm font-bold", active ? (isP ? "text-indigo-400" : "text-emerald-400") : "text-[var(--foreground)]")}>
                  {isP ? "Persistent Table" : "Reference / Lookup"}
                </span>
                {active && <Check className={cn("size-4 ml-auto flex-shrink-0", isP ? "text-indigo-400" : "text-emerald-400")} />}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed pl-10">
                {isP ? "Creates a MySQL table and syncs on a schedule." : "Fetched on-demand for dropdowns. No table created."}
              </p>
            </button>
          )
        })}
      </div>

      {isPersistent ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Sync Direction</label>
              <select value={value.syncDirection} onChange={(e) => set("syncDirection", e.target.value as Settings["syncDirection"])} className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]">
                <option value="READ">READ — pull from Softone</option>
                <option value="WRITE">WRITE — push to Softone</option>
                <option value="BIDIRECTIONAL">BIDIRECTIONAL — both</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Conflict Strategy</label>
              <select value={value.conflictStrategy} onChange={(e) => set("conflictStrategy", e.target.value as Settings["conflictStrategy"])} className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]">
                <option value="SOFTONE_WINS">Softone wins (by UPDDATE)</option>
                <option value="LOCAL_WINS">Local wins</option>
                <option value="MANUAL_REVIEW">Manual review → queue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Batch Size</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={1000} value={value.batchSize} onChange={(e) => set("batchSize", Number(e.target.value))} className="w-28 rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                <span className="text-xs text-[var(--muted-foreground)]">records / call</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Schedule</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SCHEDULE_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => set("syncSchedule", p.value)} className={cn("rounded-lg px-2.5 py-1 text-xs border font-medium transition-colors", value.syncSchedule === p.value ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]")}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input type="text" value={value.syncSchedule} onChange={(e) => set("syncSchedule", e.target.value)} placeholder="cron expression" className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
            </div>
          </div>

          {/* Filter clause */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
              Filter <span className="normal-case font-normal text-[var(--muted-foreground)]/60">(optional — passed as FILTERS to getBrowserInfo)</span>
            </label>
            <input
              type="text"
              value={value.filterClause}
              onChange={(e) => set("filterClause", e.target.value)}
              placeholder={`e.g. TRDR.ISACTIVE=1 AND TRDR.TRDRTYPE=1`}
              className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              Limits records fetched from SoftOne. Uses SoftOne browser filter syntax.
            </p>
          </div>

          {/* Show in menu */}
          <div className={cn("rounded-xl border-2 overflow-hidden transition-all", value.showInMenu ? "border-indigo-500/40" : "border-[var(--border)]")}>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className={cn("size-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors", value.showInMenu ? "bg-indigo-500/15" : "bg-[var(--muted)]")}>
                  <Sparkles className={cn("size-4", value.showInMenu ? "text-indigo-400" : "text-[var(--muted-foreground)]")} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Show in sidebar</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Add this table to the Data Tables navigation group</p>
                </div>
              </div>
              <Toggle checked={value.showInMenu} onChange={() => set("showInMenu", !value.showInMenu)} />
            </div>
            {value.showInMenu && (
              <div className="px-4 pb-4 border-t border-[var(--border)]/60 pt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Menu label</label>
                  <input type="text" value={value.menuLabel} onChange={(e) => set("menuLabel", e.target.value)} placeholder="e.g. Customers" className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Icon</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {MENU_ICONS.map(({ key, Icon }) => (
                      <button key={key} onClick={() => set("menuIcon", key)} title={key} className={cn("rounded-xl p-2.5 flex items-center justify-center transition-all border", value.menuIcon === key ? "border-indigo-500 bg-indigo-500/15 text-indigo-400 scale-105" : "border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]")}>
                        <Icon className="size-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-5">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <Zap className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400 mb-1.5">On-demand lookup</p>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Available at <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-400">/api/softone/lookup?config=ID</span> for combo boxes and dropdowns.
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1.5">No MySQL table or cron job will be created.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step: Review ─────────────────────────────────────────────────────────────

function StepReview({ objectName, tableName, fields, settings }: {
  objectName: string; tableName: string; fields: FieldRow[]; settings: Settings
}) {
  const syncable = fields.filter((f) => f.isSyncable)
  const pk = fields.find((f) => f.isPrimaryKey)
  const customCount = syncable.filter((f) => f.isCustom).length
  const relCount = syncable.filter((f) => f.relatedConfigId).length
  const isPersistent = settings.usageType === "PERSISTENT"
  const localTableName = toLocalTableName(tableName)
  const IconComponent = MENU_ICONS.find((i) => i.key === settings.menuIcon)?.Icon ?? Database

  const rows: { label: string; value: string; sub?: string; warn?: boolean; mono?: boolean }[] = [
    { label: "Fields synced", value: `${syncable.length} of ${fields.length}`, ...(customCount > 0 ? { sub: `+${customCount} custom` } : {}) },
    { label: "Primary key",   value: pk?.softoneFieldName ?? "None set", warn: !pk },
    ...(isPersistent ? [
      { label: "Direction",   value: settings.syncDirection },
      { label: "Schedule",    value: settings.syncSchedule, mono: true },
      { label: "Conflict",    value: settings.conflictStrategy.replace(/_/g, " ").toLowerCase() },
      { label: "Batch size",  value: `${settings.batchSize} records` },
    ] : []),
    ...(relCount > 0 ? [{ label: "Linked fields", value: `${relCount} field${relCount > 1 ? "s" : ""}` }] : []),
  ]

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Review & Confirm</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">Check everything below, then save to create your sync configuration.</p>
      </div>

      {/* Main card */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className={cn("px-5 py-4 flex items-center gap-4", isPersistent ? "bg-indigo-500/8 border-b border-indigo-500/15" : "bg-emerald-500/8 border-b border-emerald-500/15")}>
          <div className={cn("size-10 rounded-xl flex items-center justify-center flex-shrink-0", isPersistent ? "bg-indigo-500/20" : "bg-emerald-500/20")}>
            <Database className={cn("size-5", isPersistent ? "text-indigo-400" : "text-emerald-400")} />
          </div>
          <div>
            <p className={cn("text-sm font-bold", isPersistent ? "text-indigo-400" : "text-emerald-400")}>
              {isPersistent ? "Persistent Table" : "Reference / Lookup"}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[var(--muted-foreground)]">{objectName}</span>
              <span className="text-[var(--border)]">·</span>
              <span className="text-xs font-mono text-[var(--foreground)]">{tableName}</span>
              {isPersistent && (
                <>
                  <ArrowRight className="size-3 text-[var(--muted-foreground)]" />
                  <span className="text-xs font-mono text-indigo-400">{localTableName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3">
          {rows.map(({ label, value, sub, warn, mono }) => (
            <div key={label} className="px-4 py-3 border-b border-r border-[var(--border)] [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(3n)]:border-r-0">
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">{label}</p>
              <p className={cn("text-sm font-bold", warn ? "text-amber-400" : "text-[var(--foreground)]", mono && "font-mono text-xs")}>
                {value}
              </p>
              {sub && <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar preview */}
      {isPersistent && settings.showInMenu && (
        <div className="flex items-center gap-4 rounded-xl border border-indigo-500/25 bg-indigo-500/5 px-5 py-3.5">
          <div className="size-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <IconComponent className="size-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{settings.menuLabel || tableName}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Will appear in the Data Tables sidebar group</p>
          </div>
          <span className="ml-auto text-[10px] font-bold text-indigo-400 bg-indigo-500/10 rounded-full px-2.5 py-1 flex-shrink-0">sidebar</span>
        </div>
      )}

      {/* Warnings */}
      {isPersistent && !pk && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3.5">
          <AlertTriangle className="size-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-400">No primary key selected</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Conflict resolution won't work correctly. Go back to Fields to set one.</p>
          </div>
        </div>
      )}

      {/* What will happen */}
      <div className={cn("rounded-xl border px-4 py-3", isPersistent ? "border-[var(--border)] bg-[var(--muted)]/20" : "border-emerald-500/25 bg-emerald-500/5")}>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          {isPersistent ? (
            <>Saving will create <span className="font-mono text-indigo-400">{localTableName}</span> with {syncable.length} column{syncable.length !== 1 ? "s" : ""} plus <span className="font-mono">_synced_at</span> and <span className="font-mono">_sync_config_id</span> metadata columns.</>
          ) : (
            "No MySQL table will be created. Accessible via the lookup API for combo boxes and dropdowns."
          )}
        </p>
      </div>
    </div>
  )
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function CreateSyncConfigDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [objectName, setObjectName] = useState("")
  const [tableName, setTableName] = useState("")
  const [fields, setFields] = useState<FieldRow[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  function reset() {
    setStep(0); setObjectName(""); setTableName(""); setFields([])
    setSettings(DEFAULT_SETTINGS); setError(null)
  }

  const canNext = [
    () => objectName.length > 0,
    () => tableName.length > 0,
    () => fields.some((f) => f.isSyncable),
    () => true, // Relations — optional
    () => true, // Settings
    () => true, // Review
  ][step]?.() ?? false

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/sync-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectName, tableName, ...settings,
          filterClause: settings.filterClause || undefined,
          menuLabel: settings.menuLabel || undefined,
          fieldMappings: fields.filter((f) => f.isSyncable).map((f) => ({
            softoneFieldName: f.softoneFieldName,
            localColumnName: f.localColumnName,
            dataType: f.dataType,
            isPrimaryKey: f.isPrimaryKey,
            isTimestamp: f.isTimestamp,
            isSyncable: f.isSyncable,
            isCustom: f.isCustom,
            relatedConfigId: f.relatedConfigId || null,
            relatedLabelField: f.relatedLabelField || null,
            relatedValueField: f.relatedValueField || null,
          })),
          createdBy: "admin",
        }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: unknown }
        throw new Error(JSON.stringify(body.error ?? "Unknown error"))
      }
      const result = await res.json() as { tableWarning?: string }
      if (result.tableWarning) {
        setError(`Config saved, but table creation failed: ${result.tableWarning}`)
        router.refresh()
        return
      }
      setOpen(false); reset(); router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
          style={{ maxHeight: "min(90vh, 820px)" }}
        >

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                <Database className="size-4 text-[var(--primary)]" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-bold text-[var(--foreground)]">New Sync Configuration</Dialog.Title>
                <p className="text-[11px] text-[var(--muted-foreground)]">Step {step + 1} of {STEPS.length} — {STEPS[step]?.desc}</p>
              </div>
            </div>
            <Dialog.Close className="size-8 rounded-xl flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-1 min-h-0">

            {/* Left step navigator */}
            <div className="w-48 flex-shrink-0 border-r border-[var(--border)] bg-[var(--muted)]/15 p-3 flex flex-col gap-0.5">
              {STEPS.map((s, i) => {
                const isDone   = i < step
                const isActive = i === step
                const isFuture = i > step
                return (
                  <div
                    key={s.label}
                    onClick={() => isDone && setStep(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 select-none transition-colors",
                      isActive ? "bg-[var(--background)] border border-[var(--border)] shadow-sm" : "",
                      isDone ? "cursor-pointer hover:bg-[var(--muted)]/60" : "",
                      isFuture ? "opacity-35 cursor-default" : ""
                    )}
                  >
                    <div className={cn(
                      "size-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all",
                      isDone   ? "bg-[var(--primary)] text-[var(--primary-foreground)]" :
                      isActive ? "bg-[var(--primary)] text-[var(--primary-foreground)] ring-4 ring-[var(--primary)]/20" :
                                 "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    )}>
                      {isDone ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold truncate", isActive || isDone ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>
                        {s.label}
                      </p>
                      {isActive && <p className="text-[10px] text-[var(--muted-foreground)] truncate">{s.desc}</p>}
                    </div>
                  </div>
                )
              })}

              {/* Context summary at bottom */}
              {(objectName || tableName) && (
                <div className="mt-auto pt-3 space-y-2 border-t border-[var(--border)]">
                  {objectName && (
                    <div>
                      <p className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Object</p>
                      <p className="text-[11px] font-mono font-semibold text-[var(--foreground)] truncate">{objectName}</p>
                    </div>
                  )}
                  {tableName && (
                    <div>
                      <p className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Table</p>
                      <p className="text-[11px] font-mono font-semibold text-[var(--foreground)] truncate">{tableName}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto p-6">
              {step === 0 && <StepObject value={objectName} onChange={setObjectName} />}
              {step === 1 && <StepTable objectName={objectName} value={tableName} onChange={setTableName} />}
              {step === 2 && <StepFields objectName={objectName} tableName={tableName} fields={fields} onChange={setFields} />}
              {step === 3 && <StepRelations fields={fields} onChange={setFields} />}
              {step === 4 && <StepSettings value={settings} onChange={setSettings} />}
              {step === 5 && <StepReview objectName={objectName} tableName={tableName} fields={fields} settings={settings} />}
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="mx-6 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--destructive)]">{error}</p>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] flex-shrink-0">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="size-4" /> Back
            </button>

            <div className="flex items-center gap-3">
              {/* progress dots */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => i < step && setStep(i)}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      i === step ? "w-5 h-1.5 bg-[var(--primary)]" :
                      i < step   ? "w-1.5 h-1.5 bg-[var(--primary)]/50 cursor-pointer hover:bg-[var(--primary)]/70" :
                                   "w-1.5 h-1.5 bg-[var(--muted)]"
                    )}
                  />
                ))}
              </div>

              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              ) : (
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {saving ? "Saving…" : "Save configuration"}
                </button>
              )}
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
