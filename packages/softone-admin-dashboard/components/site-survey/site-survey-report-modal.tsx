"use client"

import React, { useState, useEffect, useTransition } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, Download, Loader2, Building2, User, Calendar, Tag,
  Cpu, ClipboardList, Globe, ShieldCheck, Bot, CheckCircle2,
  Circle, FileDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurveyOption { id: number | string; label: string }

interface ResolvedQuestion {
  id: number
  key: string
  label: string
  type: string
  section: string
  order: number
  options: SurveyOption[]
}

interface SurveyInfo {
  id: number
  name: string
  description: string | null
  date: string
  status: string
  customer: { id: number; name: string | null }
  surveyor: { id: string; name: string | null; email: string }
  sections: string[]
  branchIds: number[]
}

interface Props {
  open: boolean
  onClose: () => void
  survey: SurveyInfo
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  hardware_network: "Hardware & Network",
  software:         "Software",
  web_ecommerce:    "Web & E-commerce",
  compliance:       "Compliance",
  iot_ai:           "IoT & AI",
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  hardware_network: <Cpu          className="size-4" />,
  software:         <ClipboardList className="size-4" />,
  web_ecommerce:    <Globe        className="size-4" />,
  compliance:       <ShieldCheck  className="size-4" />,
  iot_ai:           <Bot          className="size-4" />,
}

const SECTION_COLORS: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  hardware_network: { bg: "bg-sky-950/40",    border: "border-sky-800/40",    icon: "text-sky-300",    badge: "bg-sky-950/70 text-sky-300 border-sky-800/50" },
  software:         { bg: "bg-violet-950/40", border: "border-violet-800/40", icon: "text-violet-300", badge: "bg-violet-950/70 text-violet-300 border-violet-800/50" },
  web_ecommerce:    { bg: "bg-blue-950/40",   border: "border-blue-800/40",   icon: "text-blue-300",   badge: "bg-blue-950/70 text-blue-300 border-blue-800/50" },
  compliance:       { bg: "bg-rose-950/40",   border: "border-rose-800/40",   icon: "text-rose-300",   badge: "bg-rose-950/70 text-rose-300 border-rose-800/50" },
  iot_ai:           { bg: "bg-teal-950/40",   border: "border-teal-800/40",   icon: "text-teal-300",   badge: "bg-teal-950/70 text-teal-300 border-teal-800/50" },
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT:       "bg-zinc-500/12 text-zinc-400 border-zinc-500/25",
  SCHEDULED:   "bg-sky-500/12 text-sky-400 border-sky-500/25",
  IN_PROGRESS: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  COMPLETED:   "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  CANCELLED:   "bg-rose-500/12 text-rose-400 border-rose-500/25",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", SCHEDULED: "Scheduled", IN_PROGRESS: "In Progress",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface DeviceEntry { brand: string; model: string; serial: string; location: string; ip: string }

function parseDevices(value: string | null | undefined): DeviceEntry[] {
  if (!value || value === "[]") return []
  try {
    const arr = JSON.parse(value)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function formatAnswer(
  answerValue: string | null | undefined,
  type: string,
  options: SurveyOption[],
): { text: string; answered: boolean } {
  if (type === "DEVICE_LIST") {
    const devices = parseDevices(answerValue)
    if (devices.length === 0) return { text: "No devices recorded", answered: false }
    return {
      text: devices.map((d, i) =>
        `#${i + 1}: ${[d.brand, d.model].filter(Boolean).join(" — ")}` +
        (d.serial ? ` | S/N: ${d.serial}` : "") +
        (d.location ? ` | ${d.location}` : "") +
        (d.ip ? ` | IP: ${d.ip}` : "")
      ).join("\n"),
      answered: true,
    }
  }

  if (answerValue === null || answerValue === undefined || answerValue === "" || answerValue === "[]") {
    return { text: "No answer", answered: false }
  }

  if (type === "BOOLEAN") {
    const text = answerValue === "true" ? "Yes" : answerValue === "false" ? "No" : answerValue
    return { text, answered: true }
  }

  if (type === "DROPDOWN") {
    const match = options.find(o => String(o.id) === String(answerValue))
    return { text: match?.label ?? answerValue, answered: true }
  }

  if (type === "MULTI_SELECT") {
    try {
      const ids: (string | number)[] = JSON.parse(answerValue)
      if (!Array.isArray(ids) || ids.length === 0) return { text: "No answer", answered: false }
      const labels = ids.map(id => options.find(o => String(o.id) === String(id))?.label ?? String(id))
      return { text: labels.join(", "), answered: true }
    } catch {
      return { text: answerValue, answered: true }
    }
  }

  return { text: answerValue, answered: true }
}

function ReportDeviceField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className={cn("text-[12px]", mono && "font-mono")} style={{ color: value === "—" ? "var(--muted-foreground)" : "var(--foreground)" }}>
        {value}
      </p>
    </div>
  )
}

