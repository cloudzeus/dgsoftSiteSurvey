"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, ChevronDown, AlertCircle } from "lucide-react"
import type { ImportConfig, TargetField } from "./types"

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
}

const SUPPORTED_TYPES = Object.keys(TYPE_COLORS)

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.CUSTOM_REST
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.fg }}>
      <span className="size-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {type}
    </span>
  )
}

function mapDataType(dataType: string): TargetField["type"] {
  if (dataType === "numeric") return "number"
  if (dataType === "datetime") return "date"
  if (dataType === "logical") return "boolean"
  return "text"
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
    })
    await loadBindings(conn.id)
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
    })
  }

  const selectedBinding = bindings.find(b => b.id === config.bindingId)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Select Target
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          Choose the connection and entity to import into
        </p>
      </div>

      {/* ── Connection cards ── */}
      {connectionsLoading ? (
        <div className="flex items-center gap-2 py-8 justify-center">
          <Loader2 className="size-4 animate-spin" style={{ color: "var(--primary)" }} />
          <span className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>Loading connections…</span>
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-10 rounded-xl"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
          <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>No active connections found</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--foreground-subtle)" }}>
            Add a Softone, Shopify, Magento, WooCommerce or Custom REST connection first
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {connections.map(conn => {
            const selected = config.connectionId === conn.id
            const c = TYPE_COLORS[conn.type] ?? TYPE_COLORS.CUSTOM_REST
            return (
              <button
                key={conn.id}
                onClick={() => selectConnection(conn)}
                disabled={bindingsLoading}
                className="relative flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all disabled:opacity-60"
                style={{
                  background: selected ? c.bg : "var(--surface)",
                  border: `1.5px solid ${selected ? c.dot : "var(--border)"}`,
                  boxShadow: selected ? `0 0 0 3px ${c.bg}` : "var(--shadow-xs)",
                }}
              >
                {selected && (
                  <span className="absolute top-2.5 right-2.5 size-5 rounded-full flex items-center justify-center"
                    style={{ background: c.dot }}>
                    <Check className="size-3 text-white" strokeWidth={3} />
                  </span>
                )}
                <TypeBadge type={conn.type} />
                <p className="text-[13px] font-semibold leading-snug pr-6" style={{ color: "var(--foreground)" }}>
                  {conn.name}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Bindings (entities) for the selected connection ── */}
      {config.connectionId && (
        <div className="space-y-3 pt-1">
          <div style={{ height: 1, background: "var(--border)" }} />

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
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2"
                style={{ color: "var(--foreground-muted)" }}>
                Import into
              </label>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {bindings.map(b => {
                  const sel = config.bindingId === b.id
                  return (
                    <button
                      key={b.id}
                      onClick={() => selectBinding(b)}
                      className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all"
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
            </div>
          )}

          {/* Field preview for selected binding */}
          {selectedBinding && (
            <details className="group">
              <summary className="flex items-center gap-1.5 cursor-pointer text-[12px] select-none"
                style={{ color: "var(--foreground-muted)" }}>
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                {selectedBinding.entity.fields.length} fields in <strong className="ml-1">{selectedBinding.entity.name}</strong>
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
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
                    <span className="font-mono text-[9px] opacity-60">{f.name}</span>
                    {f.label && f.label !== f.name && <span>{f.label}</span>}
                    {(f.isPrimaryKey || f.isRequired) && <span className="opacity-60">*</span>}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
