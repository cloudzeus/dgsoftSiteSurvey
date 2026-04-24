"use client"

import React, { useState, useCallback, useTransition, useRef } from "react"
import { useTranslations } from "next-intl"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
  ClipboardList, MoreHorizontal, Pencil, Trash2, Loader2, Plus, Search,
  Building2, Cpu, Globe, ShieldCheck, Bot, ChevronRight,
  ChevronUp, ChevronDown, ChevronsUpDown, Columns3, Check,
  ChevronsLeft, ChevronLeft, ChevronRight as ChevronRightIcon, ChevronsRight,
  User, Calendar, Tag, Paperclip, FileText, FileImage, File as FileIcon, Download,
  PlayCircle, FileBarChart2, ListChecks, X, Sparkles, Send, Mail,
  Lock, Clock, UserCheck, History, CheckCircle2,
} from "lucide-react"
import { FileUploadDialog, type SectionOption } from "@/components/shared/file-upload-dialog"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { useTablePrefs, PAGE_SIZES, type ColDef } from "@/hooks/use-table-prefs"
import { deleteSiteSurvey, getCustomerBranches, getSurveySectionImpact, removeSurveySection } from "@/app/actions/site-survey"
import { SiteSurveyDialog, type SurveyUser, type SurveyCustomer, type SurveyCustomerOption, type SurveyBranch, type SiteSurveyRow } from "./site-survey-dialog"
import { SurveyQuestionsWizard } from "./survey-questions-wizard"
import { SiteSurveyReportModal } from "./site-survey-report-modal"
import { SurveyProposalModal } from "./survey-proposal-modal"
import { SurveySendMailDialog } from "./survey-send-mail-dialog"
import { SurveyInviteDialog } from "./survey-invite-dialog"
import { AiAnalysisDialog } from "./ai-analysis-dialog"
import type { SurveySection, SurveyStatus } from "@/app/actions/site-survey"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SurveyTableRow {
  id: number
  name: string
  description: string | null
  date: string
  customerId: number
  surveyorId: string
  branchIds: number[]
  sections: string[]
  status: string
  createdAt: string
  updatedAt: string
  customer: { id: number; name: string | null }
  surveyor: { id: string; name: string | null; email: string }
  invitations: { sectionKey: string; email: string; completedAt: string }[]
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: "name", label: "Survey", sortable: true, defaultVisible: true, alwaysVisible: true },
  { key: "customer", label: "Customer", sortable: false, defaultVisible: true, alwaysVisible: false },
  { key: "date", label: "Date", sortable: true, defaultVisible: true, alwaysVisible: false },
  { key: "surveyor", label: "Surveyor", sortable: false, defaultVisible: true, alwaysVisible: false },
  { key: "sections", label: "Sections", sortable: false, defaultVisible: true, alwaysVisible: false },
  { key: "status", label: "Status", sortable: true, defaultVisible: true, alwaysVisible: false },
  { key: "createdAt", label: "Created", sortable: true, defaultVisible: false, alwaysVisible: false },
]

// Column keys used for translation lookups — labels above are fallbacks only
const COLUMN_I18N_KEYS: Record<string, string> = {
  name: "name",
  customer: "customer",
  date: "date",
  surveyor: "surveyor",
  sections: "sections",
  status: "status",
  createdAt: "createdAt",
}

const DEFAULT_WIDTHS: Record<string, number> = {
  name: 220, customer: 180, date: 110, surveyor: 150, sections: 260, status: 120, createdAt: 110,
}

type SortField = "name" | "date" | "status" | "createdAt"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  hardware_network: <Cpu className="size-3" />,
  software: <ClipboardList className="size-3" />,
  web_ecommerce: <Globe className="size-3" />,
  compliance: <ShieldCheck className="size-3" />,
  iot_ai: <Bot className="size-3" />,
}

const SECTION_BADGE_STYLES: Record<string, string> = {
  hardware_network: "bg-sky-950/70 text-sky-300 border-sky-800/50",
  software: "bg-violet-950/70 text-violet-300 border-violet-800/50",
  web_ecommerce: "bg-blue-950/70 text-blue-300 border-blue-800/50",
  compliance: "bg-rose-950/70 text-rose-300 border-rose-800/50",
  iot_ai: "bg-teal-950/70 text-teal-300 border-teal-800/50",
}

const SECTION_COLORS: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  hardware_network: { bg: "bg-sky-950/40", border: "border-sky-800/40", icon: "text-sky-300", badge: "bg-sky-950/70 text-sky-300 border-sky-800/50" },
  software: { bg: "bg-violet-950/40", border: "border-violet-800/40", icon: "text-violet-300", badge: "bg-violet-950/70 text-violet-300 border-violet-800/50" },
  web_ecommerce: { bg: "bg-blue-950/40", border: "border-blue-800/40", icon: "text-blue-300", badge: "bg-blue-950/70 text-blue-300 border-blue-800/50" },
  compliance: { bg: "bg-rose-950/40", border: "border-rose-800/40", icon: "text-rose-300", badge: "bg-rose-950/70 text-rose-300 border-rose-800/50" },
  iot_ai: { bg: "bg-teal-950/40", border: "border-teal-800/40", icon: "text-teal-300", badge: "bg-teal-950/70 text-teal-300 border-teal-800/50" },
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-zinc-500/12 text-zinc-400 border-zinc-500/25",
  SCHEDULED: "bg-sky-500/12 text-sky-400 border-sky-500/25",
  IN_PROGRESS: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  COMPLETED: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  CANCELLED: "bg-rose-500/12 text-rose-400 border-rose-500/25",
}

const SURVEY_SECTION_KEYS = [
  "hardware_network",
  "software",
  "web_ecommerce",
  "compliance",
  "iot_ai",
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SurveyFileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className="size-4 text-sky-400" />
  if (mimeType === "application/pdf") return <FileText className="size-4 text-rose-400" />
  if (mimeType.startsWith("text/")) return <FileText className="size-4 text-amber-400" />
  return <FileIcon className="size-4" style={{ color: "var(--muted-foreground)" }} />
}

