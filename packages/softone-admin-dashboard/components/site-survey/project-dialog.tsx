"use client"

import React, { useState, useEffect, useTransition } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import * as Checkbox from "@radix-ui/react-checkbox"
import {
  X, Loader2, Check, Building2, ClipboardList, Globe, ShieldCheck, Bot, Cpu,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: number
  name: string
  description: string | null
  customerId: number
  sections: string[]
  status: string
  type: string
  createdAt: string
  updatedAt: string
  customer: { id: number; name: string | null }
}

interface Props {
  open: boolean
  onClose: () => void
  project?: ProjectRow | null
  users: { id: string; name: string | null; email: string }[]
  customerOptions: { id: number; name: string | null }[]
  onSaved: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "hardware_network", label: "Υποδομή & Δίκτυα", icon: <Cpu className="size-3.5" strokeWidth={1.5} />, color: "bg-sky-950/70 text-sky-300 border-sky-800/50" },
  { key: "software",         label: "Λογισμικό",         icon: <ClipboardList className="size-3.5" strokeWidth={1.5} />, color: "bg-violet-950/70 text-violet-300 border-violet-800/50" },
  { key: "web_ecommerce",    label: "Web & E-commerce",   icon: <Globe className="size-3.5" strokeWidth={1.5} />, color: "bg-blue-950/70 text-blue-300 border-blue-800/50" },
  { key: "compliance",       label: "Συμμόρφωση",         icon: <ShieldCheck className="size-3.5" strokeWidth={1.5} />, color: "bg-rose-950/70 text-rose-300 border-rose-800/50" },
  { key: "iot_ai",           label: "IoT & AI",           icon: <Bot className="size-3.5" strokeWidth={1.5} />, color: "bg-teal-950/70 text-teal-300 border-teal-800/50" },
] as const

const STATUSES = [
  { key: "DRAFT",       label: "Πρόχειρο" },
  { key: "IN_PROGRESS", label: "Σε εξέλιξη" },
  { key: "COMPLETED",   label: "Ολοκληρώθηκε" },
  { key: "CANCELLED",   label: "Ακυρώθηκε" },
] as const

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--input)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 13,
  width: "100%",
  outline: "none",
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--muted-foreground)",
  marginBottom: 4,
  display: "block",
}

// ─── CustomerSelect ───────────────────────────────────────────────────────────

function CustomerSelect({
  value,
  onChange,
  options,
}: {
  value: number | null
  onChange: (id: number) => void
  options: { id: number; name: string | null }[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  const filtered = options.filter((o) =>
    (o.name ?? "").toLowerCase().includes(search.toLowerCase())
  )
  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...INPUT_STYLE,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span style={{ color: selected ? "var(--foreground)" : "var(--muted-foreground)" }}>
          {selected ? (selected.name ?? `#${selected.id}`) : "Επιλογή πελάτη…"}
        </span>
        <ChevronDown className="size-3.5" strokeWidth={1.5} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            zIndex: 50,
            maxHeight: 240,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
            <input
              autoFocus
              placeholder="Αναζήτηση…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...INPUT_STYLE, padding: "4px 8px", fontSize: 12 }}
            />
          </div>
          <div style={{ overflowY: "auto", maxHeight: 180 }}>
            {filtered.length === 0 ? (
              <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted-foreground)" }}>Κανένα αποτέλεσμα</p>
            ) : filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); setSearch("") }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 12px",
                  fontSize: 13,
                  color: o.id === value ? "var(--foreground)" : "var(--muted-foreground)",
                  background: o.id === value ? "rgba(255,255,255,0.06)" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = o.id === value ? "rgba(255,255,255,0.06)" : "transparent" }}
              >
                <Building2 className="size-3.5 flex-shrink-0" strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
                <span>{o.name ?? `#${o.id}`}</span>
                {o.id === value && <Check className="size-3 ml-auto" strokeWidth={2} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ProjectDialog ────────────────────────────────────────────────────────────

export function ProjectDialog({ open, onClose, project, customerOptions, onSaved }: Props) {
  const isEdit = Boolean(project)
  const [isPending, startTransition] = useTransition()

  const [name, setName]             = useState("")
  const [description, setDescription] = useState("")
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [sections, setSections]     = useState<string[]>([])
  const [status, setStatus]         = useState("DRAFT")
  const [error, setError]           = useState<string | null>(null)

  // Populate on edit
  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description ?? "")
      setCustomerId(project.customerId)
      setSections(project.sections)
      setStatus(project.status)
    } else {
      setName("")
      setDescription("")
      setCustomerId(null)
      setSections([])
      setStatus("DRAFT")
    }
    setError(null)
  }, [project, open])

  function toggleSection(key: string) {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return }
    if (!customerId) { setError("Επιλέξτε πελάτη"); return }
    setError(null)

    startTransition(async () => {
      try {
        const body = {
          name: name.trim(),
          description: description.trim() || null,
          customerId,
          sections,
          status,
          type: "PROJECT",
          date: new Date().toISOString(),
          surveyorId: "system",
          branchIds: [],
        }

        const res = await fetch(
          project ? `/api/site-surveys/${project.id}` : "/api/site-surveys",
          {
            method: project ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        )

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? "Κάτι πήγε στραβά")
          return
        }

        onSaved()
        onClose()
      } catch {
        setError("Σφάλμα δικτύου")
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            width: "100%",
            maxWidth: 520,
            maxHeight: "90vh",
            overflowY: "auto",
            zIndex: 101,
            padding: 0,
            boxShadow: "0 8px 48px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              {isEdit ? "Επεξεργασία Έργου" : "Νέο Έργο"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted-foreground)",
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name */}
            <div>
              <label style={LABEL_STYLE}>Όνομα Έργου *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="π.χ. Έργο Ψηφιακής Αναβάθμισης"
                style={INPUT_STYLE}
              />
            </div>

            {/* Customer */}
            <div>
              <label style={LABEL_STYLE}>Πελάτης *</label>
              <CustomerSelect value={customerId} onChange={setCustomerId} options={customerOptions} />
            </div>

            {/* Description */}
            <div>
              <label style={LABEL_STYLE}>Περιγραφή</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Σύντομη περιγραφή του έργου…"
                rows={3}
                style={{ ...INPUT_STYLE, resize: "vertical" }}
              />
            </div>

            {/* Sections */}
            <div>
              <label style={LABEL_STYLE}>Ενότητες</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SECTIONS.map((sec) => {
                  const checked = sections.includes(sec.key)
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => toggleSection(sec.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                        checked ? sec.color : "bg-transparent text-[color:var(--muted-foreground)] border-[color:var(--border)]"
                      )}
                    >
                      {sec.icon}
                      {sec.label}
                      {checked && <Check className="size-2.5" strokeWidth={2.5} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Status */}
            <div>
              <label style={LABEL_STYLE}>Κατάσταση</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ ...INPUT_STYLE, cursor: "pointer" }}
              >
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{error}</p>
            )}

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                style={{
                  padding: "7px 14px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                }}
              >
                Ακύρωση
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: "none",
                  background: "#0078D4",
                  color: "#fff",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                {isEdit ? "Αποθήκευση" : "Δημιουργία"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
