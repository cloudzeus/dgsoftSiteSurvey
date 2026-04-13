"use client"

import { useState, useOptimistic, useTransition } from "react"
import { Check, Loader2, ShieldCheck, ShieldAlert } from "lucide-react"

type PermRow = {
  id: string
  role: string
  resource: string
  canRead: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
  updatedAt: Date
}

type Resource = { key: string; label: string }

type Action = "canRead" | "canAdd" | "canEdit" | "canDelete"

const ROLES = ["OPERATOR", "VIEWER"] as const
type EditableRole = (typeof ROLES)[number]

const ACTIONS: { key: Action; label: string }[] = [
  { key: "canRead",   label: "Read" },
  { key: "canAdd",    label: "Add" },
  { key: "canEdit",   label: "Edit" },
  { key: "canDelete", label: "Delete" },
]

const ROLE_META: Record<EditableRole, { label: string; color: string; bg: string }> = {
  OPERATOR: { label: "Operator", color: "#1d4ed8", bg: "#dbeafe" },
  VIEWER:   { label: "Viewer",   color: "#374151", bg: "#f3f4f6" },
}

function buildMap(rows: PermRow[]): Map<string, PermRow> {
  const m = new Map<string, PermRow>()
  for (const r of rows) m.set(`${r.role}::${r.resource}`, r)
  return m
}

function defaultRow(role: string, resource: string): PermRow {
  return {
    id: "",
    role,
    resource,
    canRead: false,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    updatedAt: new Date(),
  }
}

// ─── Toggle cell ──────────────────────────────────────────────────────────────

function ToggleCell({
  checked,
  saving,
  onChange,
}: {
  checked: boolean
  saving: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={saving}
      className="mx-auto flex items-center justify-center size-8 rounded-lg transition-all duration-150"
      style={{
        background: checked ? "#dcfce7" : "var(--background)",
        border: `1.5px solid ${checked ? "#16a34a" : "var(--border-strong)"}`,
        color: checked ? "#15803d" : "var(--foreground-subtle)",
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.6 : 1,
      }}
      title={checked ? "Revoke" : "Grant"}
    >
      {saving ? (
        <Loader2 className="size-3 animate-spin" />
      ) : checked ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : (
        <span className="size-1.5 rounded-full" style={{ background: "var(--border-strong)" }} />
      )}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function RbacMatrix({
  initialRows,
  resources,
}: {
  initialRows: PermRow[]
  resources: Resource[]
}) {
  const [activeRole, setActiveRole] = useState<EditableRole>("OPERATOR")
  const [permMap, setPermMap] = useState(() => buildMap(initialRows))
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")

  async function toggle(resource: string, action: Action, current: boolean) {
    const key = `${activeRole}::${resource}`
    const existing = permMap.get(key) ?? defaultRow(activeRole, resource)
    const next: PermRow = { ...existing, [action]: !current }

    // Optimistic update
    setPermMap(m => new Map(m).set(key, next))
    setSaving(s => new Set(s).add(`${key}::${action}`))
    setError("")

    try {
      const res = await fetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          resource,
          canRead: next.canRead,
          canAdd: next.canAdd,
          canEdit: next.canEdit,
          canDelete: next.canDelete,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // Revert
        setPermMap(m => new Map(m).set(key, existing))
        setError(data.error ?? "Failed to save permission")
      } else {
        const saved: PermRow = await res.json()
        setPermMap(m => new Map(m).set(key, saved))
      }
    } catch {
      setPermMap(m => new Map(m).set(key, existing))
      setError("Network error — permission not saved")
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(`${key}::${action}`); return n })
    }
  }

  // Count granted actions for a role across all resources
  function roleGrantCount(role: EditableRole) {
    let n = 0
    for (const res of resources) {
      const p = permMap.get(`${role}::${res.key}`)
      if (p) {
        if (p.canRead) n++
        if (p.canAdd) n++
        if (p.canEdit) n++
        if (p.canDelete) n++
      }
    }
    return n
  }

  return (
    <div className="space-y-5">
      {/* ADMIN notice */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
        style={{ background: "#ede9fe", border: "1px solid #c4b5fd" }}
      >
        <ShieldCheck className="size-4 flex-shrink-0" style={{ color: "#6d28d9" }} />
        <span style={{ color: "#5b21b6" }}>
          <strong>Admin</strong> always has full read / add / edit / delete access to every resource — no configuration needed.
        </span>
      </div>

      {error && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
          style={{ background: "var(--danger-light)", border: "1px solid #fca5a5" }}
        >
          <ShieldAlert className="size-4 flex-shrink-0" style={{ color: "var(--danger)" }} />
          <span style={{ color: "var(--danger-fg)" }}>{error}</span>
        </div>
      )}

      {/* Role tabs */}
      <div className="flex gap-2">
        {ROLES.map(role => {
          const meta = ROLE_META[role]
          const active = activeRole === role
          const count = roleGrantCount(role)
          return (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-150"
              style={{
                background: active ? meta.bg : "var(--surface)",
                border: `1.5px solid ${active ? meta.color : "var(--border)"}`,
                color: active ? meta.color : "var(--foreground-muted)",
                boxShadow: active ? "var(--shadow-xs)" : "none",
              }}
            >
              <span>{meta.label}</span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: active ? meta.color : "var(--border)", color: active ? "#fff" : "var(--foreground-muted)" }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Permission matrix */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}
      >
        <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider w-56" style={{ color: "var(--foreground-muted)" }}>
                Resource
              </th>
              {ACTIONS.map(a => (
                <th key={a.key} className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider w-24" style={{ color: "var(--foreground-muted)" }}>
                  {a.label}
                </th>
              ))}
              <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider w-28" style={{ color: "var(--foreground-muted)" }}>
                All
              </th>
            </tr>
          </thead>
          <tbody>
            {resources.map((res, i) => {
              const key = `${activeRole}::${res.key}`
              const perm = permMap.get(key) ?? defaultRow(activeRole, res.key)
              const allGranted = ACTIONS.every(a => perm[a.key])

              return (
                <tr
                  key={res.key}
                  style={{
                    borderBottom: i < resources.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <td className="px-5 py-3.5 font-medium" style={{ color: "var(--foreground)" }}>
                    {res.label}
                  </td>
                  {ACTIONS.map(a => (
                    <td key={a.key} className="px-4 py-3.5 text-center">
                      <ToggleCell
                        checked={perm[a.key]}
                        saving={saving.has(`${key}::${a.key}`)}
                        onChange={() => toggle(res.key, a.key, perm[a.key])}
                      />
                    </td>
                  ))}
                  {/* "All" toggle — grants/revokes all 4 actions at once */}
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={async () => {
                        const nextVal = !allGranted
                        for (const a of ACTIONS) {
                          if (perm[a.key] !== nextVal) {
                            await toggle(res.key, a.key, perm[a.key])
                          }
                        }
                      }}
                      className="mx-auto flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                      style={{
                        background: allGranted ? "#dcfce7" : "var(--background)",
                        border: `1px solid ${allGranted ? "#16a34a" : "var(--border-strong)"}`,
                        color: allGranted ? "#15803d" : "var(--foreground-muted)",
                      }}
                    >
                      {allGranted ? "Revoke all" : "Grant all"}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
        Changes are saved immediately per toggle. Permissions take effect on next page load for active sessions.
      </p>
    </div>
  )
}