type SurveyFileRow = {
  id: number; customerId: number; surveyId: number
  section: string | null; type: string | null
  name: string; cdnUrl: string; mimeType: string
  size: number; uploadedBy: string | null; createdAt: string
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

type ExpandedTab = "details" | "sections" | "branches" | "files" | "requirements" | "proposal" | "results" | "history"

type ClientRequirementRow = {
  id: number; surveyId: number; section: string; title: string
  description: string | null
  fileUrl: string | null; fileName: string | null; fileMimeType: string | null; fileSize: number | null
  createdAt: string; updatedAt: string
}

const REQ_SECTION_VALUES = ["SOFTWARE", "WEB_ECOMMERCE", "IOT_AI", "HARDWARE_NETWORK", "COMPLIANCE"] as const

// Maps DB section (UPPER_SNAKE) → i18n section key (lower_snake)
const REQ_SECTION_TO_I18N: Record<string, string> = {
  HARDWARE_NETWORK: "hardware_network",
  SOFTWARE: "software",
  WEB_ECOMMERCE: "web_ecommerce",
  IOT_AI: "iot_ai",
  COMPLIANCE: "compliance",
}

const REQ_SECTION_META: Record<string, {
  icon: React.ReactNode
  badge: string   // pill classes
  border: string  // left-border / card accent
  iconBg: string
}> = {
  HARDWARE_NETWORK: {
    icon: <Cpu className="size-3" />,
    badge: "bg-sky-950/70 text-sky-300 border-sky-800/50",
    border: "border-l-sky-500/50",
    iconBg: "bg-sky-950/70 border-sky-800/50 text-sky-300",
  },
  SOFTWARE: {
    icon: <ClipboardList className="size-3" />,
    badge: "bg-violet-950/70 text-violet-300 border-violet-800/50",
    border: "border-l-violet-500/50",
    iconBg: "bg-violet-950/70 border-violet-800/50 text-violet-300",
  },
  WEB_ECOMMERCE: {
    icon: <Globe className="size-3" />,
    badge: "bg-blue-950/70 text-blue-300 border-blue-800/50",
    border: "border-l-blue-500/50",
    iconBg: "bg-blue-950/70 border-blue-800/50 text-blue-300",
  },
  IOT_AI: {
    icon: <Bot className="size-3" />,
    badge: "bg-teal-950/70 text-teal-300 border-teal-800/50",
    border: "border-l-teal-500/50",
    iconBg: "bg-teal-950/70 border-teal-800/50 text-teal-300",
  },
  COMPLIANCE: {
    icon: <ShieldCheck className="size-3" />,
    badge: "bg-rose-950/70 text-rose-300 border-rose-800/50",
    border: "border-l-rose-500/50",
    iconBg: "bg-rose-950/70 border-rose-800/50 text-rose-300",
  },
}

function RequirementsTab({ surveyId }: { surveyId: number }) {
  const t = useTranslations("siteSurveysTable")
  const reqSectionLabel = (dbKey: string) =>
    t(`sections.${REQ_SECTION_TO_I18N[dbKey] ?? "software"}` as any)
  const [items, setItems] = useState<ClientRequirementRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editTarget, setEditTarget] = useState<ClientRequirementRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)

  // form state
  const [fSection, setFSection] = useState<string>("SOFTWARE")
  const [fTitle, setFTitle] = useState("")
  const [fDesc, setFDesc] = useState("")
  const [fFile, setFFile] = useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  async function generateDescription() {
    if (!fTitle.trim()) return
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: fSection, title: fTitle.trim(), brief: fDesc.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok && data.description) setFDesc(data.description)
      else alert(data.error ?? "Failed to generate description")
    } finally {
      setGenerating(false)
    }
  }

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/site-surveys/${surveyId}/requirements`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [surveyId])

  function openAdd() {
    setFSection("SOFTWARE"); setFTitle(""); setFDesc(""); setFFile(null)
    setEditTarget(null); setAdding(true)
  }

  function openEdit(r: ClientRequirementRow) {
    setFSection(r.section); setFTitle(r.title); setFDesc(r.description ?? ""); setFFile(null)
    setEditTarget(r); setAdding(true)
  }

  function cancelForm() { setAdding(false); setEditTarget(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append("section", fSection)
      fd.append("title", fTitle.trim())
      fd.append("description", fDesc.trim())
      if (fFile) fd.append("file", fFile)

      let res: Response
      if (editTarget) {
        res = await fetch(`/api/site-surveys/${surveyId}/requirements/${editTarget.id}`, { method: "PATCH", body: fd })
      } else {
        res = await fetch(`/api/site-surveys/${surveyId}/requirements`, { method: "POST", body: fd })
      }

      if (!res.ok) { const d = await res.json(); alert(d.error ?? "Error"); return }

      const saved = await res.json() as ClientRequirementRow
      setItems(prev =>
        editTarget
          ? (Array.isArray(prev) ? prev : []).map(x => x.id === saved.id ? saved : x)
          : [...(Array.isArray(prev) ? prev : []), saved]
      )
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, fileUrl: string | null) {
    setDeletingId(id)
    try {
      await fetch(`/api/site-surveys/${surveyId}/requirements/${id}`, { method: "DELETE" })
      setItems(prev => Array.isArray(prev) ? prev.filter(x => x.id !== id) : [])
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = React.useMemo(() => {
    const map: Record<string, ClientRequirementRow[]> = {}
    for (const item of (Array.isArray(items) ? items : [])) {
      if (!map[item.section]) map[item.section] = []
      map[item.section].push(item)
    }
    return map
  }, [items])

  const totalCount = items?.length ?? 0
  const activeMeta = REQ_SECTION_META[fSection] ?? REQ_SECTION_META.SOFTWARE

  return (
    <div className="space-y-4">

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center gap-2 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          <Loader2 className="size-3.5 animate-spin" /> {t("requirementsTab.loading")}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !adding && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border border-dashed border-[var(--border)]">
          <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ListChecks className="size-5" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{t("requirementsTab.emptyTitle")}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t("requirementsTab.emptyHint")}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); openAdd() }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors"
          >
            <Plus className="size-3.5" /> {t("requirementsTab.add")}
          </button>
        </div>
      )}

      {/* ── Grouped list ── */}
      {!loading && totalCount > 0 && (
        <div className="space-y-5">
          {REQ_SECTION_VALUES.filter(s => grouped[s]?.length).map(sec => {
            const meta = REQ_SECTION_META[sec]
            return (
              <div key={sec}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("size-5 rounded-md border flex items-center justify-center shrink-0", meta.iconBg)}>
                    {meta.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                    {reqSectionLabel(sec)}
                  </span>
                  <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border tabular-nums", meta.badge)}>
                    {grouped[sec].length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2 pl-1">
                  {grouped[sec].map((r, idx) => (
                    <div
                      key={r.id}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-xl border-l-[3px] border border-[var(--border)] bg-[var(--background)] px-4 py-3 transition-all hover:shadow-sm",
                        meta.border,
                      )}
                    >
                      {/* Index badge */}
                      <div className={cn("size-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black tabular-nums", meta.badge)}>
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                          {r.title}
                        </p>
                        {r.description && (
                          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                            {r.description}
                          </p>
                        )}
                        {r.fileUrl && r.fileName && (
                          <a
                            href={r.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 text-[11px] font-medium hover:bg-[var(--muted)]/60 transition-colors"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            <Paperclip className="size-3 shrink-0" />
                            <span className="truncate max-w-[200px]">{r.fileName}</span>
                            {r.fileSize != null && (
                              <span className="text-[10px] opacity-60 shrink-0">
                                {r.fileSize < 1024 * 1024
                                  ? `${(r.fileSize / 1024).toFixed(0)} KB`
                                  : `${(r.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                              </span>
                            )}
                          </a>
                        )}
                      </div>

                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(r) }}
                          className="rounded-lg p-1.5 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
                          style={{ color: "var(--muted-foreground)" }}
                          title={t("requirementsTab.edit")}
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(r.id, r.fileUrl) }}
                          disabled={deletingId === r.id}
                          className="rounded-lg p-1.5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                          style={{ color: "var(--muted-foreground)" }}
                          title={t("requirementsTab.delete")}
                        >
                          {deletingId === r.id
                            ? <Loader2 className="size-3 animate-spin" />
                            : <Trash2 className="size-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Inline form ── */}
      {adding && (
        <form
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          className="rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden shadow-sm"
        >
          {/* Form header — section-coloured */}
          <div className={cn("flex items-center justify-between px-4 py-3 border-b border-[var(--border)]", activeMeta.iconBg.replace("border", "border-b"))}>
            <div className="flex items-center gap-2">
              <div className={cn("size-6 rounded-lg border flex items-center justify-center", activeMeta.iconBg)}>
                {activeMeta.icon}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--foreground)" }}>
                {editTarget ? t("requirementsTab.editTitle") : t("requirementsTab.newTitle")}
              </span>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); cancelForm() }}
              className="rounded-lg p-1 hover:bg-[var(--muted)] transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* Section picker — visual pills */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{t("requirementsTab.sectionLabel")}</label>
              <div className="flex flex-wrap gap-1.5">
                {REQ_SECTION_VALUES.map(s => {
                  const m = REQ_SECTION_META[s]
                  const active = fSection === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={e => { e.stopPropagation(); setFSection(s) }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                        active ? m.badge + " shadow-sm scale-[1.03]" : "border-[var(--border)] hover:border-[var(--muted-foreground)]/30",
                      )}
                      style={active ? {} : { color: "var(--muted-foreground)" }}
                    >
                      {m.icon}{reqSectionLabel(s)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                {t("requirementsTab.titleLabel")} <span className="text-rose-400">*</span>
              </label>
              <input
                required
                value={fTitle}
                onChange={e => setFTitle(e.target.value)}
                placeholder={t("requirementsTab.titlePlaceholder")}
                className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
                style={{ color: "var(--foreground)" }}
              />
            </div>

            {/* Description + AI */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{t("requirementsTab.descriptionLabel")}</label>
                <button
                  type="button"
                  disabled={generating || !fTitle.trim()}
                  onClick={e => { e.stopPropagation(); generateDescription() }}
                  title={!fTitle.trim() ? t("requirementsTab.enterTitleFirst") : t("requirementsTab.generateWithAi")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-violet-800/50 bg-violet-950/70 text-violet-300 hover:bg-violet-900/80 hover:border-violet-700/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  {generating ? t("requirementsTab.generating") : t("requirementsTab.generateWithAi")}
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={fDesc}
                  onChange={e => setFDesc(e.target.value)}
                  placeholder={t("requirementsTab.descriptionPlaceholder")}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-[12px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
                  style={{ color: "var(--foreground)" }}
                />
                {generating && (
                  <div className="absolute inset-0 rounded-lg bg-[var(--background)]/60 flex items-center justify-center gap-2 text-[11px] text-violet-400 font-semibold backdrop-blur-[1px]">
                    <Loader2 className="size-3.5 animate-spin" /> {t("requirementsTab.generatingDescription")}
                  </div>
                )}
              </div>
            </div>

            {/* Attachment */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{t("requirementsTab.attachment")}</label>

              {editTarget?.fileUrl && !fFile && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20">
                  <Paperclip className="size-3.5 shrink-0 text-indigo-400" />
                  <a href={editTarget.fileUrl} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 truncate">
                    {editTarget.fileName}
                  </a>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--muted-foreground)" }}>{t("requirementsTab.replaceBelow")}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    fFile
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-dashed border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/5",
                  )}
                  style={fFile ? {} : { color: "var(--muted-foreground)" }}
                >
                  {fFile ? <Check className="size-3" /> : <Plus className="size-3" />}
                  {fFile ? fFile.name : t("requirementsTab.chooseFile")}
                </button>
                {fFile && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFFile(null); if (fileInputRef.current) fileInputRef.current.value = "" }}
                    className="rounded-lg p-1.5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => setFFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {/* Form footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--muted)]/10">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); cancelForm() }}
              className="text-[12px] font-semibold transition-colors hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("requirementsTab.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-1.5 text-[12px] font-semibold text-white transition-colors"
            >
              {saving && <Loader2 className="size-3 animate-spin" />}
              {editTarget ? t("requirementsTab.saving") : t("requirementsTab.adding")}
            </button>
          </div>
        </form>
      )}

      {/* ── Add button (when list is visible) ── */}
      {!adding && totalCount > 0 && (
        <button
          onClick={e => { e.stopPropagation(); openAdd() }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-dashed border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Plus className="size-3" /> {t("requirementsTab.add")}
        </button>
      )}
    </div>
  )
}

