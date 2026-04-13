"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowRight, Save, Loader2, X, GitCompareArrows } from "lucide-react"
import { cn } from "@/lib/utils"

interface Connection { id: string; name: string; type: string }
interface Entry { id: string; sourceValue: string; targetValue: string; label: string | null }
interface MappingTable {
  id: string; name: string; description: string | null
  sourceConnection: Connection | null
  targetConnection: Connection | null
  _count: { entries: number }
  entries: Entry[]
}

const TYPE_COLORS: Record<string, string> = {
  SOFTONE: "text-indigo-400", SHOPIFY: "text-green-400",
  MAGENTO: "text-orange-400", WOOCOMMERCE: "text-purple-400", CUSTOM_REST: "text-sky-400",
}

// ─── New table dialog ─────────────────────────────────────────────────────────

function NewTableDialog({ connections, onCreated }: { connections: Connection[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [srcId, setSrcId] = useState("")
  const [tgtId, setTgtId] = useState("")
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, sourceConnectionId: srcId || null, targetConnectionId: tgtId || null }),
      })
      onCreated()
      setOpen(false)
      setName(""); setDesc(""); setSrcId(""); setTgtId("")
    } finally { setSaving(false) }
  }

  const sel = (label: string, value: string, onChange: (v: string) => void) => (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        style={{ borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }}
      >
        <option value="">— Any / not specified —</option>
        {connections.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
        ))}
      </select>
    </div>
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
        style={{ background: "#6366f1", color: "#fff" }}
      >
        <Plus className="size-3.5" /> New mapping table
      </button>
    )
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid #6366f1" }}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>New mapping table</p>
        <button onClick={() => setOpen(false)} style={{ color: "var(--muted-foreground)" }}><X className="size-4" /></button>
      </div>
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
          Name <span className="font-normal">(used as <code className="font-mono">@map:name</code> in field transformations)</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="countries, payment_methods, order_statuses…"
          className="w-full rounded-lg border px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          style={{ borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }}
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>Description (optional)</label>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. Country codes between Magento and Softone"
          className="w-full rounded-lg border px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          style={{ borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sel("Source system (from)", srcId, setSrcId)}
        {sel("Target system (to)", tgtId, setTgtId)}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-[12px]" style={{ color: "var(--muted-foreground)" }}>Cancel</button>
        <button
          onClick={create}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
          style={{ background: "#6366f1", color: "#fff" }}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Create
        </button>
      </div>
    </div>
  )
}

// ─── Entry editor ─────────────────────────────────────────────────────────────

