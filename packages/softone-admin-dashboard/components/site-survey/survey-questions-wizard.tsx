"use client"

import React, { useEffect, useRef, useState, useTransition } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, Loader2, Save, CheckSquare, Square, Check,
  Plus, Trash2, Pencil, MapPin, Hash, Cpu, Wifi, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn } from "@/components/ui/btn"

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "TEXT" | "BOOLEAN" | "NUMBER" | "DROPDOWN" | "MULTI_SELECT" | "DEVICE_LIST"

interface DeviceConfig {
  hasIp?: boolean
}

interface Question {
  id: number
  key: string
  label: string
  type: QuestionType
  options: { id: number | string; label: string }[] | DeviceConfig
  order: number
}

interface DeviceEntry {
  brand: string
  model: string
  serial: string
  location: string
  ip: string
}

interface Props {
  open: boolean
  onClose: () => void
  surveyId: number
  surveyName: string
  sectionKey: string   // lowercase UI key: hardware_network, software, etc.
  sectionLabel: string
  customerCompletedBy?: string // email of customer who already submitted this section
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDevices(value: string): DeviceEntry[] {
  if (!value || value === "[]") return []
  try {
    const arr = JSON.parse(value)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function isDeviceConfig(options: Question["options"]): options is DeviceConfig {
  return options !== null && !Array.isArray(options) && typeof options === "object"
}

const EMPTY_DEVICE: DeviceEntry = { brand: "", model: "", serial: "", location: "", ip: "" }

// ─── Input components ─────────────────────────────────────────────────────────

function TextAnswer({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={2}
      className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors"
      style={{ color: "var(--foreground)" }}
    />
  )
}

function NumberAnswer({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-36 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors"
      style={{ color: "var(--foreground)" }}
    />
  )
}

function BooleanAnswer({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {(["Yes", "No"] as const).map(opt => {
        const active = opt === "Yes" ? value === "true" : value === "false"
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === "Yes" ? "true" : "false")}
            className={cn(
              "px-5 py-1.5 rounded-lg border text-[12px] font-semibold transition-all",
              active
                ? "bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                : "border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]",
            )}
          >
            {opt}
          </button>
        )
      })}
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="px-3 py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function DropdownAnswer({
  value, options, onChange,
}: {
  value: string
  options: { id: number | string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] min-w-52 transition-colors"
      style={{ color: value ? "var(--foreground)" : "var(--muted-foreground)" }}
    >
      <option value="">— Select —</option>
      {options.map(o => (
        <option key={String(o.id)} value={String(o.id)}>{o.label}</option>
      ))}
    </select>
  )
}