function ExpandedRow({
  survey,
  colSpan,
  filesRefreshKey,
  onUploadFiles,
  onOpenProposal,
  onSectionRemoved,
}: {
  survey: SurveyTableRow
  colSpan: number
  filesRefreshKey: number
  onUploadFiles: () => void
  onOpenProposal: () => void
  onSectionRemoved: (surveyId: number, sectionKey: string) => void
}) {
  const t = useTranslations("siteSurveysTable")
  const sectionLabel = (key: string) => {
    const k = (key || "").toLowerCase()
    if (["hardware_network", "software", "web_ecommerce", "compliance", "iot_ai"].includes(k)) {
      return t(`sections.${k}` as any)
    }
    return key
  }
  const statusLabel = (status: string) => {
    const k = (status || "").toLowerCase()
    if (["draft", "scheduled", "in_progress", "completed", "cancelled"].includes(k)) {
      return t(`status.${k}` as any)
    }
    return status
  }
  type InvitationRow = {
    id: number; sectionKey: string; email: string
    expiresAt: string; completedAt: string | null; createdAt: string
  }

  const [tab, setTab] = useState<ExpandedTab>("details")
  const [files, setFiles] = useState<SurveyFileRow[] | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [wizardSection, setWizardSection] = useState<string | null>(null)
  const [sectionStats, setSectionStats] = useState<Record<string, { answered: number; total: number }>>({})
  const [inviteSection, setInviteSection] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [deletingSection, setDeletingSection] = useState<string | null>(null)

  async function handleRemoveSection(sectionKey: string) {
    const label = sectionLabel(sectionKey)
    setDeletingSection(sectionKey)
    try {
      const impact = await getSurveySectionImpact(survey.id, sectionKey)
      if (!impact.ok) {
        alert(impact.error)
        return
      }

      const lines = [
        `Πρόκειται να αφαιρέσετε την ενότητα «${label}» από αυτήν την έρευνα.`,
        "",
        "Θα διαγραφούν οριστικά:",
        `  • ${impact.answers} απαντήσεις`,
        `  • ${impact.history} καταγραφές ιστορικού`,
        `  • ${impact.invitations} προσκλήσεις πελάτη`,
        `  • ${impact.requirements} απαιτήσεις`,
        "",
        "Η ενέργεια δεν είναι αναστρέψιμη. Συνέχεια;",
      ].join("\n")

      if (!window.confirm(lines)) return

      const res = await removeSurveySection(survey.id, sectionKey)
      if (!res.ok) {
        alert(res.error)
        return
      }

      // Optimistic local cleanup
      setSectionStats((prev) => {
        const next = { ...prev }
        delete next[sectionKey]
        return next
      })
      setInvitations((prev) => prev.filter((i) => i.sectionKey !== sectionKey))
      onSectionRemoved(survey.id, sectionKey)
    } finally {
      setDeletingSection(null)
    }
  }

  type ResolvedQuestion = {
    id: number; key: string; label: string; type: string
    section: string; order: number
    options: { id: number | string; label: string }[]
  }
  type ResultsMetadata = {
    filledBy: string
    filledByType: "ADMIN" | "CUSTOMER"
    filledAt: string
  }
  const [resultsQuestions, setResultsQuestions] = useState<ResolvedQuestion[] | null>(null)
  const [resultsAnswers, setResultsAnswers] = useState<Record<string, string | null> | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsMetadata, setResultsMetadata] = useState<ResultsMetadata | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  type HistoryEntry = {
    id: number
    changedBy: string
    changedByType: string
    answerValue: string | null
    createdAt: string
    question: { key: string; label: string; section: string }
  }
  const [historyRows, setHistoryRows] = useState<HistoryEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/site-surveys/${survey.id}/history`)
      if (!res.ok) return
      const { history } = await res.json() as { history: HistoryEntry[] }
      setHistoryRows(history)
    } catch { /* ignore */ }
    finally { setHistoryLoading(false) }
  }

  async function loadInvitations() {
    try {
      const res = await fetch(`/api/site-surveys/${survey.id}/invitations`)
      if (!res.ok) return
      const { invitations: rows } = await res.json() as { invitations: InvitationRow[] }
      setInvitations(rows)
    } catch { /* ignore */ }
  }

  async function loadResults() {
    setResultsLoading(true)
    try {
      const [questionsRes, resultsRes] = await Promise.all([
        fetch(`/api/site-surveys/questions`),
        fetch(`/api/site-surveys/${survey.id}/results`),
      ])
      if (!questionsRes.ok || !resultsRes.ok) return
      const questions = await questionsRes.json() as ResolvedQuestion[]
      const resultsData = await resultsRes.json() as { byKey: Record<string, string | null>; metadata: ResultsMetadata | null }
      setResultsQuestions(questions)
      setResultsAnswers(resultsData.byKey)
      setResultsMetadata(resultsData.metadata)
      // Initialize all sections as closed by default
      const defaultExpanded: Record<string, boolean> = {}
      const sections = new Set(questions.map(q => q.section.toLowerCase()))
      sections.forEach(sec => { defaultExpanded[sec] = false })
      setExpandedSections(defaultExpanded)
    } catch { /* silently ignore */ }
    finally { setResultsLoading(false) }
  }

  async function loadSectionStats() {
    try {
      const [resultsRes, questionsRes] = await Promise.all([
        fetch(`/api/site-surveys/${survey.id}/results`),
        fetch(`/api/site-surveys/questions`),
      ])
      if (!resultsRes.ok || !questionsRes.ok) return
      const { results } = await resultsRes.json() as { results: { answerValue: string | null; question: { section: string } }[] }
      const questions = await questionsRes.json() as { section: string }[]

      const totals: Record<string, number> = {}
      for (const q of questions) {
        const k = q.section.toLowerCase()
        totals[k] = (totals[k] ?? 0) + 1
      }
      const answered: Record<string, number> = {}
      for (const r of results) {
        if (r.answerValue !== null && r.answerValue !== "" && r.answerValue !== "[]") {
          const k = r.question.section.toLowerCase()
          answered[k] = (answered[k] ?? 0) + 1
        }
      }
      const stats: Record<string, { answered: number; total: number }> = {}
      for (const s of survey.sections) {
        stats[s] = { answered: answered[s] ?? 0, total: totals[s] ?? 0 }
      }
      setSectionStats(stats)
    } catch { /* silently ignore */ }
  }

  // Load section stats + invitations on mount
  React.useEffect(() => {
    loadSectionStats()
    loadInvitations()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadFiles() {
    setFilesLoading(true)
    fetch(`/api/site-surveys/${survey.id}/files`)
      .then(r => r.json())
      .then(d => setFiles(d))
      .catch(() => setFiles([]))
      .finally(() => setFilesLoading(false))
  }

  // Reload files whenever parent signals a new upload
  React.useEffect(() => {
    if (tab === "files") loadFiles()
  }, [filesRefreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabChange(t: ExpandedTab) {
    setTab(t)
    if (t === "files" && files === null) loadFiles()
    if (t === "history" && historyRows === null) loadHistory()
    if (t === "results" && resultsAnswers === null) loadResults()
  }

  async function handleDeleteFile(fileId: number) {
    setDeletingId(fileId)
    try {
      await fetch(`/api/site-surveys/${survey.id}/files/${fileId}`, { method: "DELETE" })
      setFiles(prev => prev?.filter(f => f.id !== fileId) ?? null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/20">
      {/* Empty cells under checkbox + chevron */}
      <td className="w-[40px]" />
      <td className="w-9" />

      <td colSpan={colSpan - 2} className="py-5 pr-6">
        {/* Tabs — bottom-border indicator style */}
        <div className="flex items-center gap-0 mb-5 border-b border-[var(--border)]">
          {(["details", "sections", "branches", "files", "requirements", "proposal", "results", "history"] as const).map(tk => {
            const label =
              tk === "details" ? t("tabs.details")
                : tk === "sections" ? t("tabs.sections", { count: survey.sections.length })
                  : tk === "branches" ? t("tabs.branches", { count: survey.branchIds.length })
                    : tk === "files" ? (files ? t("tabs.filesWithCount", { count: files.length }) : t("tabs.files"))
                      : tk === "proposal" ? t("tabs.proposal")
                        : tk === "results" ? t("tabs.results")
                          : tk === "history" ? t("tabs.history")
                            : t("tabs.requirements")
            const active = tab === tk
            return (
              <button
                key={tk}
                onClick={e => { e.stopPropagation(); handleTabChange(tk) }}
                className={cn(
                  "relative px-3.5 py-2.5 text-[12px] font-medium transition-colors select-none flex items-center gap-1.5 -mb-px border-b-2",
                  active
                    ? "text-[var(--foreground)] border-indigo-500 font-semibold"
                    : "text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)] hover:border-[var(--border)]",
                )}
              >
                {tk === "sections" && <Tag className="size-3" />}
                {tk === "branches" && <Building2 className="size-3" />}
                {tk === "files" && <Paperclip className="size-3" />}
                {tk === "requirements" && <ListChecks className="size-3" />}
                {tk === "proposal" && <FileText className="size-3" />}
                {tk === "results" && <FileBarChart2 className="size-3" />}
                {tk === "history" && <History className="size-3" />}
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Details tab ── */}
        {tab === "details" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <DetailBlock label={t("detailsTab.description")} icon={<ClipboardList className="size-3" />}>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--foreground)" }}>
                {survey.description || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
              </p>
            </DetailBlock>
            <DetailBlock label={t("detailsTab.customer")} icon={<Building2 className="size-3" />}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {survey.customer.name ?? `#${survey.customer.id}`}
              </p>
            </DetailBlock>
            <DetailBlock label={t("detailsTab.surveyor")} icon={<User className="size-3" />}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {survey.surveyor.name ?? survey.surveyor.email}
              </p>
              {survey.surveyor.name && (
                <p className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{survey.surveyor.email}</p>
              )}
            </DetailBlock>
            <DetailBlock label={t("detailsTab.date")} icon={<Calendar className="size-3" />}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {new Date(survey.date).toLocaleDateString("el-GR")}
              </p>
            </DetailBlock>
            <DetailBlock label={t("detailsTab.status")}>
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border", STATUS_STYLES[survey.status] ?? STATUS_STYLES.DRAFT)}>
                {statusLabel(survey.status)}
              </span>
            </DetailBlock>
            <DetailBlock label={t("detailsTab.lastUpdated")}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {new Date(survey.updatedAt).toLocaleDateString("el-GR")}
              </p>
            </DetailBlock>
          </div>
        )}

        {/* ── Sections tab ── */}
        {tab === "sections" && (
          <div className="space-y-2">
            {survey.sections.length === 0 ? (
              <p className="text-[13px] py-4" style={{ color: "var(--muted-foreground)" }}>{t("sectionsTab.empty")}</p>
            ) : survey.sections.map(s => {
              const stats = sectionStats[s]
              const hasStats = stats && stats.total > 0
              const allDone = hasStats && stats.answered === stats.total
              const started = hasStats && stats.answered > 0 && !allDone

              const sectionInvites = invitations.filter(i => i.sectionKey === s)
              const completed = sectionInvites.find(i => i.completedAt !== null)
              const pending = !completed && sectionInvites.find(
                i => i.completedAt === null && new Date(i.expiresAt) > new Date()
              )

              return (
                <div
                  key={s}
                  className={cn(
                    "rounded-lg border transition-colors",
                    completed
                      ? "border-emerald-500/25 bg-emerald-500/5"
                      : allDone
                        ? "border-emerald-500/20 bg-emerald-500/[3%]"
                        : "border-[var(--border)] bg-[var(--background)]",
                  )}
                >
                  {/* Main row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={cn(
                      "size-7 rounded-md border flex items-center justify-center shrink-0",
                      completed || allDone
                        ? "bg-emerald-950/70 border-emerald-800/50 text-emerald-300"
                        : SECTION_BADGE_STYLES[s] ?? "bg-indigo-950/70 border-indigo-800/50 text-indigo-300",
                    )}>
                      {(completed || allDone) ? <Check className="size-3.5" strokeWidth={2.5} /> : SECTION_ICONS[s]}
                    </div>

                    <p className="text-[13px] font-semibold flex-1" style={{ color: "var(--foreground)" }}>
                      {sectionLabel(s)}
                    </p>

                    {/* Q&A progress badge */}
                    {hasStats && (
                      <span className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset tabular-nums",
                        allDone
                          ? "bg-emerald-950/70 text-emerald-300 ring-emerald-800/60"
                          : started
                            ? "bg-amber-950/70 text-amber-300 ring-amber-800/60"
                            : "bg-zinc-800/80 text-zinc-400 ring-zinc-700/60",
                      )}>
                        {stats.answered}/{stats.total}
                      </span>
                    )}

                    {/* Invitation status badge */}
                    {completed && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset bg-emerald-950/70 text-emerald-300 ring-emerald-800/60">
                        <Lock className="size-3" /> {t("invitation.customerSubmitted")}
                      </span>
                    )}
                    {pending && !completed && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset bg-amber-950/70 text-amber-300 ring-amber-800/60">
                        <Clock className="size-3" /> {t("invitation.awaitingResponse")}
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setWizardSection(s) }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                        style={{ color: "var(--foreground)" }}
                      >
                        <PlayCircle className="size-3.5 text-indigo-400" /> {t("sectionsTab.fillOut")}
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setInviteSection(s) }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                        style={{ color: "var(--foreground)" }}
                      >
                        <Mail className="size-3.5 text-violet-400" /> {t("sectionsTab.sendToCustomer")}
                      </button>
                      <button
                        type="button"
                        title={t("sectionsTab.removeSection")}
                        disabled={deletingSection === s}
                        onClick={e => { e.stopPropagation(); handleRemoveSection(s) }}
                        className="inline-flex items-center justify-center rounded-md border border-[var(--border)] size-[30px] transition-colors hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {deletingSection === s
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <Trash2 className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Completion detail strip */}
                  {completed && (
                    <div className="flex items-center gap-2 px-4 pb-2.5 pt-1 border-t border-emerald-500/10">
                      <UserCheck className="size-3.5 text-emerald-500 shrink-0" />
                      <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        {t("invitation.submittedBy")}{" "}
                        <span className="font-semibold text-emerald-400">{completed.email}</span>
                        {" · "}
                        <span style={{ color: "var(--foreground)" }}>
                          {new Date(completed.completedAt!).toLocaleDateString("el-GR", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                  {pending && !completed && (
                    <div className="flex items-center gap-2 px-4 pb-2.5 pt-1 border-t border-amber-500/10">
                      <Clock className="size-3.5 text-amber-500 shrink-0" />
                      <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        {t("invitation.linkSentTo")}{" "}
                        <span className="font-semibold text-amber-400">{pending.email}</span>
                        {` · ${t("invitation.expires")} `}
                        <span style={{ color: "var(--foreground)" }}>
                          {new Date(pending.expiresAt).toLocaleDateString("el-GR", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Questions wizard ── */}
        <SurveyQuestionsWizard
          open={wizardSection !== null}
          onClose={() => { setWizardSection(null); loadSectionStats() }}
          surveyId={survey.id}
          surveyName={survey.name}
          sectionKey={wizardSection ?? ""}
          sectionLabel={wizardSection ? sectionLabel(wizardSection) : ""}
          customerCompletedBy={
            wizardSection
              ? invitations.find(i => i.sectionKey === wizardSection && i.completedAt !== null)?.email
              : undefined
          }
        />

        {/* ── Customer invite dialog ── */}
        <SurveyInviteDialog
          open={inviteSection !== null}
          onClose={() => { setInviteSection(null); loadInvitations() }}
          surveyId={survey.id}
          surveyName={survey.name}
          sectionKey={inviteSection ?? ""}
          sectionLabel={inviteSection ? sectionLabel(inviteSection) : ""}
        />

        {/* ── Branches tab ── */}
        {tab === "branches" && (
          <div>
            {survey.branchIds.length === 0 ? (
              <div className="flex items-center gap-2.5 py-6 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                <Building2 className="size-4 shrink-0" />
                {t("branchesTab.empty")}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] font-medium mb-3" style={{ color: "var(--muted-foreground)" }}>
                  {survey.branchIds.length === 1
                    ? t("branchesTab.selectedSingular", { count: survey.branchIds.length })
                    : t("branchesTab.selected", { count: survey.branchIds.length })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {survey.branchIds.map(id => (
                    <span key={id} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)]/60 px-3 py-1.5 text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                      <Building2 className="size-3.5 text-indigo-400" />
                      {t("branchesTab.branchPrefix")} #{id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Files tab ── */}
        {tab === "files" && (
          <div onClick={e => e.stopPropagation()} className="space-y-2">

            {filesLoading && (
              <div className="flex items-center gap-2 py-8 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-4 animate-spin" /> {t("filesTab.loading")}
              </div>
            )}

            {!filesLoading && files && files.length === 0 && (
              <div className="flex items-center gap-2.5 py-8 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                <Paperclip className="size-4 shrink-0" />
                {t("filesTab.empty")}
              </div>
            )}

            {!filesLoading && files && files.map(f => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 hover:bg-[var(--muted)]/30 transition-colors group">
                <div className="size-9 rounded-lg bg-[var(--muted)]/60 border border-[var(--border)] flex items-center justify-center shrink-0">
                  <SurveyFileTypeIcon mimeType={f.mimeType} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate" style={{ color: "var(--foreground)" }}>{f.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {f.type && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset bg-indigo-950/70 text-indigo-300 ring-indigo-800/50">
                        {f.type}
                      </span>
                    )}
                    {f.section && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset bg-amber-950/70 text-amber-300 ring-amber-800/50">
                        {sectionLabel(f.section)}
                      </span>
                    )}
                    <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      {formatBytes(f.size)} · {new Date(f.createdAt).toLocaleDateString("el-GR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity shrink-0">
                  <a
                    href={f.cdnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="rounded-lg p-2 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                    title={t("filesTab.download")}
                  >
                    <Download className="size-4" />
                  </a>
                  <button
                    onClick={() => handleDeleteFile(f.id)}
                    disabled={deletingId === f.id}
                    className="rounded-lg p-2 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                    style={{ color: "var(--muted-foreground)" }}
                    title={t("filesTab.delete")}
                  >
                    {deletingId === f.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </button>
                </div>
              </div>
            ))}

            {!filesLoading && (
              <button
                onClick={onUploadFiles}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold border border-dashed border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-300 transition-colors mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Plus className="size-4" />
                {t("filesTab.upload")}
              </button>
            )}
          </div>
        )}

        {/* ── Requirements tab ── */}
        {tab === "requirements" && (
          <div onClick={e => e.stopPropagation()}>
            <RequirementsTab surveyId={survey.id} />
          </div>
        )}

        {/* ── Proposal tab ── */}
        {tab === "proposal" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12" onClick={e => e.stopPropagation()}>
            <div className="size-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <FileText className="size-6" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{t("proposalTab.title")}</p>
              <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>{t("proposalTab.subtitle")}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onOpenProposal() }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors"
            >
              <FileText className="size-4" /> {t("proposalTab.open")}
            </button>
          </div>
        )}

        {/* ── Results tab ── */}
        {tab === "results" && (
          <div onClick={e => e.stopPropagation()}>
            {resultsLoading && (
              <div className="flex items-center gap-2 py-8 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-4 animate-spin" /> {t("resultsTab.loading")}
              </div>
            )}

            {!resultsLoading && (!resultsQuestions || resultsQuestions.length === 0) && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <div className="size-12 rounded-xl bg-slate-500/15 border border-slate-500/30 flex items-center justify-center text-slate-400">
                  <FileBarChart2 className="size-6" />
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{t("resultsTab.noneTitle")}</p>
                  <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>{t("resultsTab.noneSubtitle")}</p>
                </div>
              </div>
            )}

            {!resultsLoading && resultsQuestions && resultsQuestions.length > 0 && resultsAnswers && (() => {
              const parseDevices = (value: string | null | undefined) => {
                if (!value || value === "[]") return []
                try {
                  const arr = JSON.parse(value)
                  return Array.isArray(arr) ? arr : []
                } catch { return [] }
              }

              const formatAnswer = (answerValue: string | null | undefined, type: string, options: any[]) => {
                if (type === "DEVICE_LIST") {
                  const devices = parseDevices(answerValue)
                  if (devices.length === 0) return { text: t("resultsTab.noDevicesRecorded"), answered: false }
                  return {
                    text: devices.map((d: any, i: number) =>
                      `#${i + 1}: ${[d.brand, d.model].filter(Boolean).join(" — ")}` +
                      (d.serial ? ` | S/N: ${d.serial}` : "") +
                      (d.location ? ` | ${d.location}` : "") +
                      (d.ip ? ` | IP: ${d.ip}` : "")
                    ).join("\n"),
                    answered: true,
                  }
                }
                if (answerValue === null || answerValue === undefined || answerValue === "" || answerValue === "[]") {
                  return { text: t("resultsTab.noAnswer"), answered: false }
                }
                if (type === "BOOLEAN") {
                  const text = answerValue === "true" ? t("resultsTab.yes") : answerValue === "false" ? t("resultsTab.no") : answerValue
                  return { text, answered: true }
                }
                if (type === "DROPDOWN") {
                  const match = options.find(o => String(o.id) === String(answerValue))
                  return { text: match?.label ?? answerValue, answered: true }
                }
                if (type === "MULTI_SELECT") {
                  try {
                    const ids: (string | number)[] = JSON.parse(answerValue)
                    if (!Array.isArray(ids) || ids.length === 0) return { text: t("resultsTab.noAnswer"), answered: false }
                    const labels = ids.map(id => options.find(o => String(o.id) === String(id))?.label ?? String(id))
                    return { text: labels.join(", "), answered: true }
                  } catch {
                    return { text: answerValue, answered: true }
                  }
                }
                return { text: answerValue, answered: true }
              }

              const bySection: Record<string, typeof resultsQuestions> = {}
              for (const q of resultsQuestions) {
                const sec = q.section.toLowerCase()
                if (!bySection[sec]) bySection[sec] = []
                bySection[sec].push(q)
              }

              return (
                <div className="space-y-5">
                  {/* Filled by metadata */}
                  {resultsMetadata && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3 flex items-center gap-3">
                      <div className="size-8 rounded-full flex items-center justify-center bg-indigo-950/70 border border-indigo-800/50 text-indigo-300 shrink-0">
                        {resultsMetadata.filledByType === "CUSTOMER" ? <UserCheck className="size-4" /> : <User className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                          {resultsMetadata.filledByType === "CUSTOMER" ? t("resultsTab.filledByCustomer") : t("resultsTab.filledByAdmin")}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          {resultsMetadata.filledBy} • {new Date(resultsMetadata.filledAt).toLocaleDateString("el-GR")} {new Date(resultsMetadata.filledAt).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sections as accordions - only show sections with filled answers */}
                  {Object.entries(bySection).map(([sec, questions]) => {
                    const answered = questions.filter(q => {
                      const v = resultsAnswers[q.key]
                      if (q.type === "DEVICE_LIST") return parseDevices(v).length > 0
                      return v !== null && v !== undefined && v !== "" && v !== "[]"
                    }).length

                    // Skip sections with no answers
                    if (answered === 0) return null

                    const isExpanded = expandedSections[sec] ?? false

                    return (
                      <div key={sec} className={cn("rounded-2xl border overflow-hidden", SECTION_COLORS[sec]?.border ?? "border-[var(--border)]")}>
                        {/* Section header - clickable */}
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }))
                          }}
                          className={cn("w-full flex items-center gap-3 px-5 py-3.5 transition-colors hover:brightness-110", SECTION_COLORS[sec]?.bg ?? "bg-[var(--muted)]/20")}
                        >
                          <div className={cn("size-7 rounded-lg flex items-center justify-center border shrink-0", SECTION_COLORS[sec]?.badge ?? "bg-indigo-950/70 border-indigo-800/50 text-indigo-300")}>
                            {SECTION_ICONS[sec]}
                          </div>
                          <p className="text-[14px] font-bold flex-1 text-left" style={{ color: "var(--foreground)" }}>
                            {sectionLabel(sec)}
                          </p>
                          <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border tabular-nums shrink-0",
                            answered === questions.length && questions.length > 0
                              ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/50"
                              : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60"
                          )}>
                            {t("resultsTab.answered", { answered, total: questions.length })}
                          </span>
                          <div className="size-5 flex items-center justify-center text-[var(--muted-foreground)]">
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          </div>
                        </button>

                        {/* Questions - only show when expanded */}
                        {isExpanded && (
                          <div className="divide-y divide-[var(--border)]">
                            {questions.map((q, idx) => {
                              const rawVal = resultsAnswers[q.key]
                              const { text, answered: isAnswered } = formatAnswer(rawVal, q.type, q.options)

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
                                          {devices.length === 1
                                            ? t("resultsTab.devicesSingular", { count: devices.length })
                                            : t("resultsTab.devices", { count: devices.length })}
                                        </span>
                                      )}
                                    </div>
                                    {devices.length === 0 ? (
                                      <p className="ml-9 text-[12px] italic" style={{ color: "var(--muted-foreground)" }}>{t("resultsTab.noDevicesRecorded")}</p>
                                    ) : (
                                      <div className="ml-9 space-y-1.5">
                                        {devices.map((d: any, di: number) => (
                                          <div key={di} className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                                            <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>{t("resultsTab.brandModel")}</p>
                                              <p className="text-[12px]" style={{ color: d.brand || d.model ? "var(--foreground)" : "var(--muted-foreground)" }}>
                                                {[d.brand, d.model].filter(Boolean).join(" — ") || "—"}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>{t("resultsTab.serial")}</p>
                                              <p className="text-[12px] font-mono" style={{ color: d.serial ? "var(--foreground)" : "var(--muted-foreground)" }}>
                                                {d.serial || "—"}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>{t("resultsTab.location")}</p>
                                              <p className="text-[12px]" style={{ color: d.location ? "var(--foreground)" : "var(--muted-foreground)" }}>
                                                {d.location || "—"}
                                              </p>
                                            </div>
                                            {d.ip && (
                                              <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>{t("resultsTab.ip")}</p>
                                                <p className="text-[12px] font-mono" style={{ color: "var(--foreground)" }}>
                                                  {d.ip}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              }

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
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── History tab ── */}
        {tab === "history" && (
          <div onClick={e => e.stopPropagation()}>
            {historyLoading && (
              <div className="flex items-center gap-2 py-8 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-4 animate-spin" /> {t("historyTab.loading")}
              </div>
            )}

            {!historyLoading && historyRows !== null && historyRows.length === 0 && (
              <div className="flex items-center gap-2.5 py-8 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                <History className="size-4 shrink-0" />
                {t("historyTab.empty")}
              </div>
            )}

            {!historyLoading && historyRows && historyRows.length > 0 && (() => {
              const bySection: Record<string, typeof historyRows> = {}
              for (const h of historyRows) {
                const sec = h.question.section.toLowerCase()
                if (!bySection[sec]) bySection[sec] = []
                bySection[sec].push(h)
              }
              return (
                <div className="space-y-5">
                  {Object.entries(bySection).map(([sec, entries]) => (
                    <div key={sec}>
                      {/* Section header */}
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border)]">
                        <span className={cn("shrink-0", SECTION_BADGE_STYLES[sec]?.split(" ").find(c => c.startsWith("text-")) ?? "text-indigo-400")}>
                          {SECTION_ICONS[sec]}
                        </span>
                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                          {sectionLabel(sec)}
                        </p>
                      </div>

                      {/* Entries */}
                      <div className="space-y-0.5 border-l border-[var(--border)] pl-4 ml-1">
                        {entries.map(h => (
                          <div key={h.id} className="flex items-start gap-3 py-2 rounded-r px-2 hover:bg-[var(--muted)]/30 transition-colors">
                            {/* Who badge */}
                            <span className={cn(
                              "shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                              h.changedByType === "CUSTOMER"
                                ? "bg-emerald-950/70 text-emerald-300 ring-emerald-800/60"
                                : "bg-indigo-950/70 text-indigo-300 ring-indigo-800/60",
                            )}>
                              {h.changedByType === "CUSTOMER" ? <UserCheck className="size-3" /> : <User className="size-3" />}
                              {h.changedByType === "CUSTOMER" ? t("historyTab.customer") : t("historyTab.admin")}
                            </span>

                            {/* Detail */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                                {h.question.label}
                              </p>
                              <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                                {h.changedBy}
                                {h.answerValue
                                  ? <> · <span style={{ color: "var(--foreground)" }}>
                                    {h.answerValue.length > 80 ? h.answerValue.slice(0, 80) + "…" : h.answerValue}
                                  </span></>
                                  : <span className="italic"> · {t("historyTab.cleared")}</span>
                                }
                              </p>
                            </div>

                            {/* Time */}
                            <span className="shrink-0 text-[12px] tabular-nums font-medium" style={{ color: "var(--muted-foreground)" }}>
                              {new Date(h.createdAt).toLocaleString("el-GR", {
                                day: "2-digit", month: "short",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </td>
    </tr>
  )
}

function DetailBlock({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
        {icon}{label}
      </p>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  surveys: SurveyTableRow[]
  total: number
  users: SurveyUser[]
  customerOptions: SurveyCustomerOption[]
}

export function SiteSurveysTable({ surveys: initialSurveys, total: initialTotal, users, customerOptions }: Props) {
  const t = useTranslations("siteSurveysTable")
  const sectionLabel = (key: string) => {
    const k = (key || "").toLowerCase()
    if (["hardware_network", "software", "web_ecommerce", "compliance", "iot_ai"].includes(k)) {
      return t(`sections.${k}` as any)
    }
    return key
  }
  const statusLabel = (status: string) => {
    const k = (status || "").toLowerCase()
    if (["draft", "scheduled", "in_progress", "completed", "cancelled"].includes(k)) {
      return t(`status.${k}` as any)
    }
    return status
  }
  const columnLabel = (key: string) => {
    if (COLUMN_I18N_KEYS[key]) return t(`columns.${COLUMN_I18N_KEYS[key]}` as any)
    return key
  }
  const [surveys, setSurveys] = useState(initialSurveys)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SurveyTableRow | null>(null)
  const [surveyCustomer, setSurveyCustomer] = useState<SurveyCustomer | null>(null)
  const [fileUploadSurvey, setFileUploadSurvey] = useState<SurveyTableRow | null>(null)
  const [reportSurvey, setReportSurvey] = useState<SurveyTableRow | null>(null)
  const [proposalSurvey, setProposalSurvey] = useState<SurveyTableRow | null>(null)
  const [aiSurvey, setAiSurvey] = useState<SurveyTableRow | null>(null)
  const [mailSurvey, setMailSurvey] = useState<SurveyTableRow | null>(null)
  // Incremented after each upload to signal ExpandedRow to reload files
  const [filesRefreshKeys, setFilesRefreshKeys] = useState<Record<number, number>>({})

  const [, startDelete] = useTransition()
  const [, startEditLoad] = useTransition()

  const { visibleCols, toggleCol, pageSize, setPageSize, colWidths, setColWidth, hydrated } =
    useTablePrefs("site-surveys", COLUMNS, 25, DEFAULT_WIDTHS)

  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null)

  function onResizeMouseDown(e: React.MouseEvent, key: string) {
    e.preventDefault(); e.stopPropagation()
    const startW = colWidths[key] ?? DEFAULT_WIDTHS[key] ?? 120
    resizingRef.current = { key, startX: e.clientX, startW }
    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return
      setColWidth(resizingRef.current.key, Math.max(60, resizingRef.current.startW + ev.clientX - resizingRef.current.startX))
    }
    function onUp() {
      resizingRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const visibleDefs = COLUMNS.filter(c => visibleCols.has(c.key))
  // checkbox + chevron + cols + actions
  const COL_COUNT = 1 + 1 + visibleDefs.length + 1

  // ─── Selection ────────────────────────────────────────────────────────────

  const pageIds = surveys.map(s => s.id)
  const allSel = pageIds.length > 0 && pageIds.every(id => selected.has(id))
  const someSel = pageIds.some(id => selected.has(id)) && !allSel

  function toggleAll() {
    setSelected(s => {
      const n = new Set(s)
      allSel ? pageIds.forEach(id => n.delete(id)) : pageIds.forEach(id => n.add(id))
      return n
    })
  }
  function toggleRow(id: number) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchSurveys = useCallback(async (opts: {
    q?: string; sort?: string; dir?: "asc" | "desc"; pg?: number; limit?: number
  } = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: opts.q ?? search,
        sort: opts.sort ?? sortField,
        dir: opts.dir ?? sortDir,
        limit: String(opts.limit ?? pageSize),
        offset: String(((opts.pg ?? page) - 1) * (opts.limit ?? pageSize)),
      })
      const res = await fetch(`/api/site-surveys?${params}`)
      const data = await res.json()
      setSurveys(data.surveys.map((s: any) => ({
        ...s,
        date: new Date(s.date).toISOString(),
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
        branchIds: s.branchIds ?? [],
        sections: s.sections ?? [],
      })))
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [search, sortField, sortDir, page, pageSize])

  function handleSearch(q: string) {
    setSearch(q); setPage(1)
    fetchSurveys({ q, pg: 1 })
  }

  function handleSort(col: ColDef) {
    if (!col.sortable) return
    const field = col.key as SortField
    const dir: "asc" | "desc" = sortField === field && sortDir === "asc" ? "desc" : "asc"
    setSortField(field); setSortDir(dir); setPage(1)
    fetchSurveys({ sort: field, dir, pg: 1 })
  }

  function handlePage(pg: number) {
    setPage(pg); fetchSurveys({ pg })
  }

  function handlePageSize(n: number) {
    setPageSize(n as typeof PAGE_SIZES[number]); setPage(1)
    fetchSurveys({ limit: n, pg: 1 })
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  function openNew() {
    setEditTarget(null); setSurveyCustomer(null); setDialogOpen(true)
  }

  function openEdit(row: SurveyTableRow) {
    setSurveyCustomer({ id: row.customer.id, name: row.customer.name, branches: [] })
    setEditTarget(row); setDialogOpen(true)
    startEditLoad(async () => {
      const { branches, mainAddress } = await getCustomerBranches(row.customerId)
      setSurveyCustomer({ id: row.customer.id, name: row.customer.name, branches: branches as SurveyBranch[], mainAddress })
    })
  }

  function handleDelete(id: number) {
    setDeletingId(id)
    startDelete(async () => {
      await deleteSiteSurvey(id)
      setSurveys(prev => prev.filter(s => s.id !== id))
      setSelected(s => { const n = new Set(s); n.delete(id); return n })
      setTotal(prev => prev - 1)
      setDeletingId(null)
    })
  }

  function handleSaved() {
    setDialogOpen(false); setEditTarget(null); setSurveyCustomer(null)
    fetchSurveys()
  }

  const editRow = editTarget ? ({
    id: editTarget.id, name: editTarget.name, description: editTarget.description,
    date: new Date(editTarget.date), customerId: editTarget.customerId,
    surveyorId: editTarget.surveyorId, branchIds: editTarget.branchIds,
    sections: editTarget.sections as SurveySection[], status: editTarget.status as SurveyStatus,
  } satisfies SiteSurveyRow) : undefined

  // ─── Cell renderer ────────────────────────────────────────────────────────

  function renderCell(col: ColDef, s: SurveyTableRow) {
    switch (col.key) {
      case "name":
        return (
          <td key="name" className="px-3 py-3 overflow-hidden">
            <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>{s.name}</p>
            {s.description && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.description}</p>}
          </td>
        )
      case "customer":
        return <td key="customer" className="px-3 py-3 text-[12px] truncate" style={{ color: "var(--foreground)" }}>{s.customer.name ?? `#${s.customer.id}`}</td>
      case "date":
        return <td key="date" className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--foreground)" }}>{new Date(s.date).toLocaleDateString("el-GR")}</td>
      case "surveyor":
        return <td key="surveyor" className="px-3 py-3 text-[12px] truncate" style={{ color: "var(--foreground)" }}>{s.surveyor.name ?? s.surveyor.email}</td>
      case "sections":
        return (
          <td key="sections" className="px-3 py-3">
            <div className="flex flex-wrap gap-1">
              {s.sections.map(sec => {
                const customerDone = s.invitations?.some(i => i.sectionKey === sec)
                return (
                  <span
                    key={sec}
                    title={customerDone ? t("invitation.customerSubmittedTitle") : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border",
                      customerDone
                        ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/25"
                        : SECTION_BADGE_STYLES[sec] ?? "bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]",
                    )}
                  >
                    {customerDone ? <Lock className="size-2.5" /> : SECTION_ICONS[sec]}
                    {sectionLabel(sec)}
                  </span>
                )
              })}
            </div>
          </td>
        )
      case "status":
        return (
          <td key="status" className="px-3 py-3">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border", STATUS_STYLES[s.status] ?? STATUS_STYLES.DRAFT)}>
              {statusLabel(s.status)}
            </span>
          </td>
        )
      case "createdAt":
        return <td key="createdAt" className="px-3 py-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>{new Date(s.createdAt).toLocaleDateString("el-GR")}</td>
      default:
        return <td key={col.key} />
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!hydrated) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--muted-foreground)]" />
          <input
            type="search"
            placeholder={t("search")}
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{t("actions.selected", { count: selected.size })}</span>
            <button onClick={() => setSelected(new Set())} className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("actions.clear")}</button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Column picker */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors" style={{ color: "var(--muted-foreground)" }}>
                <Columns3 className="size-3.5" /> {t("actions.columns")}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150">
                {COLUMNS.map(col => {
                  const isVisible = visibleCols.has(col.key)
                  const locked = col.alwaysVisible
                  return (
                    <DropdownMenu.Item
                      key={col.key}
                      onSelect={e => { e.preventDefault(); if (!locked) toggleCol(col.key) }}
                      className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none transition-colors", locked ? "opacity-50 cursor-default" : "hover:bg-[var(--muted)]")}
                    >
                      <div className={cn("size-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors", isVisible ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]")}>
                        {isVisible && <Check className="size-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <span style={{ color: "var(--foreground)" }}>{columnLabel(col.key)}</span>
                      {locked && <span className="text-[10px] ml-auto" style={{ color: "var(--muted-foreground)" }}>{t("actions.locked")}</span>}
                    </DropdownMenu.Item>
                  )
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <Btn size="sm" onClick={openNew}>
            <Plus className="size-3.5" /> {t("actions.new")}
          </Btn>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 36 }} />
              {visibleDefs.map(col => <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_WIDTHS[col.key] ?? 120 }} />)}
              <col style={{ width: 48 }} />
            </colgroup>

            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                {/* Select-all */}
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSel}
                    ref={el => { if (el) el.indeterminate = someSel }}
                    onChange={toggleAll}
                    className="rounded accent-indigo-500 cursor-pointer"
                  />
                </th>
                {/* Expand chevron col */}
                <th className="w-9" />
                {visibleDefs.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col)}
                    className={cn(
                      "px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap select-none relative",
                      col.sortable ? "cursor-pointer" : "cursor-default",
                      sortField === col.key ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{columnLabel(col.key)}</span>
                      {col.sortable && (
                        sortField === col.key
                          ? sortDir === "asc"
                            ? <ChevronUp className="size-3.5 shrink-0" style={{ color: "var(--foreground)" }} />
                            : <ChevronDown className="size-3.5 shrink-0" style={{ color: "var(--foreground)" }} />
                          : <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" style={{ color: "var(--muted-foreground)" }} />
                      )}
                    </div>
                    <div
                      onMouseDown={e => onResizeMouseDown(e, col.key)}
                      onClick={e => e.stopPropagation()}
                      className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center group"
                    >
                      <div className="w-px h-4 bg-[var(--border)] group-hover:bg-[var(--primary)] transition-colors" />
                    </div>
                  </th>
                ))}
                <th className="px-2 py-3 w-12" />
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr><td colSpan={COL_COUNT} className="text-center py-12">
                  <Loader2 className="size-5 animate-spin mx-auto text-[var(--muted-foreground)]" />
                </td></tr>
              )}
              {!loading && surveys.length === 0 && (
                <tr><td colSpan={COL_COUNT} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardList className="size-7 opacity-30" style={{ color: "var(--muted-foreground)" }} />
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("empty.noSurveys")}</p>
                  </div>
                </td></tr>
              )}
              {!loading && surveys.map((s, i) => {
                const isSel = selected.has(s.id)
                const expanded = expandedId === s.id
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                      className={cn(
                        "border-b border-[var(--border)]/50 last:border-0 transition-colors cursor-pointer",
                        isSel ? "bg-[var(--primary)]/5" : i % 2 === 0 ? "bg-transparent" : "bg-[var(--muted)]/10",
                        "hover:bg-[var(--muted)]/25",
                        expanded && "!bg-indigo-500/5 border-b-0",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(s.id)}
                          className="rounded accent-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Expand chevron */}
                      <td className="py-3 w-9">
                        <ChevronRight
                          className="size-3.5 transition-transform duration-200 text-[var(--muted-foreground)]"
                          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
                        />
                      </td>

                      {visibleDefs.map(col => renderCell(col, s))}

                      {/* Row actions */}
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--muted)]" style={{ color: "var(--muted-foreground)" }}>
                              {deletingId === s.id ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150">
                              <DropdownMenu.Item onSelect={() => openEdit(s)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors">
                                <Pencil className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> {t("actions.edit")}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setReportSurvey(s)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <FileBarChart2 className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> {t("actions.viewReport")}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setAiSurvey(s)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-violet-950/40 text-violet-300 transition-colors"
                              >
                                <Sparkles className="size-3.5 text-violet-400" /> AI Ανάλυση
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setProposalSurvey(s)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <FileText className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> {t("actions.proposal")}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => { setFileUploadSurvey(s); setExpandedId(s.id) }}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Paperclip className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> {t("actions.uploadFiles")}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setMailSurvey(s)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Send className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> {t("actions.sendMail")}
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                              <DropdownMenu.Item
                                onSelect={() => handleDelete(s.id)}
                                disabled={deletingId === s.id}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none text-[var(--destructive)] hover:bg-[var(--destructive)]/8 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <Trash2 className="size-3.5" /> {t("actions.delete")}
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>

                    {expanded && (
                      <ExpandedRow
                        survey={s}
                        colSpan={COL_COUNT}
                        filesRefreshKey={filesRefreshKeys[s.id] ?? 0}
                        onUploadFiles={() => setFileUploadSurvey(s)}
                        onOpenProposal={() => setProposalSurvey(s)}
                        onSectionRemoved={(surveyId, sectionKey) => {
                          setSurveys((prev) =>
                            prev.map((row) =>
                              row.id === surveyId
                                ? { ...row, sections: row.sections.filter((k) => k !== sectionKey) }
                                : row,
                            ),
                          )
                        }}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--muted)]/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">{t("actions.rowsPerPage")}</span>
            <select
              value={pageSize}
              onChange={e => handlePageSize(Number(e.target.value))}
              className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            >
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted-foreground)]">
              {total === 0
                ? t("actions.zeroSurveys")
                : t("actions.rowsRange", { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}
            </span>
            <div className="flex items-center gap-1">
              {([
                { icon: ChevronsLeft, action: () => handlePage(1), disabled: page <= 1 },
                { icon: ChevronLeft, action: () => handlePage(page - 1), disabled: page <= 1 },
                { icon: ChevronRightIcon, action: () => handlePage(page + 1), disabled: page >= totalPages },
                { icon: ChevronsRight, action: () => handlePage(totalPages), disabled: page >= totalPages },
              ] as const).map(({ icon: Icon, action, disabled }, idx) => (
                <button
                  key={idx}
                  onClick={action}
                  disabled={disabled}
                  className="size-7 rounded-lg flex items-center justify-center border border-[var(--input)] bg-[var(--background)] hover:bg-[var(--muted)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Icon className="size-3.5 text-[var(--muted-foreground)]" />
                </button>
              ))}
            </div>
            <span className="text-xs font-medium px-2" style={{ color: "var(--foreground)" }}>{page} / {totalPages}</span>
          </div>
        </div>
      </div>

      <SiteSurveyDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(null); setSurveyCustomer(null) }}
        onSaved={handleSaved}
        customer={surveyCustomer ?? undefined}
        customerOptions={customerOptions}
        users={users}
        survey={editRow}
      />

      {reportSurvey && (
        <SiteSurveyReportModal
          open={!!reportSurvey}
          onClose={() => setReportSurvey(null)}
          survey={reportSurvey}
        />
      )}

      {proposalSurvey && (
        <SurveyProposalModal
          open={!!proposalSurvey}
          onClose={() => setProposalSurvey(null)}
          survey={proposalSurvey}
          users={users}
        />
      )}

      {aiSurvey && (
        <AiAnalysisDialog
          surveyId={aiSurvey.id}
          surveyName={aiSurvey.name}
          customerName={aiSurvey.customer.name ?? ""}
          sections={aiSurvey.sections.length > 0 ? aiSurvey.sections : ["hardware_network", "software", "web_ecommerce", "compliance", "iot_ai"]}
          onClose={() => setAiSurvey(null)}
          onProposalCreated={() => {
            const s = aiSurvey
            setAiSurvey(null)
            setProposalSurvey(s)
          }}
        />
      )}

      {mailSurvey && (
        <SurveySendMailDialog
          open={!!mailSurvey}
          onClose={() => setMailSurvey(null)}
          survey={mailSurvey}
        />
      )}

      <FileUploadDialog
        open={!!fileUploadSurvey}
        onClose={() => setFileUploadSurvey(null)}
        uploadUrl={fileUploadSurvey ? `/api/site-surveys/${fileUploadSurvey.id}/files` : ""}
        title={t("filesTab.uploadTitle")}
        subtitle={fileUploadSurvey?.customer.name ?? undefined}
        sections={SURVEY_SECTION_KEYS.map(k => ({ value: k, label: sectionLabel(k) })) as SectionOption[]}
        onUploaded={() => {
          if (fileUploadSurvey) {
            setFilesRefreshKeys(prev => ({ ...prev, [fileUploadSurvey.id]: (prev[fileUploadSurvey.id] ?? 0) + 1 }))
          }
        }}
      />
    </div>
  )
}
