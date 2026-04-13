"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, Loader2, ChevronRight, Plus, Trash2,
  ArrowRight, Check, RefreshCw, Plug, GitMerge, Search,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Connection { id: string; name: string; type: string }

interface DiscoveredField {
  name: string; label?: string
  dataType: "character" | "numeric" | "datetime" | "logical"
  isPrimaryKey?: boolean
}

interface FieldRow {
  externalField: string
  canonicalName: string
  label: string
  dataType: "character" | "numeric" | "datetime" | "logical"
  isPrimaryKey: boolean
  include: boolean
}

interface BindingDraft {
  connectionId: string
  direction: "INBOUND" | "OUTBOUND" | "BOTH"
  objectName: string
  tableName: string
  resourcePath: string
  fieldRows: FieldRow[]
  fieldError?: string
  // For Softone two-level discovery
  objects: { name: string; label?: string }[]
  tables: { name: string; label?: string }[]
  loadingObjects: boolean
  loadingTables: boolean
  loadingFields: boolean
}

const TYPE_LABEL: Record<string, string> = {
  SOFTONE: "Softone ERP", SHOPIFY: "Shopify",
  MAGENTO: "Magento", WOOCOMMERCE: "WooCommerce", CUSTOM_REST: "Custom REST",
}

const DT_OPTIONS = ["character", "numeric", "datetime", "logical"] as const

// ─── Wizard ───────────────────────────────────────────────────────────────────