function EntryEditor({
  tableId, initialEntries, sourceName, targetName, isAdmin,
}: {
  tableId: string; initialEntries: Entry[]
  sourceName: string; targetName: string; isAdmin: boolean
}) {
  type Row = { id?: string; sourceValue: string; targetValue: string; label: string }
  const [rows, setRows] = useState<Row[]>(
    initialEntries.length > 0
      ? initialEntries.map((e) => ({ id: e.id, sourceValue: e.sourceValue, targetValue: e.targetValue, label: e.label ?? "" }))
      : [{ sourceValue: "", targetValue: "", label: "" }]
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function addRow() { setRows((r) => [...r, { sourceValue: "", targetValue: "", label: "" }]) }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)) }
  function updateRow(i: number, field: keyof Row, val: string) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/mappings/${tableId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows.filter((r) => r.sourceValue && r.targetValue)),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const colStyle = "rounded-lg border px-2.5 py-1.5 text-[12px] w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
  const colBase = { borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 px-1 items-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
          {sourceName} value
        </p>
        <span />
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
          {targetName} value
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
          Label (optional)
        </p>
        <span />
      </div>

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 items-center">
          <input
            value={row.sourceValue}
            onChange={(e) => updateRow(i, "sourceValue", e.target.value)}
            placeholder="GR"
            disabled={!isAdmin}
            className={colStyle}
            style={colBase}
          />
          <ArrowRight className="size-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={row.targetValue}
            onChange={(e) => updateRow(i, "targetValue", e.target.value)}
            placeholder="EL"
            disabled={!isAdmin}
            className={colStyle}
            style={colBase}
          />
          <input
            value={row.label}
            onChange={(e) => updateRow(i, "label", e.target.value)}
            placeholder="Greece"
            disabled={!isAdmin}
            className={colStyle}
            style={colBase}
          />
          {isAdmin ? (
            <button
              onClick={() => removeRow(i)}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : <span />}
        </div>
      ))}

      {isAdmin && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={addRow}
            className="flex items-center gap-1 text-[11px] font-semibold hover:underline"
            style={{ color: "#6366f1" }}
          >
            <Plus className="size-3" /> Add row
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50 transition-colors"
            style={{ background: saved ? "#16a34a" : "#6366f1", color: "#fff" }}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

function MappingTableRow({
  table, connections, isAdmin, onDeleted,
}: {
  table: MappingTable; connections: Connection[]; isAdmin: boolean; onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function del() {
    if (!confirm(`Delete mapping table "${table.name}" and all ${table._count.entries} entries?`)) return
    setDeleting(true)
    await fetch(`/api/mappings/${table.id}`, { method: "DELETE" })
    onDeleted()
  }

  const srcName = table.sourceConnection?.name ?? "Any"
  const tgtName = table.targetConnection?.name ?? "Any"

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--muted)]/20"
        style={{ background: "var(--card)" }}
      >
        <GitCompareArrows className="size-4 shrink-0" style={{ color: "#6366f1" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[12px] font-mono font-semibold" style={{ color: "var(--foreground)" }}>
              @map:{table.name}
            </code>
            {table.description && (
              <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>— {table.description}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-[10px] font-semibold", TYPE_COLORS[table.sourceConnection?.type ?? ""] ?? "text-zinc-400")}>
              {srcName}
            </span>
            <ArrowRight className="size-2.5" style={{ color: "var(--muted-foreground)" }} />
            <span className={cn("text-[10px] font-semibold", TYPE_COLORS[table.targetConnection?.type ?? ""] ?? "text-zinc-400")}>
              {tgtName}
            </span>
            <span className="text-[10px] ml-2" style={{ color: "var(--muted-foreground)" }}>
              {table._count.entries} {table._count.entries === 1 ? "entry" : "entries"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); del() }}
              disabled={deleting}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </button>
          )}
          {open ? <ChevronUp className="size-4" style={{ color: "var(--muted-foreground)" }} />
                : <ChevronDown className="size-4" style={{ color: "var(--muted-foreground)" }} />}
        </div>
      </button>

      {open && (
        <div className="px-4 py-4" style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
          <EntryEditor
            tableId={table.id}
            initialEntries={table.entries}
            sourceName={srcName}
            targetName={tgtName}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function MappingsClient({
  tables: initial, connections, isAdmin,
}: {
  tables: MappingTable[]; connections: Connection[]; isAdmin: boolean
}) {
  const router = useRouter()
  const [tables, setTables] = useState(initial)

  function reload() { router.refresh() }

  return (
    <div className="space-y-6">
      {/* Value mapping tables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>Value mapping tables</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Translate field values between systems. Reference in field transformations as{" "}
              <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--muted)" }}>@map:table_name</code>
            </p>
          </div>
          {isAdmin && <NewTableDialog connections={connections} onCreated={reload} />}
        </div>

        {tables.length === 0 ? (
          <div className="rounded-xl py-14 flex flex-col items-center gap-2 border-2 border-dashed" style={{ borderColor: "var(--border)" }}>
            <GitCompareArrows className="size-8" style={{ color: "var(--muted-foreground)" }} />
            <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>No mapping tables yet</p>
            <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Create tables to translate values like country codes, statuses and payment methods between systems
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tables.map((t) => (
              <MappingTableRow
                key={t.id}
                table={t}
                connections={connections}
                isAdmin={isAdmin}
                onDeleted={reload}
              />
            ))}
          </div>
        )}
      </div>

      {/* How to use */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>How to use value mappings</p>
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          In the entity wizard, set a field's <strong>Transformation</strong> to{" "}
          <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--muted)" }}>@map:countries</code>{" "}
          and the processing engine will automatically look up the source value in the <code className="font-mono text-[10px]">countries</code> table
          and replace it with the mapped target value before writing to the outbound system. If no match is found the original value passes through unchanged.
        </p>
        <div className="mt-2 rounded-lg p-3 font-mono text-[11px] space-y-1" style={{ background: "var(--muted)" }}>
          <p style={{ color: "var(--muted-foreground)" }}>{"//"} Example: Magento country_id "GR" → Softone country "EL"</p>
          <p style={{ color: "#a5b4fc" }}>Field: <span style={{ color: "var(--foreground)" }}>country_id</span></p>
          <p style={{ color: "#a5b4fc" }}>Transformation: <span style={{ color: "#86efac" }}>@map:countries</span></p>
        </div>
      </div>
    </div>
  )
}