function MultiSelectAnswer({
  value, options, onChange,
}: {
  value: string
  options: { id: number | string; label: string }[]
  onChange: (v: string) => void
}) {
  let selected: string[] = []
  try {
    const parsed = JSON.parse(value || "[]")
    selected = Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    selected = []
  }

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id]
    onChange(next.length ? JSON.stringify(next) : "")
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const id   = String(o.id)
        const isOn = selected.includes(id)
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all",
              isOn
                ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400 shadow-sm"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
            )}
          >
            {isOn ? <CheckSquare className="size-3.5 shrink-0" /> : <Square className="size-3.5 shrink-0 opacity-40" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Brand combobox ───────────────────────────────────────────────────────────

function BrandCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query,    setQuery]    = useState(value)
  const [results,  setResults]  = useState<{ id: number; name: string }[]>([])
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(value) // revert if user abandoned without selecting
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [value])

  function search(q: string) {
    setLoading(true)
    fetch(`/api/brand-lookup?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => setResults(Array.isArray(d) ? d : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }

  function handleFocus() { setOpen(true); search(query) }

  function handleInput(q: string) {
    setQuery(q)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 200)
  }

  function handleSelect(name: string) { onChange(name); setQuery(name); setOpen(false) }

  async function handleCreate(name: string) {
    setCreating(true)
    try {
      const res = await fetch("/api/brand-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) { const b = await res.json(); handleSelect(b.name) }
    } finally { setCreating(false) }
  }

  const trimmed = query.trim()
  const exactMatch = results.some(r => r.name.toLowerCase() === trimmed.toLowerCase())
  const showAdd = trimmed.length > 0 && !exactMatch && !loading

  return (
    <div ref={containerRef} className="flex-1 min-w-[130px] relative">
      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>
        Brand
      </label>
      <input
        value={query}
        onFocus={handleFocus}
        onChange={e => handleInput(e.target.value)}
        placeholder="e.g. Fortinet"
        className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors"
        style={{ color: "var(--foreground)" }}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[70] rounded-lg border border-[var(--border)] shadow-xl overflow-y-auto"
          style={{ background: "var(--card)", maxHeight: 180 }}>
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 className="size-3 animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.map(r => (
            <button key={r.id} type="button" onClick={() => handleSelect(r.name)}
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--muted)] transition-colors"
              style={{ color: "var(--foreground)" }}>
              {r.name}
            </button>
          ))}
          {!loading && results.length === 0 && !showAdd && (
            <p className="px-3 py-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>No brands found</p>
          )}
          {showAdd && (
            <button type="button" onClick={() => handleCreate(trimmed)} disabled={creating}
              className="w-full text-left px-3 py-2 text-[12px] flex items-center gap-1.5 hover:bg-indigo-500/10 transition-colors"
              style={{ color: "var(--primary)", borderTop: "1px solid var(--border)" }}>
              {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Add &ldquo;{trimmed}&rdquo; as new brand
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Model combobox ───────────────────────────────────────────────────────────

function ModelCombobox({
  brandName, value, onChange,
}: {
  brandName: string; value: string; onChange: (v: string) => void
}) {
  const [query,    setQuery]    = useState(value)
  const [results,  setResults]  = useState<{ id: number; modelName: string; category?: string | null }[]>([])
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(value)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [value])

  function search(q: string) {
    if (!brandName) return
    setLoading(true)
    fetch(`/api/brand-lookup/models?brand=${encodeURIComponent(brandName)}&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => setResults(Array.isArray(d) ? d : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }

  function handleFocus() { if (!brandName) return; setOpen(true); search(query) }

  function handleInput(q: string) {
    setQuery(q)
    if (!brandName) return
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 200)
  }

  function handleSelect(modelName: string) { onChange(modelName); setQuery(modelName); setOpen(false) }

  async function handleCreate(modelName: string) {
    setCreating(true)
    try {
      const res = await fetch("/api/brand-lookup/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, modelName }),
      })
      if (res.ok) { const p = await res.json(); handleSelect(p.modelName) }
    } finally { setCreating(false) }
  }

  const trimmed    = query.trim()
  const exactMatch = results.some(r => r.modelName.toLowerCase() === trimmed.toLowerCase())
  const showAdd    = brandName && trimmed.length > 0 && !exactMatch && !loading

  return (
    <div ref={containerRef} className="flex-1 min-w-[130px] relative">
      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>
        Model
      </label>
      <input
        value={query}
        onFocus={handleFocus}
        onChange={e => handleInput(e.target.value)}
        placeholder={brandName ? "e.g. FortiGate 100F" : "Select a brand first"}
        disabled={!brandName}
        className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: "var(--foreground)" }}
      />
      {open && brandName && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[70] rounded-lg border border-[var(--border)] shadow-xl overflow-y-auto"
          style={{ background: "var(--card)", maxHeight: 180 }}>
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 className="size-3 animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.map(r => (
            <button key={r.id} type="button" onClick={() => handleSelect(r.modelName)}
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--muted)] transition-colors flex items-center justify-between"
              style={{ color: "var(--foreground)" }}>
              <span>{r.modelName}</span>
              {r.category && (
                <span className="text-[10px] ml-2 shrink-0" style={{ color: "var(--muted-foreground)" }}>{r.category}</span>
              )}
            </button>
          ))}
          {!loading && results.length === 0 && !showAdd && (
            <p className="px-3 py-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              No models for {brandName} yet
            </p>
          )}
          {showAdd && (
            <button type="button" onClick={() => handleCreate(trimmed)} disabled={creating}
              className="w-full text-left px-3 py-2 text-[12px] flex items-center gap-1.5 hover:bg-indigo-500/10 transition-colors"
              style={{ color: "var(--primary)", borderTop: results.length ? "1px solid var(--border)" : "none" }}>
              {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Add &ldquo;{trimmed}&rdquo; to {brandName}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Device form (inline add / edit) ─────────────────────────────────────────

function DeviceForm({
  initial,
  hasIp,
  onSave,
  onCancel,
}: {
  initial: DeviceEntry
  hasIp: boolean
  onSave: (d: DeviceEntry) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<DeviceEntry>(initial)

  function field(label: string, key: keyof DeviceEntry, placeholder?: string, mono = false) {
    return (
      <div className="flex-1 min-w-[130px]">
        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>
          {label}
        </label>
        <input
          value={d[key]}
          onChange={e => setD(prev => ({ ...prev, [key]: e.target.value }))}
          placeholder={placeholder ?? label}
          className={cn(
            "w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors",
            mono && "font-mono",
          )}
          style={{ color: "var(--foreground)" }}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/[3%] p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <BrandCombobox
          value={d.brand}
          onChange={v => setD(prev => ({ ...prev, brand: v, model: "" }))}
        />
        <ModelCombobox
          brandName={d.brand}
          value={d.model}
          onChange={v => setD(prev => ({ ...prev, model: v }))}
        />
        {field("Serial #", "serial",   "e.g. FG100F1234",     true)}
        {field("Location", "location", "e.g. Server Room A")}
        {hasIp && field("IP Address", "ip", "e.g. 192.168.1.1", true)}
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[11px] font-semibold hover:bg-[var(--muted)] transition-colors"
          style={{ color: "var(--muted-foreground)" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(d)}
          className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-semibold transition-colors"
        >
          Save device
        </button>
      </div>
    </div>
  )
}

// ─── Device list answer ───────────────────────────────────────────────────────

function DeviceListAnswer({
  value,
  config,
  onChange,
}: {
  value: string
  config: DeviceConfig
  onChange: (v: string) => void
}) {
  const hasIp   = config.hasIp ?? false
  const devices = parseDevices(value)

  const [adding,     setAdding]     = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  function commit(list: DeviceEntry[]) {
    onChange(list.length ? JSON.stringify(list) : "")
  }

  function handleAdd(d: DeviceEntry) {
    commit([...devices, d])
    setAdding(false)
  }

  function handleEdit(idx: number, d: DeviceEntry) {
    const next = devices.map((old, i) => i === idx ? d : old)
    commit(next)
    setEditingIdx(null)
  }

  function handleDelete(idx: number) {
    const next = devices.filter((_, i) => i !== idx)
    commit(next)
    if (editingIdx === idx) setEditingIdx(null)
  }

  return (
    <div className="space-y-2">
      {/* Device cards */}
      {devices.map((d, idx) => (
        <div key={idx}>
          {editingIdx === idx ? (
            <DeviceForm
              initial={d}
              hasIp={hasIp}
              onSave={updated => handleEdit(idx, updated)}
              onCancel={() => setEditingIdx(null)}
            />
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 px-3.5 py-2.5 group hover:border-indigo-500/20 hover:bg-indigo-500/[2%] transition-colors">
              {/* Index badge */}
              <span className="size-5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                {idx + 1}
              </span>

              {/* Device info */}
              <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-4">
                <DeviceField icon={<Cpu className="size-3" />}  label="Brand / Model"
                  value={[d.brand, d.model].filter(Boolean).join(" — ") || "—"} />
                <DeviceField icon={<Hash className="size-3" />} label="Serial"
                  value={d.serial || "—"} mono />
                <DeviceField icon={<MapPin className="size-3" />} label="Location"
                  value={d.location || "—"} />
                {hasIp && (
                  <DeviceField icon={<Wifi className="size-3" />} label="IP"
                    value={d.ip || "—"} mono />
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditingIdx(idx); setAdding(false) }}
                  className="rounded-md p-1.5 hover:bg-[var(--muted)] transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  className="rounded-md p-1.5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {adding && (
        <DeviceForm
          initial={EMPTY_DEVICE}
          hasIp={hasIp}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Add button */}
      {!adding && (
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingIdx(null) }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-dashed border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Plus className="size-3" />
          Add device
        </button>
      )}
    </div>
  )
}

function DeviceField({
  icon, label, value, mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>
        {icon}{label}
      </p>
      <p
        className={cn("text-[12px] truncate", mono && "font-mono")}
        style={{ color: value === "—" ? "var(--muted-foreground)" : "var(--foreground)" }}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function SurveyQuestionsWizard({
  open, onClose, surveyId, surveyName, sectionKey, sectionLabel, customerCompletedBy,
}: Props) {
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [answers,    setAnswers]    = useState<Record<string, string>>({})
  const [loading,    setLoading]    = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [isPending,  startSave]     = useTransition()

  const dbSection = sectionKey.toUpperCase()

  const answeredCount = questions.filter(q => {
    const v = answers[q.key] ?? ""
    if (q.type === "DEVICE_LIST") return parseDevices(v).length > 0
    return v !== "" && v !== "[]"
  }).length

  useEffect(() => {
    if (!open || !sectionKey) return
    setQuestions([])
    setAnswers({})
    setSaveError(null)
    setSaved(false)
    setLoading(true)

    async function load() {
      try {
        const [qRes, rRes] = await Promise.all([
          fetch(`/api/site-surveys/questions?section=${dbSection}`),
          fetch(`/api/site-surveys/${surveyId}/results`),
        ])

        if (!qRes.ok) {
          const text = await qRes.text().catch(() => "")
          setSaveError(`Questions API error ${qRes.status}${text ? `: ${text.slice(0, 120)}` : ""}`)
          return
        }
        if (!rRes.ok) {
          const text = await rRes.text().catch(() => "")
          setSaveError(`Results API error ${rRes.status}${text ? `: ${text.slice(0, 120)}` : ""}`)
          return
        }

        const qs: Question[] = await qRes.json()
        const res = await rRes.json()

        const byKey: Record<string, string | null> = res.byKey ?? {}
        const initial: Record<string, string> = {}
        for (const q of qs) {
          initial[q.key] = byKey[q.key] ?? ""
        }
        setQuestions(qs)
        setAnswers(initial)
      } catch (err) {
        setSaveError(`Failed to load: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [open, surveyId, dbSection, sectionKey])

  function setAnswer(key: string, val: string) {
    setSaved(false)
    setAnswers(prev => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    setSaved(false)
    startSave(async () => {
      try {
        const res = await fetch(`/api/site-surveys/${surveyId}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setSaveError(err.error ?? `Save failed (${res.status})`)
          return
        }
        setSaveError(null)
        setSaved(true)
      } catch (err) {
        setSaveError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  const progressPct = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0
  const allDone = questions.length > 0 && answeredCount === questions.length

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-[var(--card)] shadow-2xl border-l border-[var(--border)] flex flex-col animate-in slide-in-from-right duration-250 focus:outline-none"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border)] shrink-0">
            <div>
              <Dialog.Title className="text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
                {sectionLabel}
              </Dialog.Title>
              <Dialog.Description className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {surveyName}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="size-8 rounded-lg flex items-center justify-center hover:bg-[var(--muted)] transition-colors mt-0.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Customer-submitted warning banner */}
          {customerCompletedBy && (
            <div className="shrink-0 mx-6 mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-amber-400">Customer already submitted this section</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>{customerCompletedBy}</span> filled
                  in this questionnaire. Any changes you save here will overwrite their answers and be recorded in the history.
                </p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {!loading && questions.length > 0 && (
            <div className="shrink-0 px-6 py-3 border-b border-[var(--border)]" style={{ background: "var(--muted)/30" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Progress
                </span>
                <span
                  className="text-[11px] font-bold tabular-nums transition-colors"
                  style={{ color: allDone ? "rgb(52 211 153)" : "var(--foreground)" }}
                >
                  {answeredCount} / {questions.length} answered
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progressPct}%`,
                    background: allDone
                      ? "linear-gradient(90deg, rgb(16 185 129), rgb(52 211 153))"
                      : "linear-gradient(90deg, rgb(99 102 241), rgb(129 140 248))",
                  }}
                />
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-16 gap-2" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-5 animate-spin" />
                <span className="text-[13px]">Loading questions…</span>
              </div>
            )}

            {!loading && saveError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3">
                <p className="text-[12px] font-semibold text-rose-400 mb-0.5">Failed to load questions</p>
                <p className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>{saveError}</p>
              </div>
            )}

            {!loading && !saveError && questions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: "var(--muted-foreground)" }}>
                <p className="text-[13px]">No questions defined for this section yet.</p>
                <p className="text-[11px]">Add questions in Master Options → Survey Questions.</p>
              </div>
            )}

            {!loading && questions.map((q, idx) => {
              const val        = answers[q.key] ?? ""
              const isAnswered = q.type === "DEVICE_LIST"
                ? parseDevices(val).length > 0
                : val !== "" && val !== "[]"

              return (
                <div
                  key={q.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all duration-200",
                    isAnswered
                      ? "border-emerald-500/25 bg-emerald-500/[3%]"
                      : "border-[var(--border)]",
                  )}
                >
                  {/* Question label row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        "shrink-0 size-5 rounded-full flex items-center justify-center mt-0.5 transition-all",
                        isAnswered
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-indigo-500/10 text-indigo-400",
                      )}
                    >
                      {isAnswered
                        ? <Check className="size-2.5" strokeWidth={3} />
                        : <span className="text-[9px] font-black leading-none">{idx + 1}</span>
                      }
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                        {q.label}
                      </p>
                      {q.type === "DEVICE_LIST" && (() => {
                        const count = parseDevices(val).length
                        return count > 0 ? (
                          <p className="text-[11px] mt-0.5 text-emerald-400 font-medium">
                            {count} device{count !== 1 ? "s" : ""} recorded
                          </p>
                        ) : null
                      })()}
                    </div>
                  </div>

                  {/* Input */}
                  <div className={q.type === "DEVICE_LIST" ? "" : "ml-8"}>
                    {q.type === "TEXT" && (
                      <TextAnswer value={val} onChange={v => setAnswer(q.key, v)} />
                    )}
                    {q.type === "NUMBER" && (
                      <NumberAnswer value={val} onChange={v => setAnswer(q.key, v)} />
                    )}
                    {q.type === "BOOLEAN" && (
                      <BooleanAnswer value={val} onChange={v => setAnswer(q.key, v)} />
                    )}
                    {q.type === "DROPDOWN" && Array.isArray(q.options) && (
                      <DropdownAnswer
                        value={val}
                        options={q.options as { id: number | string; label: string }[]}
                        onChange={v => setAnswer(q.key, v)}
                      />
                    )}
                    {q.type === "MULTI_SELECT" && Array.isArray(q.options) && (
                      <MultiSelectAnswer
                        value={val}
                        options={q.options as { id: number | string; label: string }[]}
                        onChange={v => setAnswer(q.key, v)}
                      />
                    )}
                    {q.type === "DEVICE_LIST" && (
                      <DeviceListAnswer
                        value={val}
                        config={isDeviceConfig(q.options) ? q.options : {}}
                        onChange={v => setAnswer(q.key, v)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {!loading && questions.length > 0 && (
            <div className="px-6 py-4 border-t border-[var(--border)] shrink-0 flex items-center justify-between gap-3">
              {saveError && !loading ? (
                <p className="text-[11px] text-rose-400 font-semibold truncate">{saveError}</p>
              ) : saved && !isPending ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-400 font-semibold">
                  <Check className="size-3.5" strokeWidth={3} /> Saved successfully
                </span>
              ) : (
                <span />
              )}
              <Btn size="sm" onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save answers
              </Btn>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