export function CreateEntityWizard({
  children,
  connections,
}: {
  children: React.ReactNode
  connections: Connection[]
}) {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [step, setStep]   = useState(0) // 0=setup 1=fields 2=targets 3=review
  const [saving, setSaving] = useState(false)

  // Step 0
  const [entityName, setEntityName]   = useState("")
  const [entitySlug, setEntitySlug]   = useState("")
  const [entityDesc, setEntityDesc]   = useState("")
  const [showInMenu, setShowInMenu]   = useState(false)

  // Source binding (inbound)
  const [source, setSource] = useState<BindingDraft>(emptyBinding("INBOUND"))

  // Target bindings (outbound) — can be multiple
  const [targets, setTargets] = useState<BindingDraft[]>([])

  function reset() {
    setStep(0); setEntityName(""); setEntitySlug(""); setEntityDesc("")
    setShowInMenu(false); setSource(emptyBinding("INBOUND")); setTargets([])
  }

  function handleClose(o: boolean) { setOpen(o); if (!o) reset() }

  // Auto-slug from name
  useEffect(() => {
    setEntitySlug(entityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
  }, [entityName])

  // ── Discovery helpers ──────────────────────────────────────────────────────

  async function discoverObjects(draft: BindingDraft, setDraft: (d: BindingDraft) => void) {
    const conn = connections.find((c) => c.id === draft.connectionId)
    if (!conn) return
    setDraft({ ...draft, loadingObjects: true, objects: [], tables: [], objectName: "", tableName: "", fieldRows: [] })
    const res = await fetch(`/api/connections/${conn.id}/discover`)
    const data = await res.json()
    // Deduplicate by name — Softone sometimes returns the same object code twice
    const seen = new Set<string>()
    const objects = (data.objects ?? []).filter((o: { name: string }) => {
      if (seen.has(o.name)) return false
      seen.add(o.name)
      return true
    })
    setDraft({ ...draft, loadingObjects: false, objects, tables: [], objectName: "", tableName: "", fieldRows: [] })
  }

  async function discoverTables(draft: BindingDraft, setDraft: (d: BindingDraft) => void, objectName: string) {
    setDraft({ ...draft, objectName, loadingTables: true, tables: [], tableName: "", fieldRows: [] })
    const res = await fetch(`/api/connections/${draft.connectionId}/discover?object=${encodeURIComponent(objectName)}`)
    const data = await res.json()
    // If system doesn't have sub-tables, go straight to fields
    if (data.tables?.length) {
      setDraft({ ...draft, objectName, loadingTables: false, tables: data.tables, tableName: "", fieldRows: [] })
    } else {
      setDraft({ ...draft, objectName, loadingTables: false, tables: [], tableName: "", fieldRows: [] })
    }
  }

  async function discoverFields(draft: BindingDraft, setDraft: (d: BindingDraft) => void, tableName?: string, bust = false) {
    const tbl = tableName ?? draft.tableName
    setDraft({ ...draft, tableName: tbl ?? "", loadingFields: true, fieldRows: [], fieldError: undefined })
    const params = new URLSearchParams({ object: draft.objectName })
    if (tbl) params.set("table", tbl)
    if (bust) params.set("bust", "1")
    try {
      const res = await fetch(`/api/connections/${draft.connectionId}/discover?${params}`)
      const data = await res.json()
      if (data.error && (!data.fields || data.fields.length === 0)) {
        setDraft({ ...draft, tableName: tbl ?? "", loadingFields: false, fieldRows: [], fieldError: data.error })
        return
      }
      const rows: FieldRow[] = (data.fields ?? []).map((f: DiscoveredField) => ({
        externalField: f.name,
        canonicalName: f.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label: f.label ?? f.name,
        dataType: f.dataType ?? "character",
        isPrimaryKey: !!f.isPrimaryKey,
        include: true,
      }))
      setDraft({ ...draft, tableName: tbl ?? "", loadingFields: false, fieldRows: rows, fieldError: undefined })
    } catch (err) {
      setDraft({ ...draft, tableName: tbl ?? "", loadingFields: false, fieldRows: [], fieldError: String(err) })
    }
  }

  // ── Field row editors ──────────────────────────────────────────────────────

  function FieldTable({ draft, setDraft }: { draft: BindingDraft; setDraft: (d: BindingDraft) => void }) {
    return (
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: "var(--muted)/40", borderBottom: "1px solid var(--border)" }}>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]" style={{ color: "var(--muted-foreground)" }}>✓</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]" style={{ color: "var(--muted-foreground)" }}>Source field</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]" style={{ color: "var(--muted-foreground)" }}>Canonical name</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]" style={{ color: "var(--muted-foreground)" }}>Type</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]" style={{ color: "var(--muted-foreground)" }}>PK</th>
            </tr>
          </thead>
          <tbody>
            {draft.fieldRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < draft.fieldRows.length - 1 ? "1px solid var(--border)" : "none",
                opacity: row.include ? 1 : 0.4 }}>
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={row.include}
                    onChange={(e) => {
                      const rows = [...draft.fieldRows]
                      rows[i] = { ...rows[i], include: e.target.checked }
                      setDraft({ ...draft, fieldRows: rows })
                    }} className="rounded" />
                </td>
                <td className="px-3 py-1.5 font-mono" style={{ color: "var(--muted-foreground)" }}>{row.externalField}</td>
                <td className="px-3 py-1.5">
                  <input
                    value={row.canonicalName}
                    onChange={(e) => {
                      const rows = [...draft.fieldRows]
                      rows[i] = { ...rows[i], canonicalName: e.target.value }
                      setDraft({ ...draft, fieldRows: rows })
                    }}
                    className="w-full rounded border px-2 py-0.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={row.dataType}
                    onChange={(e) => {
                      const rows = [...draft.fieldRows]
                      rows[i] = { ...rows[i], dataType: e.target.value as any }
                      setDraft({ ...draft, fieldRows: rows })
                    }}
                    className="rounded border px-1.5 py-0.5 text-[11px] focus:outline-none"
                    style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
                  >
                    {DT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={row.isPrimaryKey}
                    onChange={(e) => {
                      const rows = draft.fieldRows.map((r, j) => ({ ...r, isPrimaryKey: j === i ? e.target.checked : false }))
                      setDraft({ ...draft, fieldRows: rows })
                    }} className="rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Binding setup panel ────────────────────────────────────────────────────

  function BindingPanel({
    draft,
    setDraft,
    title,
    directionLocked,
  }: {
    draft: BindingDraft
    setDraft: (d: BindingDraft) => void
    title: string
    directionLocked?: "INBOUND" | "OUTBOUND"
  }) {
    const conn = connections.find((c) => c.id === draft.connectionId)
    const hasTables = draft.tables.length > 0

    // ── Object search state ──
    const [objQuery, setObjQuery] = useState("")
    const [objOpen, setObjOpen]   = useState(false)
    const comboRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!objOpen) return
      function onClickOutside(e: MouseEvent) {
        if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
          setObjOpen(false)
          setObjQuery("")
        }
      }
      document.addEventListener("mousedown", onClickOutside)
      return () => document.removeEventListener("mousedown", onClickOutside)
    }, [objOpen])

    // Reset search when objects list changes (new connection selected)
    useEffect(() => { setObjQuery(""); setObjOpen(false) }, [draft.connectionId])

    const selectedObj   = draft.objects.find((o) => o.name === draft.objectName)
    const selectedLabel = selectedObj ? (selectedObj.label ?? selectedObj.name) : ""

    const filteredObjs = objQuery.trim()
      ? draft.objects.filter((o) => {
          const q = objQuery.toLowerCase()
          return (o.name.toLowerCase().includes(q) || (o.label ?? "").toLowerCase().includes(q))
        })
      : draft.objects

    return (
      <div className="space-y-4">
        <p className="text-[12px] font-semibold" style={{ color: "var(--muted-foreground)" }}>{title}</p>

        {/* Connection picker */}
        <div>
          <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>Connection</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  const d = { ...emptyBinding(draft.direction), connectionId: c.id }
                  setDraft(d)
                  discoverObjects(d, setDraft)
                }}
                className={cn(
                  "text-left rounded-xl border px-3 py-2.5 transition-all",
                  draft.connectionId === c.id ? "border-indigo-500 bg-indigo-500/5" : "hover:border-[var(--ring)]"
                )}
                style={{ borderColor: draft.connectionId === c.id ? "#6366f1" : "var(--border)" }}
              >
                <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>{c.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{TYPE_LABEL[c.type] ?? c.type}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Direction (only when not locked) */}
        {!directionLocked && draft.connectionId && (
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>Direction</label>
            <div className="flex gap-2">
              {(["INBOUND", "OUTBOUND", "BOTH"] as const).map((d) => (
                <button key={d}
                  onClick={() => setDraft({ ...draft, direction: d })}
                  className={cn("flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-all",
                    draft.direction === d ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "text-[var(--muted-foreground)]")}
                  style={{ borderColor: draft.direction === d ? "#6366f1" : "var(--border)" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Object picker — searchable combobox */}
        {draft.connectionId && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
                Object / Resource
              </label>
              {draft.loadingObjects && <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--muted-foreground)" }} />}
            </div>

            <div ref={comboRef} className="relative">
              {/* Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
                <input
                  type="text"
                  disabled={draft.loadingObjects || draft.objects.length === 0}
                  placeholder={
                    draft.loadingObjects ? "Loading objects…" :
                    draft.objects.length === 0 ? "No objects available" :
                    selectedLabel || "Search by name or description…"
                  }
                  value={objOpen ? objQuery : selectedLabel}
                  onFocus={() => { setObjOpen(true); setObjQuery("") }}
                  onChange={(e) => { setObjQuery(e.target.value); setObjOpen(true) }}
                  className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  style={{
                    borderColor: objOpen ? "#6366f1" : "var(--input)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              {/* Dropdown */}
              {objOpen && (
                <div
                  className="absolute z-30 mt-1 w-full rounded-xl border shadow-xl overflow-hidden"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  {/* Stats row */}
                  <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      {filteredObjs.length === draft.objects.length
                        ? `${draft.objects.length} objects`
                        : `${filteredObjs.length} of ${draft.objects.length}`}
                    </span>
                    {objQuery && (
                      <button
                        type="button"
                        onClick={() => setObjQuery("")}
                        className="text-[10px] font-semibold"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto max-h-60">
                    {filteredObjs.length === 0 ? (
                      <p className="px-4 py-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        No objects match &ldquo;{objQuery}&rdquo;
                      </p>
                    ) : (
                      filteredObjs.map((o, idx) => {
                        const label = o.label ?? o.name
                        const active = o.name === draft.objectName
                        return (
                          <button
                            key={`${o.name}-${idx}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              discoverTables(draft, setDraft, o.name)
                              setObjOpen(false)
                              setObjQuery("")
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 flex items-start gap-2 transition-colors",
                              active ? "bg-indigo-500/10" : "hover:bg-[var(--muted)]"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium truncate" style={{ color: active ? "#818cf8" : "var(--foreground)" }}>
                                {label}
                              </p>
                              {label !== o.name && (
                                <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                                  {o.name}
                                </p>
                              )}
                            </div>
                            {active && <Check className="size-3.5 text-indigo-400 shrink-0 mt-0.5" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table picker (only Softone-style systems) */}
        {hasTables && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>Table</label>
              {draft.loadingTables && <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--muted-foreground)" }} />}
            </div>
            <select
              value={draft.tableName}
              onChange={(e) => discoverFields(draft, setDraft, e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
            >
              <option value="">Select table…</option>
              {draft.tables.map((t) => <option key={t.name} value={t.name}>{t.label ?? t.name}</option>)}
            </select>
          </div>
        )}

        {/* Refresh fields button when no table picker */}
        {draft.objectName && !hasTables && draft.fieldRows.length === 0 && !draft.loadingFields && (
          <Btn variant="secondary" size="sm" onClick={() => discoverFields(draft, setDraft)}>
            <RefreshCw className="size-3.5" />
            Load fields
          </Btn>
        )}

        {draft.loadingFields && (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 className="size-3.5 animate-spin" /> Loading fields…
          </div>
        )}
      </div>
    )
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  const step0Valid =
    entityName.trim().length > 0 &&
    entitySlug.trim().length > 0 &&
    source.connectionId.trim().length > 0 &&
    source.objectName.trim().length > 0
  const step1Valid = source.fieldRows.some((r) => r.include) && source.fieldRows.some((r) => r.isPrimaryKey && r.include)
  /** Outbound rows the user opened but never configured — omit from API payload */
  function bindingReady(b: BindingDraft) {
    return b.connectionId.trim().length > 0 && b.objectName.trim().length > 0
  }
  const includedFields = source.fieldRows.filter((r) => r.include)

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const canonicalFields = includedFields.map((r, i) => ({
        name: r.canonicalName,
        label: r.label,
        dataType: r.dataType,
        isPrimaryKey: r.isPrimaryKey,
        sortOrder: i,
      }))

      const bindingDrafts = [source, ...targets].filter(bindingReady)
      const allBindings = bindingDrafts.map((b) => ({
        connectionId: b.connectionId,
        direction: b.direction,
        objectName: b.objectName,
        tableName: b.tableName || null,
        fieldMappings: b.fieldRows.filter((r) => r.include).map((r) => ({
          externalField: r.externalField,
          canonicalField: r.canonicalName,
        })),
      }))

      await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entityName,
          slug: entitySlug,
          description: entityDesc || null,
          showInMenu,
          menuLabel: entityName,
          fields: canonicalFields,
          bindings: allBindings,
        }),
      })

      router.refresh()
      setOpen(false)
      reset()
    } finally { setSaving(false) }
  }

  // ── Steps UI ───────────────────────────────────────────────────────────────

  const STEP_LABELS = ["Setup", "Map fields", "Add targets", "Review"]

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}>

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <Dialog.Title className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                New entity
              </Dialog.Title>
              <Dialog.Description className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Define a canonical data schema and connect it to your systems
              </Dialog.Description>
            </div>
            <Dialog.Close className="size-7 rounded-lg flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {/* Step pills */}
          <div className="flex items-center gap-1 px-6 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all",
                  i === step ? "bg-indigo-500/15 text-indigo-400" :
                  i < step ? "text-emerald-500" : "text-[var(--muted-foreground)]"
                )}>
                  {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>}
                  {label}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <ChevronRight className="size-3" style={{ color: "var(--muted-foreground)" }} />
                )}
              </div>
            ))}
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── Step 0: Setup ── */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                      Entity name <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      placeholder="e.g. Orders"
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                      Slug <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={entitySlug}
                      onChange={(e) => setEntitySlug(e.target.value)}
                      placeholder="orders"
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>Description</label>
                  <input
                    value={entityDesc}
                    onChange={(e) => setEntityDesc(e.target.value)}
                    placeholder="What data does this entity represent?"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  <input type="checkbox" id="show-menu" checked={showInMenu}
                    onChange={(e) => setShowInMenu(e.target.checked)} className="rounded" />
                  <label htmlFor="show-menu" className="text-[12px]" style={{ color: "var(--foreground)" }}>
                    Show records in sidebar menu
                  </label>
                </div>

                <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-[12px] font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                    Source system <span className="text-[11px] font-normal" style={{ color: "var(--muted-foreground)" }}>(where data comes from)</span>
                  </p>
                  <BindingPanel draft={source} setDraft={setSource} title="" directionLocked="INBOUND" />
                </div>
              </div>
            )}

            {/* ── Step 1: Map fields ── */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  These fields will form the canonical schema. Check which to include, rename if needed, and mark the primary key.
                </p>
                {source.loadingFields ? (
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    <Loader2 className="size-3.5 animate-spin" /> Loading fields…
                  </div>
                ) : source.fieldRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed flex flex-col items-center gap-3 py-10"
                    style={{ borderColor: "var(--border)" }}>
                    {source.fieldError && (
                      <p className="text-[11px] text-red-400 px-6 text-center">{source.fieldError}</p>
                    )}
                    <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      {source.objectName
                        ? "No fields returned for this object/table"
                        : "No fields discovered — go back and select an object/table"}
                    </p>
                    {source.objectName && (
                      <Btn variant="secondary" size="sm"
                        disabled={source.loadingFields}
                        onClick={() => discoverFields(source, setSource, source.tableName || undefined, true)}>
                        <RefreshCw className="size-3.5" />
                        Retry
                      </Btn>
                    )}
                  </div>
                ) : (
                  <FieldTable draft={source} setDraft={setSource} />
                )}
                {!step1Valid && source.fieldRows.length > 0 && (
                  <p className="text-[11px] text-amber-500">Mark at least one field as primary key (PK)</p>
                )}
              </div>
            )}

            {/* ── Step 2: Add targets ── */}
            {step === 2 && (
              <div className="space-y-5">
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Add outbound systems that will receive processed records. You can skip this and add targets later.
                </p>

                {targets.map((t, i) => (
                  <div key={i} className="rounded-xl border p-4 space-y-4" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>Target {i + 1}</p>
                      <button onClick={() => setTargets((ts) => ts.filter((_, j) => j !== i))}
                        className="size-6 rounded flex items-center justify-center text-red-500 hover:bg-red-500/10">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <BindingPanel
                      draft={t}
                      setDraft={(d) => setTargets((ts) => ts.map((x, j) => j === i ? d : x))}
                      title=""
                      directionLocked="OUTBOUND"
                    />
                    {t.fieldRows.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>Field mapping</p>
                        <FieldTable
                          draft={t}
                          setDraft={(d) => setTargets((ts) => ts.map((x, j) => j === i ? d : x))}
                        />
                      </div>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => setTargets((ts) => [...ts, emptyBinding("OUTBOUND")])}
                  className="w-full rounded-xl border-2 border-dashed py-3 flex items-center justify-center gap-2 text-[12px] font-semibold transition-colors hover:border-indigo-500 hover:text-indigo-400"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  <Plus className="size-3.5" />
                  Add target system
                </button>
              </div>
            )}

            {/* ── Step 3: Review ── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <GitMerge className="size-4" style={{ color: "var(--muted-foreground)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{entityName}</p>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>/{entitySlug}</span>
                  </div>
                  {entityDesc && <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{entityDesc}</p>}
                  <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {includedFields.length} fields · PK: <span className="font-mono">{includedFields.find((f) => f.isPrimaryKey)?.canonicalName ?? "none"}</span>
                    {showInMenu && " · visible in sidebar"}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Bindings</p>
                  {[source, ...targets].filter(bindingReady).map((b, i) => {
                    const conn = connections.find((c) => c.id === b.connectionId)
                    return (
                      <div key={i} className="rounded-xl border px-3 py-2.5 flex items-center gap-3"
                        style={{ borderColor: "var(--border)" }}>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded",
                          b.direction === "INBOUND" ? "bg-emerald-500/10 text-emerald-400" :
                          b.direction === "OUTBOUND" ? "bg-amber-500/10 text-amber-400" :
                          "bg-indigo-500/10 text-indigo-400"
                        )}>
                          {b.direction}
                        </span>
                        <Plug className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{conn?.name}</span>
                        <ArrowRight className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-[12px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                          {b.objectName}{b.tableName ? ` / ${b.tableName}` : ""}
                        </span>
                        <span className="ml-auto text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          {b.fieldRows.filter((r) => r.include).length} fields
                        </span>
                        {(b.direction === "INBOUND" || b.direction === "BOTH") && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400">
                            webhook auto-created
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <Btn variant="ghost" size="md" onClick={() => step > 0 ? setStep(step - 1) : handleClose(false)}>
              {step === 0 ? "Cancel" : "Back"}
            </Btn>
            <div className="flex items-center gap-2">
              {step === 2 && (
                <Btn variant="ghost" size="md" onClick={() => setStep(3)}>
                  Skip targets
                </Btn>
              )}
              {step < 3 ? (
                <Btn
                  variant="primary" size="md"
                  disabled={(step === 0 && !step0Valid) || (step === 1 && !step1Valid)}
                  onClick={() => setStep(step + 1)}>
                  Continue
                  <ChevronRight className="size-3.5" />
                </Btn>
              ) : (
                <Btn variant="primary" size="md" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Create entity"}
                </Btn>
              )}
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBinding(direction: "INBOUND" | "OUTBOUND" | "BOTH"): BindingDraft {
  return {
    connectionId: "", direction, objectName: "", tableName: "", resourcePath: "",
    fieldRows: [], fieldError: undefined, objects: [], tables: [],
    loadingObjects: false, loadingTables: false, loadingFields: false,
  }
}
