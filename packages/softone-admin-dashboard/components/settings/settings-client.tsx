"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight, Plus, Trash2, Loader2, Check, X,
  Wifi, WifiOff, Star, Building2, Link2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Connection {
  id: string
  label: string | null
  baseUrl: string
  username: string
  appId: string
  company: string
  branch: string
  module: string
  refId: string
  isDefault: boolean
  isActive: boolean
  lastTestedAt: Date | string | null
  lastTestOk: boolean | null
}

interface CompanySettings {
  id: string
  companyName: string
  companyLogo: string | null
  address: string | null
  city: string | null
  zip: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  taxId: string | null
  taxOffice: string | null
}

const EMPTY_CONN = {
  label: "",
  baseUrl: "https://",
  username: "",
  password: "",
  appId: "",
  company: "",
  branch: "",
  module: "",
  refId: "",
  isDefault: false,
  isActive: true,
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", placeholder, required, mono,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; mono?: boolean
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">
        {label}{required && <span className="text-[var(--destructive)] ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]",
          mono && "font-mono"
        )}
      />
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{description}</p>
    </div>
  )
}

// ─── Connection accordion row ─────────────────────────────────────────────────

function ConnectionRow({
  conn,
  onSaved,
  onDeleted,
}: {
  conn: Connection | null // null = "new" row
  onSaved: (c: Connection) => void
  onDeleted?: (id: string) => void
}) {
  const isNew = conn === null
  const [open, setOpen] = useState(isNew)
  const [form, setForm] = useState({
    label:    conn?.label    ?? "",
    baseUrl:  conn?.baseUrl  ?? "https://",
    username: conn?.username ?? "",
    password: "",
    appId:    conn?.appId    ?? "",
    company:  conn?.company  ?? "",
    branch:   conn?.branch   ?? "",
    module:   conn?.module   ?? "",
    refId:    conn?.refId    ?? "",
    isDefault: conn?.isDefault ?? false,
    isActive:  conn?.isActive  ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const url  = isNew ? "/api/settings/connections" : `/api/settings/connections/${conn!.id}`
      const method = isNew ? "POST" : "PUT"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: unknown }
        throw new Error(JSON.stringify(body.error ?? "Save failed"))
      }
      const saved = await res.json() as Connection
      onSaved(saved)
      if (!isNew) setOpen(false)
      setTestResult(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    if (isNew) { setError("Save the connection first, then test it."); return }
    setTesting(true); setTestResult(null); setError(null)
    try {
      const res = await fetch(`/api/settings/connections/${conn!.id}/test`, { method: "POST" })
      const data = await res.json() as { ok: boolean; companyinfo?: string; error?: string }
      setTestResult({
        ok: data.ok,
        message: data.ok
          ? (data.companyinfo ? `Connected — ${data.companyinfo}` : "Connected successfully")
          : (data.error ?? "Connection failed"),
      })
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message })
    } finally {
      setTesting(false)
    }
  }

  async function deleteConn() {
    if (!conn || !confirm(`Delete "${conn.label}"?`)) return
    await fetch(`/api/settings/connections/${conn.id}`, { method: "DELETE" })
    onDeleted?.(conn.id)
  }

  // Row header for existing connections
  const statusDot = conn
    ? conn.lastTestOk === true
      ? <Wifi className="size-3.5 text-emerald-400" />
      : conn.lastTestOk === false
      ? <WifiOff className="size-3.5 text-red-400" />
      : <WifiOff className="size-3.5 text-[var(--muted-foreground)]" />
    : null

  return (
    <div className={cn("rounded-lg border transition-colors", open ? "border-[var(--ring)]/50 bg-[var(--card)]" : "border-[var(--border)] bg-[var(--card)]")}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <ChevronRight className={cn("size-4 text-[var(--muted-foreground)] flex-shrink-0 transition-transform", open && "rotate-90")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)] truncate">
              {isNew ? "New connection" : conn.label}
            </span>
            {conn?.isDefault && <Star className="size-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
            {conn && !conn.isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">inactive</span>
            )}
          </div>
          {conn && (
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">{conn.baseUrl} · {conn.username}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusDot}
          {conn && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteConn() }}
              className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </button>

      {/* Form */}
      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label" value={form.label} onChange={(v) => set("label", v)} placeholder="e.g. Production" required />
            <Field label="Softone URL" value={form.baseUrl} onChange={(v) => set("baseUrl", v)} placeholder="https://company.oncloud.gr" required mono />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Username" value={form.username} onChange={(v) => set("username", v)} required />
            <Field label="Password" value={form.password} onChange={(v) => set("password", v)} type="password" placeholder={isNew ? "" : "leave blank to keep"} required={isNew} />
            <Field label="App ID" value={form.appId} onChange={(v) => set("appId", v)} placeholder="1001" required mono />
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Company / Branch (optional — auto-detected on login)</p>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Company" value={form.company} onChange={(v) => set("company", v)} placeholder="1001" mono />
              <Field label="Branch"  value={form.branch}  onChange={(v) => set("branch", v)}  placeholder="1000" mono />
              <Field label="Module"  value={form.module}  onChange={(v) => set("module", v)}  placeholder="" mono />
              <Field label="RefID"   value={form.refId}   onChange={(v) => set("refId", v)}   placeholder="15" mono />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Default toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                role="switch"
                aria-checked={form.isDefault}
                onClick={() => set("isDefault", !form.isDefault)}
                className={cn("relative inline-flex h-4 w-8 rounded-full border-2 border-transparent transition-colors", form.isDefault ? "bg-amber-400" : "bg-[var(--muted)]")}
              >
                <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform", form.isDefault ? "translate-x-4" : "translate-x-0")} />
              </button>
              <span className="text-xs text-[var(--foreground)]">Default connection</span>
            </label>

            {/* Active toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                role="switch"
                aria-checked={form.isActive}
                onClick={() => set("isActive", !form.isActive)}
                className={cn("relative inline-flex h-4 w-8 rounded-full border-2 border-transparent transition-colors", form.isActive ? "bg-indigo-500" : "bg-[var(--muted)]")}
              >
                <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform", form.isActive ? "translate-x-4" : "translate-x-0")} />
              </button>
              <span className="text-xs text-[var(--foreground)]">Active</span>
            </label>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-xs border", testResult.ok ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-400" : "bg-red-500/5 border-red-500/30 text-red-400")}>
              {testResult.ok ? <Check className="size-3.5 flex-shrink-0" /> : <X className="size-3.5 flex-shrink-0" />}
              {testResult.message}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-[var(--destructive)] bg-[var(--destructive)]/5 border border-[var(--destructive)]/30 rounded-md px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={testConnection}
              disabled={testing || isNew}
              title={isNew ? "Save first, then test" : ""}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
              Test connection
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3 animate-spin" />}
              {isNew ? "Add connection" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Company info form ────────────────────────────────────────────────────────

function CompanyForm({ initial }: { initial: CompanySettings }) {
  const router = useRouter()
  const [form, setForm] = useState({
    companyName: initial.companyName ?? "",
    address:     initial.address    ?? "",
    city:        initial.city       ?? "",
    zip:         initial.zip        ?? "",
    country:     initial.country    ?? "",
    phone:       initial.phone      ?? "",
    email:       initial.email      ?? "",
    website:     initial.website    ?? "",
    taxId:       initial.taxId      ?? "",
    taxOffice:   initial.taxOffice  ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed to save")
      setSaved(true)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <SectionHeader
        title="Company Information"
        description="This data is used in reports, invoices, and the application header."
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Company Name" value={form.companyName} onChange={(v) => set("companyName", v)} placeholder="Acme S.A." required />
        </div>
        <div className="col-span-2">
          <Field label="Address" value={form.address} onChange={(v) => set("address", v)} placeholder="123 Main Street" />
        </div>
        <Field label="City"    value={form.city}    onChange={(v) => set("city", v)}    placeholder="Athens" />
        <Field label="ZIP"     value={form.zip}     onChange={(v) => set("zip", v)}     placeholder="10431" />
        <Field label="Country" value={form.country} onChange={(v) => set("country", v)} placeholder="Greece" />
        <Field label="Phone"   value={form.phone}   onChange={(v) => set("phone", v)}   placeholder="+30 210 0000000" />
        <Field label="Email"   value={form.email}   onChange={(v) => set("email", v)}   placeholder="info@company.gr" type="email" />
        <Field label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://company.gr" />
        <Field label="Tax ID (AFM)"  value={form.taxId}    onChange={(v) => set("taxId", v)}    placeholder="012345678" mono />
        <Field label="Tax Office (DOY)" value={form.taxOffice} onChange={(v) => set("taxOffice", v)} placeholder="ΔΟΥ Αθηνών" />
      </div>

      {error && (
        <p className="text-xs text-[var(--destructive)] bg-[var(--destructive)]/5 border border-[var(--destructive)]/30 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <Check className="size-3.5" /> Saved
          </span>
        ) : <span />}
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving && <Loader2 className="size-3 animate-spin" />}
          Save company info
        </button>
      </div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function SettingsClient({
  initialConnections,
  initialCompany,
}: {
  initialConnections: Connection[]
  initialCompany: CompanySettings
}) {
  const router = useRouter()
  const [connections, setConnections] = useState<Connection[]>(initialConnections)
  const [showNew, setShowNew] = useState(false)

  function handleSaved(saved: Connection) {
    setConnections((prev) => {
      const exists = prev.find((c) => c.id === saved.id)
      if (exists) return prev.map((c) => (c.id === saved.id ? saved : c))
      return [...prev, saved]
    })
    setShowNew(false)
    router.refresh()
  }

  function handleDeleted(id: string) {
    setConnections((prev) => prev.filter((c) => c.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* ── API Connections ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Softone API Connections</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Configure one or more Softone ERP connections. The default connection is used for all sync operations.
            </p>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors"
          >
            <Plus className="size-3.5" />
            Add connection
          </button>
        </div>

        <div className="space-y-2">
          {connections.map((c) => (
            <ConnectionRow
              key={c.id}
              conn={c}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}

          {connections.length === 0 && !showNew && (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-8 text-center">
              <Building2 className="size-6 text-[var(--muted-foreground)] mx-auto mb-2" />
              <p className="text-xs text-[var(--muted-foreground)]">No connections yet. Add one to get started.</p>
            </div>
          )}

          {showNew && (
            <ConnectionRow
              key="new"
              conn={null}
              onSaved={handleSaved}
            />
          )}
        </div>

        {connections.length > 0 && (
          <p className="text-[10px] text-[var(--muted-foreground)] mt-2">
            <Star className="size-3 text-amber-400 fill-amber-400 inline mr-1" />
            = default connection used by all sync operations
          </p>
        )}
      </div>

      {/* ── Company Information ──────────────────────────────────────── */}
      <CompanyForm initial={initialCompany} />
    </div>
  )
}
