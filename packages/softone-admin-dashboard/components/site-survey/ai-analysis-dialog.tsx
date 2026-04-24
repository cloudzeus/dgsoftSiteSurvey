"use client"

import React, { useState, useCallback, useId, useEffect } from "react"
import {
  Sparkles, X, Loader2, Download, ChevronDown, ChevronUp,
  Cpu, ClipboardList, Globe, ShieldCheck, Bot, AlertCircle,
  CheckCircle2, RefreshCw, PlayCircle, Pencil, Check, EyeOff,
  FileText, Plus, Trash2, Lightbulb,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionRequirement { id: number; title: string; description: string | null }

interface CompanySuggestionRow { id: number; section: string; title: string; description: string | null }

interface SectionAnalysis {
  section: string
  label: string
  currentSituation: string
  gaps: string
  proposals: string
  ideas: string
  estimation: string
  services: string
}

interface ProposalItem {
  id: string
  text: string
  included: boolean
  custom: boolean
}

type SectionState = "idle" | "loading" | "done" | "error"

// ─── Section key ↔ enum maps ──────────────────────────────────────────────────

const SECTION_ENUM_MAP: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software:         "SOFTWARE",
  web_ecommerce:    "WEB_ECOMMERCE",
  compliance:       "COMPLIANCE",
  iot_ai:           "IOT_AI",
}

const ENUM_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_ENUM_MAP).map(([k, v]) => [v, k])
)

// ─── Section meta ─────────────────────────────────────────────────────────────

const SECTION_META: Record<string, { icon: React.ReactNode; label: string; accent: string; accentBg: string }> = {
  hardware_network: { icon: <Cpu className="size-4" strokeWidth={1.5} />,          label: "Υποδομή & Δίκτυα",         accent: "#0369A1", accentBg: "rgba(3,105,161,0.10)"   },
  software:         { icon: <ClipboardList className="size-4" strokeWidth={1.5} />, label: "Λογισμικό",                accent: "#6D28D9", accentBg: "rgba(109,40,217,0.10)"  },
  web_ecommerce:    { icon: <Globe className="size-4" strokeWidth={1.5} />,         label: "Διαδίκτυο & E-commerce",   accent: "#1D4ED8", accentBg: "rgba(29,78,216,0.10)"   },
  compliance:       { icon: <ShieldCheck className="size-4" strokeWidth={1.5} />,   label: "Συμμόρφωση",               accent: "#BE123C", accentBg: "rgba(190,18,60,0.10)"   },
  iot_ai:           { icon: <Bot className="size-4" strokeWidth={1.5} />,           label: "IoT & Τεχνητή Νοημοσύνη", accent: "#0F766E", accentBg: "rgba(15,118,110,0.10)"  },
}

// ─── Parse numbered / bullet items from plain text ────────────────────────────

function parseItems(text: string): string[] {
  if (!text?.trim()) return []
  const lines  = text.split("\n")
  const items: string[] = []
  let current  = ""

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const numMatch    = t.match(/^(\d+[\.\)])\s+/)
    const bulletMatch = t.match(/^[•\-]\s+/)
    if (numMatch) {
      if (current) items.push(current.trim())
      current = t.slice(numMatch[0].length)
    } else if (bulletMatch) {
      if (current) items.push(current.trim())
      current = t.slice(bulletMatch[0].length)
    } else if (current) {
      current += " " + t            // continuation line
    } else {
      current = t                   // free-form paragraph
    }
  }
  if (current) items.push(current.trim())
  return items.filter(Boolean)
}

function itemsToText(items: ProposalItem[]): string {
  return items
    .filter(i => i.included)
    .map((item, idx) => `${idx + 1}. ${item.text}`)
    .join("\n")
}

// ─── CompanySuggestionsPanel ──────────────────────────────────────────────────

