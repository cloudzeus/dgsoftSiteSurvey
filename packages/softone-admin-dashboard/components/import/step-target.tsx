"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, AlertCircle, Database, Globe, Pin } from "lucide-react"
import type { ImportConfig, TargetField } from "./types"
import { getTargetObjects } from "@/lib/import-targets"

type Connection = {
  id: string
  name: string
  type: string
  isActive: boolean
}

type Binding = {
  id: string
  objectName: string
  tableName: string | null
  direction: string
  name: string | null
  entity: {
    id: string
    name: string
    slug: string
    description: string | null
    fields: {
      id: string
      name: string
      label: string | null
      dataType: string
      isPrimaryKey: boolean
      isRequired: boolean
    }[]
  }
}

type Props = {
  config: ImportConfig
  onChange: (patch: Partial<ImportConfig>) => void
}

const TYPE_COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  SOFTONE:     { bg: "#ede9fe", fg: "#6d28d9", dot: "#7c3aed" },
  SHOPIFY:     { bg: "#dcfce7", fg: "#15803d", dot: "#16a34a" },
  WOOCOMMERCE: { bg: "#fce7f3", fg: "#9d174d", dot: "#db2777" },
  MAGENTO:     { bg: "#fff7ed", fg: "#c2410c", dot: "#ea580c" },
  CUSTOM_REST: { bg: "#f3f4f6", fg: "#374151", dot: "#6b7280" },
  LOCAL_DB:    { bg: "#eff6ff", fg: "#1d4ed8", dot: "#2563eb" },
}

const SUPPORTED_TYPES = Object.keys(TYPE_COLORS).filter(t => t !== "LOCAL_DB")

// Static fields handled separately in step 4 — not mapped from Excel
const STATIC_FIELDS_BY_TARGET: Record<string, string[]> = {
  BRAND_PRODUCTS: ["brand_name", "category"],
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.CUSTOM_REST
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.fg }}>
      <span className="size-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {type === "LOCAL_DB" ? "Local DB" : type}
    </span>
  )
}

function mapDataType(dataType: string): TargetField["type"] {
  if (dataType === "numeric") return "number"
  if (dataType === "datetime") return "date"
  if (dataType === "logical") return "boolean"
  return "text"
}

const LOCAL_DB_CONNECTION: Connection = {
  id: "LOCAL_DB",
  name: "Local Database",
  type: "LOCAL_DB",
  isActive: true,
}

// ─── Step number label ─────────────────────────────────────────────────────────

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="size-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {n}
      </span>
      <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{label}</p>
    </div>
  )
}

