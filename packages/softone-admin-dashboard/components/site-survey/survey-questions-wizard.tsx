"use client"

import React, { useEffect, useState, useTransition } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Loader2, Save, CheckSquare, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn } from "@/components/ui/btn"

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "TEXT" | "BOOLEAN" | "NUMBER" | "DROPDOWN" | "MULTI_SELECT"

interface Question {
  id: number
  key: string
  label: string
  type: QuestionType
  options: { id: number | string; label: string }[]
  order: number
}

interface Props {
  open: boolean
  onClose: () => void
  surveyId: number
  surveyName: string
  sectionKey: string   // lowercase UI key: hardware_network, software, etc.
  sectionLabel: string
}

// ─── Input components ─────────────────────────────────────────────────────────

function TextAnswer({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={2}
      className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      style={{ color: "var(--foreground)" }}
    />
  )
}

function NumberAnswer({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-32 rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      style={{ color: "var(--foreground)" }}
    />
  )
}

function BooleanAnswer({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-2">
      {(["Yes", "No"] as const).map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === "Yes" ? "true" : "false")}
          className={cn(
            "px-4 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors",
            (opt === "Yes" ? value === "true" : value === "false")
              ? "bg-indigo-500 border-indigo-500 text-white"
              : "border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]",
          )}
        >
          {opt}
        </button>
      ))}
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="px-3 py-1.5 rounded-xl border border-dashed border-[var(--border)] text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function DropdownAnswer({
  value,
  options,
  onChange,
}: {
  value: string
  options: { id: number | string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] min-w-48"
      style={{ color: value ? "var(--foreground)" : "var(--muted-foreground)" }}
    >
      <option value="">— Select —</option>
      {options.map(o => (
        <option key={String(o.id)} value={String(o.id)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function MultiSelectAnswer({
  value,
  options,
  onChange,
}: {
  value: string   // JSON array string: "[1,4,7]"
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
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const id    = String(o.id)
        const isOn  = selected.includes(id)
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors",
              isOn
                ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
            )}
          >
            {isOn ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5 opacity-40" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function SurveyQuestionsWizard({
  open,
  onClose,
  surveyId,
  surveyName,
  sectionKey,
  sectionLabel,
}: Props) {
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [answers,    setAnswers]    = useState<Record<string, string>>({})
  const [loading,    setLoading]    = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [isPending,  startSave]     = useTransition()

  // Map lowercase UI key → DB enum value  (hardware_network → HARDWARE_NETWORK)
  const dbSection = sectionKey.toUpperCase()

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

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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

            {!loading && questions.map((q, idx) => (
              <div key={q.id} className="space-y-2">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400/70">
                    Q{idx + 1}
                  </span>
                  <p className="text-[13px] font-semibold mt-0.5" style={{ color: "var(--foreground)" }}>
                    {q.label}
                  </p>
                </label>

                {q.type === "TEXT" && (
                  <TextAnswer value={answers[q.key] ?? ""} onChange={v => setAnswer(q.key, v)} />
                )}
                {q.type === "NUMBER" && (
                  <NumberAnswer value={answers[q.key] ?? ""} onChange={v => setAnswer(q.key, v)} />
                )}
                {q.type === "BOOLEAN" && (
                  <BooleanAnswer value={answers[q.key] ?? ""} onChange={v => setAnswer(q.key, v)} />
                )}
                {q.type === "DROPDOWN" && (
                  <DropdownAnswer
                    value={answers[q.key] ?? ""}
                    options={q.options}
                    onChange={v => setAnswer(q.key, v)}
                  />
                )}
                {q.type === "MULTI_SELECT" && (
                  <MultiSelectAnswer
                    value={answers[q.key] ?? ""}
                    options={q.options}
                    onChange={v => setAnswer(q.key, v)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          {!loading && questions.length > 0 && (
            <div className="px-6 py-4 border-t border-[var(--border)] shrink-0 flex items-center justify-between gap-3">
              <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-3">
                {saved && !isPending && (
                  <p className="text-[12px] text-emerald-400 font-semibold">Saved</p>
                )}
                <Btn size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save answers
                </Btn>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