function CompanySuggestionsPanel({
  surveyId,
  sections,
  suggestions,
  onAdd,
  onDelete,
}: {
  surveyId: number
  sections: string[]
  suggestions: Record<string, CompanySuggestionRow[]>  // keyed by section KEY (e.g. "hardware_network")
  onAdd: (sectionKey: string, row: CompanySuggestionRow) => void
  onDelete: (sectionKey: string, id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(sections[0] ?? "")
  const [newTitle, setNewTitle] = useState("")
  const [newDesc,  setNewDesc]  = useState("")
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error,    setError]    = useState("")

  const totalCount = Object.values(suggestions).reduce((s, arr) => s + arr.length, 0)
  const currentSuggs = suggestions[activeSection] ?? []
  const meta = SECTION_META[activeSection]

  async function addSuggestion() {
    if (!newTitle.trim() || !activeSection) return
    setSaving(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("section",     SECTION_ENUM_MAP[activeSection] ?? "")
      fd.append("source",      "COMPANY")
      fd.append("title",       newTitle.trim())
      if (newDesc.trim()) fd.append("description", newDesc.trim())
      const res = await fetch(`/api/site-surveys/${surveyId}/requirements`, { method: "POST", body: fd })
      const row = await res.json()
      if (!res.ok) { setError(row.error ?? "Σφάλμα αποθήκευσης"); return }
      onAdd(activeSection, { ...row, section: SECTION_ENUM_MAP[activeSection] })
      setNewTitle("")
      setNewDesc("")
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function deleteSuggestion(sectionKey: string, id: number) {
    setDeleting(id)
    try {
      await fetch(`/api/site-surveys/${surveyId}/requirements/${id}`, { method: "DELETE" })
      onDelete(sectionKey, id)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: open ? "#D97706" : "#F59E0B40" }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: open ? "#FFFBEB" : "#FEFCE8" }}
      >
        <div className="size-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(217,119,6,0.12)", color: "#D97706" }}>
          <Lightbulb className="size-3.5" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: "#92400E" }}>Προτάσεις Εταιρείας</p>
          <p className="text-[11px]" style={{ color: "#B45309" }}>
            Εσωτερικές τεχνικές εκτιμήσεις που θα ενσωματωθούν στην ανάλυση
          </p>
        </div>
        {totalCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: "rgba(217,119,6,0.15)", color: "#D97706" }}>
            {totalCount}
          </span>
        )}
        {open ? <ChevronUp className="size-4 shrink-0" style={{ color: "#D97706" }} strokeWidth={1.5} />
               : <ChevronDown className="size-4 shrink-0" style={{ color: "#D97706" }} strokeWidth={1.5} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}>
          {/* Section tabs */}
          <div className="flex flex-wrap gap-1.5">
            {sections.map(key => {
              const m = SECTION_META[key]
              const count = (suggestions[key] ?? []).length
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                  style={activeSection === key
                    ? { background: m?.accent ? `${m.accent}18` : "#E0F2FE", color: m?.accent ?? "#0369A1", border: `1px solid ${m?.accent ?? "#0369A1"}40` }
                    : { background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }
                  }
                >
                  {m?.icon}
                  <span>{m?.label ?? key}</span>
                  {count > 0 && (
                    <span className="size-4 flex items-center justify-center rounded-full text-[9px] font-black"
                      style={{ background: m?.accent ? `${m.accent}25` : "#DBEAFE", color: m?.accent ?? "#1D4ED8" }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Existing suggestions for this section */}
          {currentSuggs.length > 0 && (
            <div className="space-y-1.5">
              {currentSuggs.map(sugg => (
                <div key={sugg.id}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg border"
                  style={{ background: "#FFFFFF", borderColor: "#FDE68A" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: "#1F2937" }}>{sugg.title}</p>
                    {sugg.description && (
                      <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{sugg.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={deleting === sugg.id}
                    onClick={() => deleteSuggestion(activeSection, sugg.id)}
                    className="shrink-0 size-6 rounded flex items-center justify-center transition-colors hover:bg-rose-50"
                    style={{ color: deleting === sugg.id ? "#D1D5DB" : "#EF4444" }}
                  >
                    {deleting === sugg.id
                      ? <Loader2 className="size-3 animate-spin" />
                      : <Trash2 className="size-3" strokeWidth={1.5} />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {currentSuggs.length === 0 && (
            <p className="text-[11px] italic" style={{ color: "#B45309" }}>
              Δεν υπάρχουν προτάσεις εταιρείας για αυτή την ενότητα.
            </p>
          )}

          {/* Add form */}
          <div className="rounded-lg border p-3 space-y-2" style={{ background: "#FFFFFF", borderColor: "#FDE68A" }}>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addSuggestion() } }}
              placeholder="Τίτλος πρότασης εταιρείας…"
              className="w-full rounded-lg border px-3 py-2 text-[12px] focus:outline-none focus:ring-1"
              style={{ borderColor: "#FCD34D", background: "#FFFBEB", color: "#1F2937" }}
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Τεχνικές λεπτομέρειες (προαιρετικό)…"
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1"
              style={{ borderColor: "#FCD34D", background: "#FFFBEB", color: "#1F2937", fontFamily: "inherit" }}
            />
            {error && <p className="text-[11px]" style={{ color: "#EF4444" }}>{error}</p>}
            <button
              type="button"
              onClick={addSuggestion}
              disabled={saving || !newTitle.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: "rgba(217,119,6,0.12)", color: "#D97706" }}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" strokeWidth={1.5} />}
              {saving ? "Αποθήκευση…" : "Προσθήκη Πρότασης"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EditableTextArea ─────────────────────────────────────────────────────────

function EditableTextArea({
  title, value, onChange, accent,
}: { title: string; value: string; onChange: (v: string) => void; accent: string }) {
  const [editing, setEditing] = useState(false)
  if (!value?.trim()) return null
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-2 pb-1.5" style={{ borderBottom: `1px solid ${accent}25` }}>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>{title}</span>
        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
          style={editing ? { background: `${accent}18`, color: accent } : { background: "#F3F2F1", color: "#605E5C" }}
        >
          {editing
            ? <><Check className="size-3" strokeWidth={2} /> Αποθήκευση</>
            : <><Pencil className="size-3" strokeWidth={1.5} /> Επεξεργασία</>}
        </button>
      </div>
      {editing ? (
        <textarea
          autoFocus
          className="w-full rounded-xl border text-[12px] leading-relaxed p-3 resize-y focus:outline-none focus:ring-2"
          style={{
            borderColor: `${accent}50`,
            background: `${accent}05`,
            color: "#201F1E",
            minHeight: 140,
            fontFamily: "inherit",
            lineHeight: 1.7,
          } as React.CSSProperties}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <div className="space-y-1.5 cursor-text" onClick={() => setEditing(true)}>
          {value.split("\n").map((line, i) => {
            const t = line.trim()
            if (!t) return null
            const numMatch = t.match(/^(\d+[\.\)])\s*/)
            const isBullet = t.startsWith("•") || t.startsWith("-")
            if (isBullet) return (
              <div key={i} className="flex gap-2 text-[13px] leading-relaxed text-[#374151]">
                <span className="shrink-0 font-bold" style={{ color: accent }}>•</span>
                <span>{t.slice(1).trim()}</span>
              </div>
            )
            if (numMatch) return (
              <div key={i} className="flex gap-2 text-[13px] leading-relaxed text-[#374151]">
                <span className="shrink-0 font-semibold" style={{ color: accent }}>{numMatch[1]}</span>
                <span>{t.slice(numMatch[0].length)}</span>
              </div>
            )
            return <p key={i} className="text-[13px] leading-relaxed text-[#374151]">{t}</p>
          })}
          <p className="text-[11px] mt-1 italic" style={{ color: "#A19F9D" }}>Κλικ για επεξεργασία</p>
        </div>
      )}
    </div>
  )
}

// ─── EstimationBlock ─────────────────────────────────────────────────────────

function EstimationBlock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (!value?.trim()) return null
  const ACCENT = "#D97706"

  function renderLine(line: string, i: number) {
    const t = line.trim()
    if (!t) return null

    // Section divider (━━━ ΣΥΝΟΛΟ ━━━ or similar)
    if (/^━+/.test(t) || /^---+/.test(t)) {
      const label = t.replace(/━/g, "").replace(/-/g, "").trim()
      return (
        <div key={i} className="my-3 flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: `${ACCENT}35` }} />
          {label && <span className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: ACCENT }}>{label}</span>}
          <div className="flex-1 h-px" style={{ background: `${ACCENT}35` }} />
        </div>
      )
    }

    const numMatch = t.match(/^(\d+[\.\)])\s*/)
    const isBullet = t.startsWith("•") || t.startsWith("-")
    const content  = isBullet ? t.slice(1).trim() : numMatch ? t.slice(numMatch[0].length) : t

    // Lines with pipe separators — render as data pills
    if (content.includes(" | ")) {
      const parts = content.split(" | ")
      return (
        <div key={i} className="flex items-center flex-wrap gap-x-3 gap-y-1 pl-1">
          {isBullet && <span className="text-[11px]" style={{ color: ACCENT }}>•</span>}
          {parts.map((part, pi) => (
            <React.Fragment key={pi}>
              {pi > 0 && <span className="text-[#D1D5DB] text-[11px]">·</span>}
              <span className="text-[12px] font-semibold" style={{ color: "#1F2937" }}>{part.trim()}</span>
            </React.Fragment>
          ))}
        </div>
      )
    }

    // Numbered item — proposal header
    if (numMatch) return (
      <p key={i} className="text-[13px] font-semibold mt-2.5" style={{ color: "#1F2937" }}>
        <span className="mr-1" style={{ color: ACCENT }}>{numMatch[1]}</span>
        {content}
      </p>
    )

    // Regular bullet
    if (isBullet) return (
      <div key={i} className="flex gap-2 text-[12px] leading-relaxed pl-1">
        <span className="shrink-0 mt-0.5" style={{ color: ACCENT }}>•</span>
        <span style={{ color: "#374151" }}>{content}</span>
      </div>
    )

    // Paragraph (e.g. "ΓΙΑΤΙ CLAUDE CODE" explanation)
    return <p key={i} className="text-[12px] leading-relaxed" style={{ color: "#374151" }}>{t}</p>
  }

  return (
    <div className="mt-5 rounded-xl border-2 overflow-hidden" style={{ borderColor: ACCENT }}>
      <div className="px-3 py-2 flex items-center justify-between gap-2" style={{ background: "rgba(217,119,6,0.08)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: ACCENT }}>
            Εκτίμηση Ωρών & Κόστους
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(217,119,6,0.15)", color: "#B45309" }}>
            Claude Code
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
          style={editing ? { background: `${ACCENT}18`, color: ACCENT } : { background: "#F3F2F1", color: "#605E5C" }}
        >
          {editing ? <><Check className="size-3" strokeWidth={2} /> Αποθήκευση</> : <><Pencil className="size-3" strokeWidth={1.5} /> Επεξεργασία</>}
        </button>
      </div>
      <div className="px-4 pb-4 pt-2 space-y-0.5" style={{ background: "#FFFBEB" }}>
        {editing ? (
          <textarea
            autoFocus
            className="w-full rounded-xl border text-[12px] leading-relaxed p-3 resize-y focus:outline-none focus:ring-2"
            style={{ borderColor: `${ACCENT}50`, background: `${ACCENT}05`, color: "#201F1E", minHeight: 200, fontFamily: "inherit", lineHeight: 1.7 } as React.CSSProperties}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        ) : (
          <div className="cursor-text" onClick={() => setEditing(true)}>
            {value.split("\n").map(renderLine)}
            <p className="text-[11px] mt-2 italic" style={{ color: "#A19F9D" }}>Κλικ για επεξεργασία</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── IdeaCardsBlock ───────────────────────────────────────────────────────────

function IdeaCardsBlock({
  ideas, accent, onDelete,
}: { ideas: string[]; accent: string; onDelete: (idx: number) => void }) {
  if (!ideas.length) return null
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: `1px solid ${accent}25` }}>
        <Lightbulb className="size-3.5 shrink-0" style={{ color: accent }} strokeWidth={1.5} />
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
          Ιδέες για Αναβάθμιση
        </span>
        <span className="text-[10px]" style={{ color: "#9CA3AF" }}>δεν συμπεριλαμβάνονται στην πρόταση</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ideas.map((idea, i) => (
          <div key={i}
            className="relative flex items-start gap-2.5 rounded-xl border px-3 py-2.5 group"
            style={{ borderColor: `${accent}30`, background: `${accent}05` }}>
            <Lightbulb className="size-3.5 shrink-0 mt-0.5" style={{ color: accent }} strokeWidth={1.5} />
            <p className="flex-1 text-[12px] leading-relaxed" style={{ color: "#374151" }}>{idea}</p>
            <button
              type="button"
              onClick={() => onDelete(i)}
              className="shrink-0 size-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50"
              style={{ color: "#BE123C" }}
              title="Αφαίρεση ιδέας"
            >
              <X className="size-3" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ServicesBlock ────────────────────────────────────────────────────────────

function ServicesBlock({ value, accent }: { value: string; accent: string }) {
  if (!value?.trim()) return null

  // Parse into service entries (each starts with a number like "1." or "1)")
  const lines = value.split("\n")
  const entries: { name: string; details: string[] }[] = []
  let current: { name: string; details: string[] } | null = null

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const numMatch = t.match(/^(\d+[\.\)])\s*(.*)/)
    if (numMatch) {
      if (current) entries.push(current)
      current = { name: numMatch[2].trim(), details: [] }
    } else if (current && (t.startsWith("•") || t.startsWith("-"))) {
      current.details.push(t.slice(1).trim())
    } else if (current) {
      current.details.push(t)
    }
  }
  if (current) entries.push(current)

  if (!entries.length) return null

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: `1px solid ${accent}25` }}>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
          APIs & Υπηρεσίες Τρίτων
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${accent}12`, color: accent }}>
          {entries.length} υπηρεσίες
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry, i) => (
          <div key={i} className="rounded-xl border px-3 py-2.5" style={{ borderColor: `${accent}22`, background: `${accent}04` }}>
            <p className="text-[13px] font-semibold mb-1.5" style={{ color: "#1F2937" }}>{entry.name}</p>
            <div className="space-y-0.5">
              {entry.details.map((d, di) => {
                const [label, ...rest] = d.split(":")
                const val = rest.join(":").trim()
                if (val) return (
                  <div key={di} className="flex gap-1.5 text-[11px]">
                    <span className="font-semibold shrink-0" style={{ color: accent }}>{label.trim()}:</span>
                    <span style={{ color: "#6B7280" }}>{val}</span>
                  </div>
                )
                return <p key={di} className="text-[11px]" style={{ color: "#6B7280" }}>{d}</p>
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ProposalItemsEditor ──────────────────────────────────────────────────────

function ProposalItemsEditor({
  items, accent, onToggle, onEdit, onAdd, onRemove,
}: {
  items: ProposalItem[]
  accent: string
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onAdd: (text: string) => void
  onRemove: (id: string) => void
}) {
  const [newText, setNewText] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBuf, setEditBuf] = useState("")
  const inputId = useId()

  function startEdit(item: ProposalItem) {
    setEditingId(item.id)
    setEditBuf(item.text)
  }
  function commitEdit(id: string) {
    onEdit(id, editBuf.trim() || "—")
    setEditingId(null)
  }
  function addItem() {
    const t = newText.trim()
    if (!t) return
    onAdd(t)
    setNewText("")
  }

  const includedCount = items.filter(i => i.included).length

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: `1px solid ${accent}25` }}>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
          Προτεινόμενες Βελτιώσεις
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${accent}18`, color: accent }}>
          {includedCount} / {items.length} επιλεγμένες
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors group"
            style={{ background: item.included ? `${accent}06` : "transparent", opacity: item.included ? 1 : 0.58 }}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={item.included}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 shrink-0 rounded accent-[#0078D4] cursor-pointer"
              style={{ width: 15, height: 15 }}
            />

            {/* Text / inline editor */}
            <div className="flex-1 min-w-0">
              {editingId === item.id ? (
                <div className="flex gap-1.5">
                  <textarea
                    autoFocus
                    className="flex-1 rounded-lg border text-[12px] p-1.5 resize-none focus:outline-none focus:ring-1"
                    style={{ borderColor: `${accent}50`, background: `${accent}05`, color: "#201F1E", minHeight: 56, fontFamily: "inherit" } as React.CSSProperties}
                    value={editBuf}
                    onChange={e => setEditBuf(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(item.id) } }}
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={() => commitEdit(item.id)}
                    className="self-start mt-0.5 size-6 rounded flex items-center justify-center"
                    style={{ background: `${accent}18`, color: accent }}
                  >
                    <Check className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-[#374151]">
                  <span className="font-semibold mr-1" style={{ color: accent }}>{idx + 1}.</span>
                  {item.text}
                  {item.custom && <span className="ml-1.5 text-[10px] italic" style={{ color: "#9CA3AF" }}>(δική σας)</span>}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {editingId !== item.id && (
                <button type="button" onClick={() => startEdit(item)} className="size-5 flex items-center justify-center rounded hover:bg-[#F3F2F1]" style={{ color: "#9CA3AF" }}>
                  <Pencil className="size-3" strokeWidth={1.5} />
                </button>
              )}
              {item.custom && (
                <button type="button" onClick={() => onRemove(item.id)} className="size-5 flex items-center justify-center rounded hover:bg-[rgba(190,18,60,0.08)]" style={{ color: "#BE123C" }}>
                  <Trash2 className="size-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add custom item */}
      <div className="flex gap-2 mt-3">
        <input
          id={inputId}
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addItem() }}
          placeholder="Προσθήκη δικής σας πρότασης…"
          className="flex-1 rounded-lg border px-3 py-2 text-[12px] focus:outline-none focus:ring-1"
          style={{ borderColor: `${accent}40`, background: "transparent", color: "#201F1E" } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!newText.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40"
          style={{ background: `${accent}18`, color: accent }}
        >
          <Plus className="size-3.5" strokeWidth={1.5} /> Προσθήκη
        </button>
      </div>
    </div>
  )
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({
  sectionKey, state, analysis, error, included,
  proposalItems, ideas,
  onGenerate, onToggleInclude,
  onUpdateField,
  onToggleItem, onEditItem, onAddItem, onRemoveItem,
  onDeleteIdea, onRemoveSection,
}: {
  sectionKey: string
  state: SectionState
  analysis: SectionAnalysis | null
  error: string
  included: boolean
  proposalItems: ProposalItem[]
  ideas: string[]
  onGenerate: (key: string) => void
  onToggleInclude: (key: string) => void
  onUpdateField: (key: string, field: keyof SectionAnalysis, value: string) => void
  onToggleItem: (key: string, id: string) => void
  onEditItem: (key: string, id: string, text: string) => void
  onAddItem: (key: string, text: string) => void
  onRemoveItem: (key: string, id: string) => void
  onDeleteIdea: (key: string, idx: number) => void
  onRemoveSection: (key: string) => void
}) {
  const [open, setOpen] = useState(true)
  const meta = SECTION_META[sectionKey] ?? { icon: <Sparkles className="size-4" strokeWidth={1.5} />, label: sectionKey, accent: "#0078D4", accentBg: "rgba(0,120,212,0.10)" }
  const dimmed = state === "done" && !included

  return (
    <div
      className="rounded-xl border overflow-hidden transition-opacity"
      style={{ borderColor: dimmed ? "#E1DFDD" : `${meta.accent}35`, background: "#ffffff", opacity: dimmed ? 0.5 : 1 }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: state === "done" && open && included ? meta.accentBg : "transparent" }}
      >
        <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.accentBg, color: meta.accent }}>
          {meta.icon}
        </div>
        <span className="flex-1 text-[14px] font-semibold text-[#1F2937]">{meta.label}</span>

        {state === "idle" && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onGenerate(sectionKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ background: meta.accentBg, color: meta.accent }}>
              <PlayCircle className="size-3.5" strokeWidth={1.5} /> Ανάλυση
            </button>
            <button type="button" onClick={() => onRemoveSection(sectionKey)} title="Αφαίρεση ενότητας"
              className="size-7 rounded-lg flex items-center justify-center hover:bg-rose-50 transition-colors"
              style={{ color: "#BE123C" }}>
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        )}
        {state === "loading" && (
          <span className="flex items-center gap-1.5 text-[12px]" style={{ color: meta.accent }}>
            <Loader2 className="size-3.5 animate-spin" /> Επεξεργασία…
          </span>
        )}
        {state === "error" && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onGenerate(sectionKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ background: "rgba(190,18,60,0.08)", color: "#BE123C" }}>
              <RefreshCw className="size-3.5" strokeWidth={1.5} /> Επανάληψη
            </button>
            <button type="button" onClick={() => onRemoveSection(sectionKey)} title="Αφαίρεση ενότητας"
              className="size-7 rounded-lg flex items-center justify-center hover:bg-rose-50 transition-colors"
              style={{ color: "#BE123C" }}>
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        )}
        {state === "done" && analysis && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onToggleInclude(sectionKey)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={included
                ? { background: "rgba(16,124,16,0.09)", color: "#0D6D12", border: "1px solid rgba(16,124,16,0.18)" }
                : { background: "#F3F2F1", color: "#9CA3AF", border: "1px solid #E1DFDD" }}>
              {included ? <><CheckCircle2 className="size-3" strokeWidth={1.5} /> Συμπεριλαμβάνεται</> : <><EyeOff className="size-3" strokeWidth={1.5} /> Εξαιρείται</>}
            </button>
            <button type="button" onClick={() => onGenerate(sectionKey)} title="Αναγέννηση"
              className="size-7 rounded-lg flex items-center justify-center hover:bg-[#F3F2F1] transition-colors"
              style={{ color: "#9CA3AF" }}>
              <RefreshCw className="size-3.5" strokeWidth={1.5} />
            </button>
            <button type="button" onClick={() => setOpen(v => !v)}
              className="size-7 rounded-lg flex items-center justify-center hover:bg-[#F3F2F1] transition-colors"
              style={{ color: "#9CA3AF" }}>
              {open ? <ChevronUp className="size-4" strokeWidth={1.5} /> : <ChevronDown className="size-4" strokeWidth={1.5} />}
            </button>
            <button type="button" onClick={() => onRemoveSection(sectionKey)} title="Αφαίρεση ενότητας"
              className="size-7 rounded-lg flex items-center justify-center hover:bg-rose-50 transition-colors"
              style={{ color: "#BE123C" }}>
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {state === "error" && error && (
        <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: "rgba(190,18,60,0.06)", color: "#BE123C" }}>
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />{error}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {state === "done" && analysis && open && (
        <div className="px-4 pb-5" style={{ borderTop: `1px solid ${meta.accent}18` }}>
          <EditableTextArea
            title="Τρέχουσα Κατάσταση"
            value={analysis.currentSituation}
            onChange={v => onUpdateField(sectionKey, "currentSituation", v)}
            accent={meta.accent}
          />
          <EditableTextArea
            title="Κενά & Αδυναμίες"
            value={analysis.gaps}
            onChange={v => onUpdateField(sectionKey, "gaps", v)}
            accent={meta.accent}
          />

          {/* Proposals: selectable checkboxes */}
          <ProposalItemsEditor
            items={proposalItems}
            accent={meta.accent}
            onToggle={id => onToggleItem(sectionKey, id)}
            onEdit={(id, text) => onEditItem(sectionKey, id, text)}
            onAdd={text => onAddItem(sectionKey, text)}
            onRemove={id => onRemoveItem(sectionKey, id)}
          />

          <IdeaCardsBlock
            ideas={ideas}
            accent={meta.accent}
            onDelete={(idx) => onDeleteIdea(sectionKey, idx)}
          />
          <ServicesBlock value={analysis.services ?? ""} accent={meta.accent} />
          <EstimationBlock
            value={analysis.estimation}
            onChange={v => onUpdateField(sectionKey, "estimation", v)}
          />
        </div>
      )}
    </div>
  )
}

// ─── ProposalPanel ────────────────────────────────────────────────────────────

function ProposalPanel({
  surveyId, customerName, surveyName,
  includedSections, results, proposalItems, requirementsBySection,
  companySuggestionsBySection,
  onSuccess,
}: {
  surveyId: number
  customerName: string
  surveyName: string
  includedSections: string[]
  results: Record<string, SectionAnalysis>
  proposalItems: Record<string, ProposalItem[]>
  requirementsBySection: Record<string, SectionRequirement[]>
  companySuggestionsBySection: Record<string, SectionRequirement[]>
  onSuccess: () => void
}) {
  const today = new Date().toLocaleDateString("el-GR")
  const [title, setTitle] = useState(`Τεχνική Πρόταση — ${customerName} — ${today}`)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function create() {
    if (!title.trim()) return
    setSaving(true)
    try {
      // Merge edited proposal items back into the results before sending
      const effectiveResults: Record<string, SectionAnalysis> = {}
      // Also build a map of selected AI proposal item texts per section enum key
      const proposalItemsBySection: Record<string, string[]> = {}
      for (const key of includedSections) {
        const a = results[key]
        if (!a) continue
        effectiveResults[key] = {
          ...a,
          proposals:  itemsToText(proposalItems[key] ?? []),
          estimation: a.estimation ?? "",
        }
        const enumKey = SECTION_ENUM_MAP[key]
        if (enumKey) {
          const selectedTexts = (proposalItems[key] ?? [])
            .filter(i => i.included)
            .map(i => i.text)
          if (selectedTexts.length) proposalItemsBySection[enumKey] = selectedTexts
        }
      }

      const res = await fetch(`/api/site-surveys/${surveyId}/ai-analysis/to-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          customerName,
          includedSections,
          results: effectiveResults,
          requirementsBySection,
          companySuggestionsBySection,
          proposalItemsBySection,
        }),
      })
      const text = await res.text()
      let data: { proposalId?: number; error?: string }
      try { data = JSON.parse(text) } catch { data = { error: text || "Κενή απόκριση" } }
      if (!res.ok) { alert(data.error ?? "Σφάλμα δημιουργίας πρότασης"); return }
      setDone(true)
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  if (done) return (
    <div className="flex items-center gap-2 text-[13px]" style={{ color: "#0D6D12" }}>
      <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.5} />
      Η πρόταση δημιουργήθηκε. Ανοίξτε την από τις ενέργειες της έρευνας.
    </div>
  )

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 rounded-xl border px-3 py-2 text-[13px] focus:outline-none focus:ring-1"
          style={{ borderColor: "#C8C6C4", background: "#FAFAFA", color: "#201F1E" }}
          placeholder="Τίτλος πρότασης…"
        />
        <button
          type="button"
          onClick={create}
          disabled={saving || !title.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shrink-0"
          style={{ background: "linear-gradient(135deg, #0078D4 0%, #106EBE 100%)" }}
        >
          {saving
            ? <><Loader2 className="size-3.5 animate-spin" /> Σύνταξη…</>
            : <><Sparkles className="size-3.5" strokeWidth={1.5} /> Δημιουργία Πρότασης</>}
        </button>
      </div>
      {saving && (
        <p className="text-[11px] leading-relaxed" style={{ color: "#6B7280" }}>
          Συντάσσεται ολοκληρωμένη πρόταση με ενιαίο πλάνο εκτέλεσης και οικονομική εκτίμηση. Η διαδικασία διαρκεί 1-3 λεπτά.
        </p>
      )}
    </div>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface AiAnalysisDialogProps {
  surveyId: number
  surveyName: string
  customerName: string
  sections: string[]
  onClose: () => void
  onProposalCreated?: () => void
}

export function AiAnalysisDialog({ surveyId, surveyName, customerName, sections, onClose, onProposalCreated }: AiAnalysisDialogProps) {
  const [activeSections, setActiveSections] = useState<string[]>(sections)
  const [states,   setStates]   = useState<Record<string, SectionState>>(() => Object.fromEntries(sections.map(k => [k, "idle" as SectionState])))
  const [results,  setResults]  = useState<Record<string, SectionAnalysis>>({})
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.map(k => [k, true])))
  const [proposalItems, setProposalItems] = useState<Record<string, ProposalItem[]>>({})
  const [sectionIdeas, setSectionIdeas] = useState<Record<string, string[]>>({})
  const [requirementsBySection,       setRequirementsBySection]       = useState<Record<string, SectionRequirement[]>>({})
  const [companySuggestionsBySection, setCompanySuggestionsBySection] = useState<Record<string, SectionRequirement[]>>({})
  // Company suggestions keyed by section KEY (e.g. "hardware_network") for the panel
  const [companySuggestions, setCompanySuggestions] = useState<Record<string, CompanySuggestionRow[]>>({})
  const [saving,   setSaving]  = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [showProposal, setShowProposal] = useState(false)

  // Load existing company suggestions when dialog opens
  useEffect(() => {
    async function loadCompanySuggestions() {
      try {
        const res = await fetch(`/api/site-surveys/${surveyId}/requirements?source=COMPANY`)
        if (!res.ok) return
        const rows: CompanySuggestionRow[] = await res.json()
        const grouped: Record<string, CompanySuggestionRow[]> = {}
        for (const row of rows) {
          const key = ENUM_TO_KEY[row.section] ?? row.section
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(row)
        }
        setCompanySuggestions(grouped)
        // Also build the enum-keyed map for proposal generation
        const enumGrouped: Record<string, SectionRequirement[]> = {}
        for (const row of rows) {
          if (!enumGrouped[row.section]) enumGrouped[row.section] = []
          enumGrouped[row.section].push({ id: row.id, title: row.title, description: row.description })
        }
        setCompanySuggestionsBySection(enumGrouped)
      } catch { /* silently ignore */ }
    }
    loadCompanySuggestions()
  }, [surveyId])

  function addCompanySuggestion(sectionKey: string, row: CompanySuggestionRow) {
    setCompanySuggestions(prev => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] ?? []), row],
    }))
    const enumKey = SECTION_ENUM_MAP[sectionKey]
    if (enumKey) {
      setCompanySuggestionsBySection(prev => ({
        ...prev,
        [enumKey]: [...(prev[enumKey] ?? []), { id: row.id, title: row.title, description: row.description }],
      }))
    }
  }

  function deleteCompanySuggestion(sectionKey: string, id: number) {
    setCompanySuggestions(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] ?? []).filter(r => r.id !== id),
    }))
    const enumKey = SECTION_ENUM_MAP[sectionKey]
    if (enumKey) {
      setCompanySuggestionsBySection(prev => ({
        ...prev,
        [enumKey]: (prev[enumKey] ?? []).filter(r => r.id !== id),
      }))
    }
  }

  const generate = useCallback(async (sectionKey: string) => {
    setStates(s => ({ ...s, [sectionKey]: "loading" }))
    setErrors(e => ({ ...e, [sectionKey]: "" }))
    setSavedUrl(null)
    try {
      const res = await fetch(`/api/site-surveys/${surveyId}/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: sectionKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors(e => ({ ...e, [sectionKey]: data.error ?? "Άγνωστο σφάλμα" }))
        setStates(s => ({ ...s, [sectionKey]: "error" }))
        return
      }
      const analysis: SectionAnalysis = data.analyses?.[0]
      if (!analysis) {
        setErrors(e => ({ ...e, [sectionKey]: "Δεν επιστράφηκαν αποτελέσματα" }))
        setStates(s => ({ ...s, [sectionKey]: "error" }))
        return
      }
      setResults(r => ({ ...r, [sectionKey]: analysis }))
      // Parse proposals into selectable items
      const items: ProposalItem[] = parseItems(analysis.proposals).map((text, i) => ({
        id: `${sectionKey}-${i}-${Date.now()}`,
        text,
        included: true,
        custom: false,
      }))
      setProposalItems(p => ({ ...p, [sectionKey]: items }))
      setSectionIdeas(prev => ({
        ...prev,
        [sectionKey]: parseItems(data.analyses[0]?.ideas ?? ""),
      }))
      setStates(s => ({ ...s, [sectionKey]: "done" }))
      if (data.requirementsBySection) {
        setRequirementsBySection(prev => ({ ...prev, ...data.requirementsBySection }))
      }
      if (data.companySuggestionsBySection) {
        setCompanySuggestionsBySection(prev => ({ ...prev, ...data.companySuggestionsBySection }))
      }
    } catch (e) {
      setErrors(err => ({ ...err, [sectionKey]: String(e) }))
      setStates(s => ({ ...s, [sectionKey]: "error" }))
    }
  }, [surveyId])

  async function generateAll() {
    for (const key of activeSections) {
      if (states[key] !== "loading") await generate(key)
    }
  }

  function updateField(key: string, field: keyof SectionAnalysis, value: string) {
    setResults(r => ({ ...r, [key]: { ...r[key], [field]: value } }))
  }
  function toggleInclude(key: string) { setIncluded(i => ({ ...i, [key]: !i[key] })) }
  function toggleItem(key: string, id: string) {
    setProposalItems(p => ({ ...p, [key]: p[key].map(i => i.id === id ? { ...i, included: !i.included } : i) }))
  }
  function editItem(key: string, id: string, text: string) {
    setProposalItems(p => ({ ...p, [key]: p[key].map(i => i.id === id ? { ...i, text } : i) }))
  }
  function addItem(key: string, text: string) {
    setProposalItems(p => ({
      ...p,
      [key]: [...(p[key] ?? []), { id: `${key}-custom-${Date.now()}`, text, included: true, custom: true }],
    }))
  }
  function removeItem(key: string, id: string) {
    setProposalItems(p => ({ ...p, [key]: p[key].filter(i => i.id !== id) }))
  }

  function deleteIdea(sectionKey: string, idx: number) {
    setSectionIdeas(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] ?? []).filter((_, i) => i !== idx),
    }))
  }

  function removeSection(key: string) {
    setActiveSections(prev => prev.filter(k => k !== key))
    setStates(prev => { const n = { ...prev }; delete n[key]; return n })
    setResults(prev => { const n = { ...prev }; delete n[key]; return n })
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    setIncluded(prev => { const n = { ...prev }; delete n[key]; return n })
    setProposalItems(prev => { const n = { ...prev }; delete n[key]; return n })
    setSectionIdeas(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  async function saveDocx() {
    const includedKeys = activeSections.filter(k => states[k] === "done" && included[k])
    if (!includedKeys.length) return
    setSaving(true)
    try {
      // Merge selected proposal items into results before exporting
      const effectiveResults = includedKeys.map(k => ({
        ...results[k],
        proposals: itemsToText(proposalItems[k] ?? []),
      }))
      const payload = {
        customerName, surveyName,
        generatedAt: new Date().toISOString(),
        analyses: effectiveResults,
      }
      const res  = await fetch(`/api/site-surveys/${surveyId}/ai-analysis/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const text = await res.text()
      let data: { cdnUrl?: string; error?: string }
      try { data = JSON.parse(text) } catch { data = { error: text || "Κενή απόκριση" } }
      if (!res.ok) { alert(data.error ?? "Σφάλμα αποθήκευσης"); return }
      setSavedUrl(data.cdnUrl ?? null)
      if (data.cdnUrl) window.open(data.cdnUrl, "_blank", "noopener")
    } finally {
      setSaving(false)
    }
  }

  const doneCount    = activeSections.filter(k => states[k] === "done").length
  const includedDone = activeSections.filter(k => states[k] === "done" && included[k])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "#ffffff", boxShadow: "0 32px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ background: "linear-gradient(135deg, #001F40 0%, #0078D4 100%)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div className="size-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <Sparkles className="size-4 text-white" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white leading-none">Ανάλυση AI</p>
            <p className="text-[12px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
              {customerName} — {surveyName}
            </p>
          </div>
          <button type="button" onClick={generateAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)" }}>
            <PlayCircle className="size-3.5" strokeWidth={1.5} /> Όλες οι ενότητες
          </button>
          <button type="button" onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 ml-1"
            style={{ color: "rgba(255,255,255,0.6)" }}>
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ background: "#F3F2F1" }}>
          <CompanySuggestionsPanel
            surveyId={surveyId}
            sections={activeSections}
            suggestions={companySuggestions}
            onAdd={addCompanySuggestion}
            onDelete={deleteCompanySuggestion}
          />
          {savedUrl && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px]"
              style={{ background: "rgba(16,124,16,0.08)", border: "1px solid rgba(16,124,16,0.20)", color: "#0D6D12" }}>
              <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.5} />
              <span>Αποθηκεύτηκε στα αρχεία.{" "}
                <a href={savedUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold">Άνοιγμα</a>
              </span>
            </div>
          )}
          {activeSections.map(key => (
            <SectionCard
              key={key}
              sectionKey={key}
              state={states[key] ?? "idle"}
              analysis={results[key] ?? null}
              error={errors[key] ?? ""}
              included={included[key] ?? true}
              proposalItems={proposalItems[key] ?? []}
              ideas={sectionIdeas[key] ?? []}
              onGenerate={generate}
              onToggleInclude={toggleInclude}
              onUpdateField={updateField}
              onToggleItem={toggleItem}
              onEditItem={editItem}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onDeleteIdea={deleteIdea}
              onRemoveSection={removeSection}
            />
          ))}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        {doneCount > 0 && (
          <div className="shrink-0 px-5 py-4 space-y-3" style={{ background: "#ffffff", borderTop: "1px solid #E1DFDD" }}>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: "#9CA3AF" }}>
                {doneCount}/{activeSections.length} ενότητες αναλύθηκαν
                {includedDone.length < doneCount && ` · ${includedDone.length} συμπεριλαμβάνονται`}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowProposal(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                  style={showProposal
                    ? { background: "rgba(0,120,212,0.10)", color: "#0078D4" }
                    : { background: "#F3F2F1", color: "#3B3A39", border: "1px solid #E1DFDD" }}>
                  <FileText className="size-3.5" strokeWidth={1.5} /> Πρόταση
                </button>
                <button type="button" onClick={saveDocx}
                  disabled={saving || includedDone.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #0078D4 0%, #106EBE 100%)" }}>
                  {saving ? <><Loader2 className="size-3.5 animate-spin" /> Αποθήκευση…</> : <><Download className="size-3.5" strokeWidth={1.5} /> Word</>}
                </button>
              </div>
            </div>

            {showProposal && (
              <div className="rounded-xl p-4" style={{ background: "rgba(0,120,212,0.05)", border: "1px solid rgba(0,120,212,0.18)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] mb-3" style={{ color: "#0078D4" }}>
                  Δημιουργία Πρότασης από AI Ανάλυση
                </p>
                {includedDone.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "#9CA3AF" }}>Αναλύστε τουλάχιστον μία ενότητα πρώτα.</p>
                ) : (
                  <ProposalPanel
                    surveyId={surveyId}
                    customerName={customerName}
                    surveyName={surveyName}
                    includedSections={includedDone}
                    results={results}
                    proposalItems={proposalItems}
                    requirementsBySection={requirementsBySection}
                    companySuggestionsBySection={companySuggestionsBySection}
                    onSuccess={() => { onProposalCreated?.(); setShowProposal(false) }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