export function StepTarget({ config, onChange }: Props) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [bindings, setBindings] = useState<Binding[]>([])
  const [bindingsLoading, setBindingsLoading] = useState(false)
  const [bindingsError, setBindingsError] = useState("")

  useEffect(() => {
    fetch("/api/connections")
      .then(r => r.json())
      .then(data => {
        const filtered = (Array.isArray(data) ? data : [])
          .filter((c: Connection) => c.isActive && SUPPORTED_TYPES.includes(c.type))
        setConnections(filtered)
      })
      .catch(() => setConnections([]))
      .finally(() => setConnectionsLoading(false))
  }, [])

  async function loadBindings(connId: string) {
    setBindings([])
    setBindingsError("")
    setBindingsLoading(true)
    try {
      const res = await fetch(`/api/import/bindings?connectionId=${connId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load bindings")
      setBindings(Array.isArray(data) ? data : [])
    } catch (err) {
      setBindingsError(err instanceof Error ? err.message : "Failed to load bindings")
    } finally {
      setBindingsLoading(false)
    }
  }

  async function selectConnection(conn: Connection) {
    onChange({
      connectionId: conn.id,
      connectionType: conn.type,
      connectionName: conn.name,
      bindingId: null,
      targetObjectKey: "",
      targetFields: [],
      mappings: [],
      staticValues: {},
    })
    if (conn.id !== "LOCAL_DB") await loadBindings(conn.id)
  }

  function selectBinding(binding: Binding) {
    const fields: TargetField[] = binding.entity.fields.map(f => ({
      key: f.name,
      label: f.label ?? f.name,
      type: mapDataType(f.dataType),
      required: f.isPrimaryKey || f.isRequired,
    }))

    onChange({
      bindingId: binding.id,
      targetObjectKey: binding.objectName,
      targetFields: fields,
      mappings: [],
      staticValues: {},
    })
  }

  function selectLocalTarget(obj: { key: string; label: string; description?: string; fields: TargetField[] }) {
    onChange({
      bindingId: `LOCAL_DB:${obj.key}`,
      targetObjectKey: obj.key,
      targetFields: obj.fields,
      mappings: [],
      staticValues: {},
    })
  }

  const selectedBinding = bindings.find(b => b.id === config.bindingId)
  const isLocalDb = config.connectionId === "LOCAL_DB"
  const localTargets = getTargetObjects("LOCAL_DB")

  const allConnections: Connection[] = [LOCAL_DB_CONNECTION, ...connections]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Select Target
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          Tell the wizard where to store the imported rows
        </p>
      </div>

      {/* ── Part 1: Pick destination ── */}
      <div>
        <StepLabel n={1} label="Where do you want to import?" />

        {connectionsLoading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <Loader2 className="size-4 animate-spin" style={{ color: "var(--primary)" }} />
            <span className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>Loading connections…</span>
          </div>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {allConnections.map(conn => {
              const selected = config.connectionId === conn.id
              const c = TYPE_COLORS[conn.type] ?? TYPE_COLORS.CUSTOM_REST
              const isLocal = conn.id === "LOCAL_DB"
              return (
                <button
                  key={conn.id}
                  onClick={() => selectConnection(conn)}
                  disabled={bindingsLoading && !isLocal}
                  className="relative flex items-start gap-3 p-3.5 rounded-xl text-left transition-all disabled:opacity-60"
                  style={{
                    background: selected ? c.bg : "var(--surface)",
                    border: `1.5px solid ${selected ? c.dot : "var(--border)"}`,
                    boxShadow: selected ? `0 0 0 3px ${c.bg}` : "var(--shadow-xs)",
                  }}
                >
                  {/* Icon */}
                  <span className="size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: selected ? c.dot : "var(--muted)" }}>
                    {isLocal
                      ? <Database className="size-4" style={{ color: selected ? "#fff" : c.dot }} />
                      : <Globe className="size-4" style={{ color: selected ? "#fff" : c.dot }} />
                    }
                  </span>

                  <div className="min-w-0 flex-1 pr-5">
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                      {conn.name}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                      {isLocal ? "Product & device catalogs" : conn.type}
                    </p>
                  </div>

                  {selected && (
                    <span className="absolute top-3 right-3 size-5 rounded-full flex items-center justify-center"
                      style={{ background: c.dot }}>
                      <Check className="size-3 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Part 2: Pick what type of data ── */}
      {config.connectionId && (
        <div>
          <div style={{ height: 1, background: "var(--border)", marginBottom: 20 }} />
          <StepLabel n={2} label="What type of data are you importing?" />

          {/* Local DB target cards */}
          {isLocalDb && (
            <div className="space-y-2">
              {localTargets.map(obj => {
                const sel = config.bindingId === `LOCAL_DB:${obj.key}`
                const staticKeys = STATIC_FIELDS_BY_TARGET[obj.key] ?? []
                const excelFields = obj.fields.filter(f => !staticKeys.includes(f.key))
                const fixedFields = obj.fields.filter(f => staticKeys.includes(f.key))

                return (
                  <button
                    key={obj.key}
                    onClick={() => selectLocalTarget(obj)}
                    className="w-full flex items-start gap-4 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: sel ? "var(--primary-light)" : "var(--surface)",
                      border: `1.5px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
                          {obj.label}
                        </p>
                        {sel && <Check className="size-4 shrink-0" style={{ color: "var(--primary)" }} strokeWidth={3} />}
                      </div>

                      {obj.description && (
                        <p className="text-[12px] mb-3" style={{ color: "var(--foreground-muted)" }}>
                          {obj.description}
                        </p>
                      )}

                      {/* Fields breakdown */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* From Excel */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                            style={{ color: "var(--foreground-muted)" }}>
                            From Excel columns
                          </p>
                          <div className="flex flex-col gap-1">
                            {excelFields.map(f => (
                              <span key={f.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                                style={{ color: f.required ? "var(--foreground)" : "var(--foreground-muted)" }}>
                                <span className="size-1.5 rounded-full shrink-0"
                                  style={{ background: f.required ? "var(--primary)" : "var(--border-strong)" }} />
                                {f.label}
                                {f.required && <span style={{ color: "var(--danger)" }}>*</span>}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Fixed values */}
                        {fixedFields.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1"
                              style={{ color: "var(--foreground-muted)" }}>
                              <Pin className="size-2.5" />
                              You will select (not from Excel)
                            </p>
                            <div className="flex flex-col gap-1">
                              {fixedFields.map(f => (
                                <span key={f.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                                  style={{ color: "var(--primary)" }}>
                                  <span className="size-1.5 rounded-full shrink-0" style={{ background: "var(--primary)" }} />
                                  {f.label}
                                  {f.required && <span style={{ color: "var(--danger)" }}>*</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* External bindings */}
          {!isLocalDb && (
            <div>
              {bindingsLoading && (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="size-4 animate-spin" style={{ color: "var(--primary)" }} />
                  <span className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>Loading entities…</span>
                </div>
              )}

              {bindingsError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>
                  <AlertCircle className="size-4 shrink-0" />
                  <p className="text-[12px]">{bindingsError}</p>
                </div>
              )}

              {!bindingsLoading && !bindingsError && bindings.length === 0 && (
                <div className="text-center py-8 rounded-xl"
                  style={{ background: "var(--muted)", border: "2px dashed var(--border-strong)" }}>
                  <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                    No entities configured for this connection
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--foreground-subtle)" }}>
                    Set up an entity with an INBOUND binding for this connection first
                  </p>
                </div>
              )}

              {!bindingsLoading && bindings.length > 0 && (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {bindings.map(b => {
                    const sel = config.bindingId === b.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => selectBinding(b)}
                        className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl text-left transition-all"
                        style={{
                          background: sel ? "var(--primary-light)" : "var(--muted)",
                          border: `1.5px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                            {b.entity.name}
                          </span>
                          {sel && <Check className="size-3.5 shrink-0" style={{ color: "var(--primary)" }} strokeWidth={3} />}
                        </div>
                        {b.entity.description && (
                          <p className="text-[11px] leading-snug" style={{ color: "var(--foreground-muted)" }}>
                            {b.entity.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{ background: "var(--border)", color: "var(--foreground-muted)" }}>
                            {b.objectName}{b.tableName ? `.${b.tableName}` : ""}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "var(--border)", color: "var(--foreground-muted)" }}>
                            {b.entity.fields.length} fields
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedBinding && (
                <div className="mt-3 flex flex-wrap gap-1.5 pl-1">
                  {selectedBinding.entity.fields.map(f => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                      style={{
                        background: (f.isPrimaryKey || f.isRequired) ? "var(--primary-light)" : "var(--muted)",
                        color: (f.isPrimaryKey || f.isRequired) ? "var(--primary)" : "var(--foreground-muted)",
                        border: `1px solid ${(f.isPrimaryKey || f.isRequired) ? "var(--primary)" : "var(--border)"}`,
                      }}
                    >
                      {f.label && f.label !== f.name ? f.label : f.name}
                      {(f.isPrimaryKey || f.isRequired) && <span className="opacity-60">*</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