// ─── Section Block ────────────────────────────────────────────────────────────

function SectionBlock({
  sectionKey,
  questions,
  answers,
}: {
  sectionKey: string
  questions: ResolvedQuestion[]
  answers: Record<string, string | null>
}) {
  const colors  = SECTION_COLORS[sectionKey] ?? SECTION_COLORS.software
  const label   = SECTION_LABELS[sectionKey] ?? sectionKey
  const icon    = SECTION_ICONS[sectionKey]

  const answered = questions.filter(q => {
    const v = answers[q.key]
    if (q.type === "DEVICE_LIST") return parseDevices(v).length > 0
    return v !== null && v !== undefined && v !== "" && v !== "[]"
  }).length

  return (
    <div className={cn("rounded-2xl border overflow-hidden", colors.border)}>
      {/* Section header */}
      <div className={cn("flex items-center gap-3 px-5 py-3.5", colors.bg)}>
        <div className={cn("size-7 rounded-lg flex items-center justify-center", colors.badge, "border")}>
          {icon}
        </div>
        <p className="text-[14px] font-bold flex-1" style={{ color: "var(--foreground)" }}>{label}</p>
        <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border tabular-nums",
          answered === questions.length && questions.length > 0
            ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/50"
            : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60"
        )}>
          {answered}/{questions.length} answered
        </span>
      </div>

      {/* Questions */}
      <div className="divide-y divide-[var(--border)]">
        {questions.map((q, idx) => {
          const rawVal = answers[q.key]

          if (q.type === "DEVICE_LIST") {
            const devices = parseDevices(rawVal)
            return (
              <div key={q.id} className="px-5 py-4 hover:bg-[var(--muted)]/20 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn(
                    "size-6 rounded-full flex items-center justify-center text-[10px] font-black tabular-nums border shrink-0",
                    devices.length > 0
                      ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/50"
                      : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60",
                  )}>
                    {devices.length > 0 ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : idx + 1}
                  </span>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{q.label}</p>
                  {devices.length > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">
                      {devices.length} device{devices.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {devices.length === 0 ? (
                  <p className="ml-9 text-[12px] italic" style={{ color: "var(--muted-foreground)" }}>No devices recorded</p>
                ) : (
                  <div className="ml-9 space-y-1.5">
                    {devices.map((d, di) => (
                      <div key={di} className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                        <ReportDeviceField label="Brand / Model" value={[d.brand, d.model].filter(Boolean).join(" — ") || "—"} />
                        <ReportDeviceField label="Serial #"      value={d.serial   || "—"} mono />
                        <ReportDeviceField label="Location"      value={d.location || "—"} />
                        {(d.ip) && <ReportDeviceField label="IP Address" value={d.ip} mono />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          const { text, answered: isAnswered } = formatAnswer(rawVal, q.type, q.options)
          return (
            <div key={q.id} className="flex gap-4 px-5 py-4 hover:bg-[var(--muted)]/20 transition-colors">
              <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                <span className={cn(
                  "size-6 rounded-full flex items-center justify-center text-[10px] font-black tabular-nums border",
                  isAnswered
                    ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/50"
                    : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60",
                )}>
                  {isAnswered ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : idx + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold leading-snug mb-2" style={{ color: "var(--foreground)" }}>
                  {q.label}
                </p>
                <div className={cn(
                  "rounded-lg px-3 py-2 text-[13px] border whitespace-pre-wrap",
                  isAnswered
                    ? "bg-[var(--muted)]/30 border-[var(--border)] text-[var(--foreground)]"
                    : "bg-[var(--muted)]/10 border-dashed border-[var(--border)] text-[var(--muted-foreground)] italic",
                )}>
                  {text}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function SiteSurveyReportModal({ open, onClose, survey }: Props) {
  const [questions, setQuestions] = useState<ResolvedQuestion[]>([])
  const [answers,   setAnswers]   = useState<Record<string, string | null>>({})
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [exporting, startExport]  = useTransition()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/site-surveys/questions`).then(r => r.json()),
      fetch(`/api/site-surveys/${survey.id}/results`).then(r => r.json()),
    ])
      .then(([questionsData, resultsData]) => {
        setQuestions(questionsData as ResolvedQuestion[])
        setAnswers((resultsData as { byKey: Record<string, string | null> }).byKey)
      })
      .catch(() => setError("Failed to load survey data."))
      .finally(() => setLoading(false))
  }, [open, survey.id])

  function handleExport() {
    startExport(async () => {
      const res = await fetch(`/api/site-surveys/${survey.id}/export`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1]
        ?? `survey-${survey.id}.docx`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  // Group questions by section (only sections included in this survey)
  const questionsBySection: Record<string, ResolvedQuestion[]> = {}
  for (const sectionKey of survey.sections) {
    const sectionEnum = {
      hardware_network: "HARDWARE_NETWORK",
      software:         "SOFTWARE",
      web_ecommerce:    "WEB_ECOMMERCE",
      compliance:       "COMPLIANCE",
      iot_ai:           "IOT_AI",
    }[sectionKey]
    questionsBySection[sectionKey] = questions.filter(q => q.section === sectionEnum)
  }

  const totalQuestions = Object.values(questionsBySection).reduce((sum, qs) => sum + qs.length, 0)
  const totalAnswered  = Object.entries(questionsBySection).reduce((sum, [, qs]) => {
    return sum + qs.filter(q => {
      const v = answers[q.key]
      if (q.type === "DEVICE_LIST") return parseDevices(v).length > 0
      return v !== null && v !== undefined && v !== "" && v !== "[]"
    }).length
  }, 0)
  const progress = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

            {/* ── Header ── */}
            <div className="flex items-start gap-4 px-6 py-5 border-b border-[var(--border)] bg-gradient-to-r from-indigo-500/[4%] to-transparent shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                    STATUS_STYLES[survey.status] ?? STATUS_STYLES.DRAFT
                  )}>
                    {STATUS_LABELS[survey.status] ?? survey.status}
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    {new Date(survey.date).toLocaleDateString("el-GR")}
                  </span>
                </div>
                <Dialog.Title className="text-[18px] font-bold leading-tight truncate" style={{ color: "var(--foreground)" }}>
                  {survey.name}
                </Dialog.Title>
                {survey.description && (
                  <p className="text-[12px] mt-1 leading-relaxed line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                    {survey.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleExport}
                  disabled={loading || exporting}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-60 disabled:pointer-events-none shadow-sm"
                >
                  {exporting
                    ? <><Loader2 className="size-3.5 animate-spin" /> Exporting…</>
                    : <><FileDown className="size-3.5" /> Export to Word</>
                  }
                </button>
                <Dialog.Close asChild>
                  <button className="size-8 rounded-xl flex items-center justify-center border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] transition-colors" style={{ color: "var(--muted-foreground)" }}>
                    <X className="size-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* ── Meta strip ── */}
            <div className="flex items-center gap-6 px-6 py-3 border-b border-[var(--border)] bg-[var(--muted)]/10 text-[12px] shrink-0 flex-wrap">
              <span className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                <Building2 className="size-3.5 shrink-0 text-indigo-400" />
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {survey.customer.name ?? `#${survey.customer.id}`}
                </span>
              </span>
              <span className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                <User className="size-3.5 shrink-0 text-indigo-400" />
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {survey.surveyor.name ?? survey.surveyor.email}
                </span>
              </span>
              <span className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                <Tag className="size-3.5 shrink-0 text-indigo-400" />
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {survey.sections.length} section{survey.sections.length !== 1 ? "s" : ""}
                </span>
              </span>
              {!loading && totalQuestions > 0 && (
                <span className="flex items-center gap-2 ml-auto" style={{ color: "var(--muted-foreground)" }}>
                  <div className="w-24 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        background: progress === 100
                          ? "linear-gradient(to right, #10b981, #34d399)"
                          : "linear-gradient(to right, #6366f1, #818cf8)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums font-semibold">
                    {totalAnswered}/{totalQuestions}
                  </span>
                </span>
              )}
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading && (
                <div className="flex items-center justify-center gap-3 py-16 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  <Loader2 className="size-5 animate-spin text-indigo-400" />
                  Loading survey data…
                </div>
              )}

              {!loading && error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-[13px] text-rose-400">
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="space-y-5">
                  {survey.sections.map(sectionKey => {
                    const qs = questionsBySection[sectionKey] ?? []
                    return (
                      <SectionBlock
                        key={sectionKey}
                        sectionKey={sectionKey}
                        questions={qs}
                        answers={answers}
                      />
                    )
                  })}

                  {survey.sections.length === 0 && (
                    <p className="text-center py-12 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                      No sections configured for this survey.
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
