"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  ArrowRight, Key, Plus, GitMerge,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface XmlField {
  path: string
  label: string
  dataType: string
  frequency: number
  sampleValue: string | null
}

interface Entity {
  id: string
  name: string
  slug: string
  fields: { id: string; name: string; label: string | null; dataType: string }[]
}

interface SavedMapping {
  entityId: string
  keyFieldPath: string | null
  fieldMaps: { xmlFieldPath: string; canonicalField: string }[]
}

interface Props {
  open: boolean
  onClose: () => void
  feedId: string
  feedName: string
  feedUrl: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSnake(str: string) {
  return str
    .replace(/([A-Z])/g, "_$1")
    .replace(/[^a-z0-9_]/gi, "_")
    .replace(/__+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
}

const TYPE_COLORS: Record<string, string> = {
  string:  "text-violet-400",
  number:  "text-blue-400",
  boolean: "text-orange-400",
  date:    "text-teal-400",
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function XmlFeedMappingModal({ open, onClose, feedId, feedName, feedUrl }: Props) {
  // ── Data loading ──
  const [fields,   setFields]   = useState<XmlField[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading,  setLoading]  = useState(false)
  const [loadErr,  setLoadErr]  = useState("")

  // ── Mapping state ──
  const [selectedEntityId, setSelectedEntityId] = useState("")
  const [keyFieldPath,     setKeyFieldPath]     = useState("")
  const [rowMaps, setRowMaps] = useState<Record<string, string>>({}) // xmlPath → canonicalField
  const [newEntityName, setNewEntityName] = useState("")
  const [creatingEntity, setCreatingEntity] = useState(false)

  // ── Save state ──
  const [saving,   setSaving]   = useState(false)
  const [saveErr,  setSaveErr]  = useState("")
  const [saved,    setSaved]    = useState(false)

  // Load feed fields + existing mapping + entities when modal opens
  useEffect(() => {
    if (!open) return
    setSaved(false)
    setSaveErr("")
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feedId])

  async function loadAll() {
    setLoading(true)
    setLoadErr("")
    try {
      const [feedRes, entRes, mapRes] = await Promise.all([
        fetch(`/api/xml-feeds/${feedId}`),
        fetch("/api/entities"),
        fetch(`/api/xml-feeds/${feedId}/mapping`),
      ])

      if (!feedRes.ok) throw new Error("Failed to load feed")
      const feedData = await feedRes.json()
      setFields(feedData.fields ?? [])

      if (entRes.ok) {
        const entData: Entity[] = await entRes.json()
        setEntities(entData)
      }

      if (mapRes.ok) {
        const mapData: SavedMapping | null = await mapRes.json()
        if (mapData) {
          setSelectedEntityId(mapData.entityId)
          setKeyFieldPath(mapData.keyFieldPath ?? "")
          const maps: Record<string, string> = {}
          for (const fm of mapData.fieldMaps) maps[fm.xmlFieldPath] = fm.canonicalField
          setRowMaps(maps)
        }
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch feed to get latest parsed fields
  async function refetchXml() {
    setLoading(true)
    setLoadErr("")
    try {
      const res = await fetch(`/api/xml-feeds/${feedId}/fetch`, { method: "POST" })
      if (!res.ok) throw new Error("Fetch failed")
      const feedRes = await fetch(`/api/xml-feeds/${feedId}`)
      const feedData = await feedRes.json()
      setFields(feedData.fields ?? [])
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to fetch XML")
    } finally {
      setLoading(false)
    }
  }

  // Auto-fill canonical field names from XML field labels
  function autoMap() {
    const next: Record<string, string> = { ...rowMaps }
    for (const f of fields) {
      if (!next[f.path]) next[f.path] = toSnake(f.label)
    }
    setRowMaps(next)
  }

  // Create a new entity on the fly
  async function createEntity() {
    if (!newEntityName.trim()) return
    setCreatingEntity(true)
    try {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEntityName.trim(),
          slug: toSnake(newEntityName.trim()),
          description: `Created from XML feed: ${feedName}`,
        }),
      })
      if (!res.ok) throw new Error("Failed to create entity")
      const entity = await res.json()
      const entRes = await fetch("/api/entities")
      if (entRes.ok) setEntities(await entRes.json())
      setSelectedEntityId(entity.id)
      setNewEntityName("")
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to create entity")
    } finally {
      setCreatingEntity(false)
    }
  }

  async function handleSave() {
    if (!selectedEntityId) { setSaveErr("Select a target entity first"); return }
    setSaving(true)
    setSaveErr("")
    try {
      const fieldMaps = Object.entries(rowMaps)
        .filter(([, v]) => v.trim())
        .map(([xmlFieldPath, canonicalField]) => ({ xmlFieldPath, canonicalField: canonicalField.trim() }))

      const res = await fetch(`/api/xml-feeds/${feedId}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: selectedEntityId, keyFieldPath: keyFieldPath || null, fieldMaps }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      setSaved(true)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const selectedEntity = entities.find((e) => e.id === selectedEntityId)
  const inputCls = "w-full rounded-md border px-2.5 py-1.5 text-xs bg-transparent outline-none focus:ring-1"
  const inputStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as React.CSSProperties
  const selectCls = "w-full rounded-md border px-2.5 py-1.5 text-xs bg-transparent outline-none focus:ring-1 cursor-pointer"

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border shadow-2xl flex flex-col"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            width: "min(90vw, 900px)",
            maxHeight: "85vh",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
            style={{ borderColor: "var(--border)" }}>
            <div>
              <Dialog.Title className="text-sm font-semibold flex items-center gap-2"
                style={{ color: "var(--foreground)" }}>
                <GitMerge className="size-4" style={{ color: "#818cf8" }} />
                Data Mapping — {feedName}
              </Dialog.Title>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Map XML fields to a canonical pipeline entity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refetchXml}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                title="Re-fetch XML and refresh fields"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Refresh fields
              </button>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-md" style={{ color: "var(--muted-foreground)" }}>
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {loading && fields.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="size-5 animate-spin" style={{ color: "var(--muted-foreground)" }} />
              </div>
            ) : loadErr ? (
              <div className="flex items-center gap-2 m-5 px-3 py-2.5 rounded-md bg-red-500/10 text-red-400 text-sm">
                <AlertTriangle className="size-4 flex-shrink-0" /> {loadErr}
              </div>
            ) : (
              <>
                {/* Target entity + key field row */}
                <div className="px-5 py-4 border-b flex-shrink-0 space-y-3"
                  style={{ borderColor: "var(--border)" }}>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Entity picker */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: "var(--muted-foreground)" }}>
                        Target Entity *
                      </label>
                      <select
                        className={selectCls}
                        style={{ ...inputStyle, background: "var(--card)" }}
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                      >
                        <option value="">— select entity —</option>
                        {entities.map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Key field picker */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: "var(--muted-foreground)" }}>
                        <span className="flex items-center gap-1"><Key className="size-3" /> Primary Key Field</span>
                      </label>
                      <select
                        className={selectCls}
                        style={{ ...inputStyle, background: "var(--card)" }}
                        value={keyFieldPath}
                        onChange={(e) => setKeyFieldPath(e.target.value)}
                      >
                        <option value="">— none / use row index —</option>
                        {fields.map((f) => (
                          <option key={f.path} value={f.path}>{f.path}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Create entity inline */}
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      style={{ ...inputStyle, maxWidth: 220 }}
                      placeholder="New entity name…"
                      value={newEntityName}
                      onChange={(e) => setNewEntityName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createEntity()}
                    />
                    <button
                      onClick={createEntity}
                      disabled={!newEntityName.trim() || creatingEntity}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs disabled:opacity-40"
                      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                    >
                      {creatingEntity ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                      Create entity
                    </button>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      or select an existing one above
                    </span>
                    <div className="ml-auto">
                      <button
                        onClick={autoMap}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      >
                        Auto-fill names
                      </button>
                    </div>
                  </div>
                </div>

                {/* Field mapping table */}
                <div className="flex-1 overflow-auto">
                  {fields.length === 0 ? (
                    <div className="text-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
                      No fields detected yet. Click "Refresh fields" to fetch the XML.
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-xs">
                      <thead style={{ background: "var(--muted)", position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          {["XML Field Path", "Type", "Frequency", "Sample", "", "Canonical Field Name"].map((h) => (
                            <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide px-3 py-2.5"
                              style={{ color: "var(--muted-foreground)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((f) => {
                          const currentVal = rowMaps[f.path] ?? ""
                          // Suggest from existing entity fields
                          const entityFields = selectedEntity?.fields ?? []

                          return (
                            <tr key={f.path} className="border-b"
                              style={{ borderColor: "var(--border)" }}>
                              {/* XML path */}
                              <td className="px-3 py-2 font-mono" style={{ color: "var(--foreground)" }}>
                                {f.path === keyFieldPath && (
                                  <Key className="size-3 inline mr-1" style={{ color: "#f59e0b" }} />
                                )}
                                {f.path}
                              </td>

                              {/* Type */}
                              <td className="px-3 py-2">
                                <span className={cn("font-medium", TYPE_COLORS[f.dataType] ?? "text-zinc-400")}>
                                  {f.dataType}
                                </span>
                              </td>

                              {/* Frequency */}
                              <td className="px-3 py-2" style={{ color: "var(--muted-foreground)" }}>
                                {f.frequency}
                              </td>

                              {/* Sample */}
                              <td className="px-3 py-2 max-w-[160px] truncate"
                                style={{ color: "var(--muted-foreground)" }}
                                title={f.sampleValue ?? ""}>
                                {f.sampleValue ?? "—"}
                              </td>

                              {/* Arrow */}
                              <td className="px-2 py-2">
                                <ArrowRight className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                              </td>

                              {/* Canonical field */}
                              <td className="px-3 py-2 w-64">
                                {entityFields.length > 0 ? (
                                  <select
                                    className={selectCls}
                                    style={{ ...inputStyle, background: "var(--card)" }}
                                    value={currentVal}
                                    onChange={(e) => setRowMaps((prev) => ({ ...prev, [f.path]: e.target.value }))}
                                  >
                                    <option value="">— skip —</option>
                                    {entityFields.map((ef) => (
                                      <option key={ef.name} value={ef.name}>
                                        {ef.name}{ef.label ? ` (${ef.label})` : ""}
                                      </option>
                                    ))}
                                    <option value={toSnake(f.label)}>
                                      + New: {toSnake(f.label)}
                                    </option>
                                  </select>
                                ) : (
                                  <input
                                    className={inputCls}
                                    style={inputStyle}
                                    placeholder={toSnake(f.label)}
                                    value={currentVal}
                                    onChange={(e) => setRowMaps((prev) => ({ ...prev, [f.path]: e.target.value }))}
                                  />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t flex-shrink-0"
            style={{ borderColor: "var(--border)" }}>
            <div>
              {saveErr && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="size-3" /> {saveErr}
                </p>
              )}
              {saved && (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Mapping saved successfully
                </p>
              )}
              {!saveErr && !saved && (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {Object.values(rowMaps).filter(Boolean).length} of {fields.length} fields mapped
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
              <Btn size="sm" onClick={handleSave} disabled={saving || !selectedEntityId || fields.length === 0}>
                {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Save mapping
              </Btn>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
