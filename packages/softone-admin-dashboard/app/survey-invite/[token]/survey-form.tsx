"use client"

import React, { useState } from "react"
import { Check, Loader2, CheckSquare, Square, ChevronDown, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "TEXT" | "BOOLEAN" | "NUMBER" | "DROPDOWN" | "MULTI_SELECT" | "DEVICE_LIST"

interface Question {
  id: number
  key: string
  label: string
  type: QuestionType
  options: { id: string | number; label: string }[]
}

interface Props {
  token: string
  surveyName: string
  customerName: string | null
  sectionLabel: string
  questions: Question[]
  existingAnswers: Record<string, string | null>
}

// ─── Input sub-components ────────────────────────────────────────────────────

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={3}
      placeholder="Type your answer here…"
      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/40 transition-all"
    />
  )
}

function NumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="0"
      className="w-40 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/40 transition-all"
    />
  )
}

function BooleanInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {(["Yes", "No"] as const).map(opt => {
        const isActive = opt === "Yes" ? value === "true" : value === "false"
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === "Yes" ? "true" : "false")}
            className={cn(
              "px-8 py-2.5 rounded-xl border text-[14px] font-semibold transition-all",
              isActive
                ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/40"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
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
          className="px-4 py-2.5 rounded-xl border border-dashed border-white/10 text-[13px] text-white/30 hover:text-white/50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function DropdownInput({
  value, options, onChange,
}: {
  value: string
  options: { id: string | number; label: string }[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => String(o.id) === value)

  return (
    <div className="relative w-full max-w-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-[14px] text-left transition-all",
          open
            ? "border-red-500/40 bg-white/8 ring-2 ring-red-500/20"
            : "border-white/10 bg-white/5 hover:bg-white/8",
        )}
      >
        <span className={selected ? "text-white" : "text-white/30"}>
          {selected ? selected.label : "Select an option…"}
        </span>
        <ChevronDown className={cn("size-4 text-white/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: "#1a1d27" }}>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-[13px] text-white/30 hover:bg-white/5 transition-colors"
            >
              — None —
            </button>
            {options.map(o => (
              <button
                key={String(o.id)}
                type="button"
                onClick={() => { onChange(String(o.id)); setOpen(false) }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-[14px] transition-colors flex items-center justify-between",
                  String(o.id) === value
                    ? "bg-red-600/20 text-red-300"
                    : "text-white/80 hover:bg-white/5",
                )}
              >
                {o.label}
                {String(o.id) === value && <Check className="size-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MultiSelectInput({
  value, options, onChange,
}: {
  value: string
  options: { id: string | number; label: string }[]
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
        const id   = String(o.id)
        const isOn = selected.includes(id)
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all",
              isOn
                ? "bg-red-600/20 border-red-500/40 text-red-300 shadow-sm"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            {isOn
              ? <CheckSquare className="size-3.5 shrink-0 text-red-400" />
              : <Square className="size-3.5 shrink-0 opacity-30" />
            }
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// DEVICE_LIST is complex (requires brand lookup API) — render as plain textarea for the public form
function DeviceListInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  let display = ""
  try {
    const arr = JSON.parse(value || "[]")
    if (Array.isArray(arr) && arr.length > 0) {
      display = arr
        .map((d: { brand?: string; model?: string; serial?: string; location?: string }) =>
          [d.brand, d.model, d.serial, d.location].filter(Boolean).join(" | "),
        )
        .join("\n")
    }
  } catch {
    display = value
  }

  return (
    <textarea
      value={display}
      onChange={e => onChange(e.target.value)}
      rows={4}
      placeholder={"List your devices, one per line\ne.g. Cisco — ASR1000 | SN123456 | Server Room"}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/40 transition-all font-mono text-[13px]"
    />
  )
}

// ─── Main form component ──────────────────────────────────────────────────────

export function SurveyForm({ token, surveyName, customerName, sectionLabel, questions, existingAnswers }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const q of questions) {
      initial[q.key] = existingAnswers[q.key] ?? ""
    }
    return initial
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const answeredCount = questions.filter(q => {
    const v = answers[q.key] ?? ""
    return v !== "" && v !== "[]"
  }).length
  const pct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

  function setAnswer(key: string, val: string) {
    setAnswers(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/survey-invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Submission failed (${res.status})`)
        return
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="size-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mb-6">
          <Check className="size-10 text-emerald-400" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Thank you!</h2>
        <p className="text-white/60 text-[15px] max-w-sm leading-relaxed">
          Your answers for the <strong className="text-white">{sectionLabel}</strong> questionnaire
          have been submitted. Our team will be in touch shortly.
        </p>
        <p className="mt-6 text-white/30 text-[13px]">You can now close this page.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">

      {/* Progress bar */}
      {questions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">Progress</span>
            <span className={cn(
              "text-[12px] font-bold tabular-nums transition-colors",
              pct === 100 ? "text-emerald-400" : "text-white/50",
            )}>
              {answeredCount}/{questions.length} answered
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100
                  ? "linear-gradient(90deg,#059669,#34d399)"
                  : "linear-gradient(90deg,#b8020b,#ef4444)",
              }}
            />
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const val        = answers[q.key] ?? ""
          const isAnswered = val !== "" && val !== "[]"

          return (
            <div
              key={q.id}
              className={cn(
                "rounded-2xl border p-6 transition-all duration-200",
                isAnswered
                  ? "border-emerald-500/20 bg-emerald-500/[3%]"
                  : "border-white/8 bg-white/[2%]",
              )}
            >
              {/* Label row */}
              <div className="flex items-start gap-4 mb-4">
                <div className={cn(
                  "shrink-0 size-6 rounded-full flex items-center justify-center mt-0.5 transition-all",
                  isAnswered
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/8 text-white/40",
                )}>
                  {isAnswered
                    ? <Check className="size-3" strokeWidth={3} />
                    : <span className="text-[10px] font-black leading-none">{idx + 1}</span>
                  }
                </div>
                <p className="text-[15px] font-semibold text-white leading-snug">{q.label}</p>
              </div>

              {/* Input */}
              <div className="ml-10">
                {q.type === "TEXT" && (
                  <TextInput value={val} onChange={v => setAnswer(q.key, v)} />
                )}
                {q.type === "NUMBER" && (
                  <NumberInput value={val} onChange={v => setAnswer(q.key, v)} />
                )}
                {q.type === "BOOLEAN" && (
                  <BooleanInput value={val} onChange={v => setAnswer(q.key, v)} />
                )}
                {q.type === "DROPDOWN" && (
                  <DropdownInput
                    value={val}
                    options={q.options}
                    onChange={v => setAnswer(q.key, v)}
                  />
                )}
                {q.type === "MULTI_SELECT" && (
                  <MultiSelectInput
                    value={val}
                    options={q.options}
                    onChange={v => setAnswer(q.key, v)}
                  />
                )}
                {q.type === "DEVICE_LIST" && (
                  <DeviceListInput value={val} onChange={v => setAnswer(q.key, v)} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3">
          <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[13px] text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="mt-8 pt-6 border-t border-white/8">
        <button
          type="submit"
          disabled={submitting || answeredCount === 0}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-[15px] font-bold transition-all",
            submitting || answeredCount === 0
              ? "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/40 active:scale-[0.99]",
          )}
        >
          {submitting
            ? <><Loader2 className="size-4 animate-spin" /> Submitting…</>
            : <><Check className="size-4" /> Submit questionnaire</>
          }
        </button>
        {answeredCount === 0 && (
          <p className="text-center text-[12px] text-white/25 mt-2">Answer at least one question to submit</p>
        )}
      </div>
    </form>
  )
}
