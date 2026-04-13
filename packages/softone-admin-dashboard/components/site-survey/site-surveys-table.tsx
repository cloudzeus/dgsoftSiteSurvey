"use client"

import React, { useState, useCallback, useTransition, useRef } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
  ClipboardList, MoreHorizontal, Pencil, Trash2, Loader2, Plus, Search,
  Building2, Cpu, Globe, ShieldCheck, Bot, ChevronRight,
  ChevronUp, ChevronDown, ChevronsUpDown, Columns3, Check,
  ChevronsLeft, ChevronLeft, ChevronRight as ChevronRightIcon, ChevronsRight,
  User, Calendar, Tag, Paperclip, FileText, FileImage, File as FileIcon, Download,
  PlayCircle, FileBarChart2,
} from "lucide-react"
import { FileUploadDialog, type SectionOption } from "@/components/shared/file-upload-dialog"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { useTablePrefs, PAGE_SIZES, type ColDef } from "@/hooks/use-table-prefs"
import { deleteSiteSurvey, getCustomerBranches } from "@/app/actions/site-survey"
import { SiteSurveyDialog, type SurveyUser, type SurveyCustomer, type SurveyCustomerOption, type SurveyBranch, type SiteSurveyRow } from "./site-survey-dialog"
import { SurveyQuestionsWizard } from "./survey-questions-wizard"
import { SiteSurveyReportModal } from "./site-survey-report-modal"
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
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: "name",      label: "Survey",    sortable: true,  defaultVisible: true,  alwaysVisible: true  },
  { key: "customer",  label: "Customer",  sortable: false, defaultVisible: true,  alwaysVisible: false },
  { key: "date",      label: "Date",      sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "surveyor",  label: "Surveyor",  sortable: false, defaultVisible: true,  alwaysVisible: false },
  { key: "sections",  label: "Sections",  sortable: false, defaultVisible: true,  alwaysVisible: false },
  { key: "status",    label: "Status",    sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "createdAt", label: "Created",   sortable: true,  defaultVisible: false, alwaysVisible: false },
]

const DEFAULT_WIDTHS: Record<string, number> = {
  name: 220, customer: 180, date: 110, surveyor: 150, sections: 260, status: 120, createdAt: 110,
}

type SortField = "name" | "date" | "status" | "createdAt"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  hardware_network: "Hardware & Network",
  software:         "Software",
  web_ecommerce:    "Web & E-commerce",
  compliance:       "Compliance",
  iot_ai:           "IoT & AI",
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  hardware_network: <Cpu          className="size-3" />,
  software:         <ClipboardList className="size-3" />,
  web_ecommerce:    <Globe        className="size-3" />,
  compliance:       <ShieldCheck  className="size-3" />,
  iot_ai:           <Bot          className="size-3" />,
}

const SECTION_BADGE_STYLES: Record<string, string> = {
  hardware_network: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  software:         "bg-violet-500/10 text-violet-400 border-violet-500/20",
  web_ecommerce:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  compliance:       "bg-rose-500/10 text-rose-400 border-rose-500/20",
  iot_ai:           "bg-teal-500/10 text-teal-400 border-teal-500/20",
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

const SURVEY_SECTION_OPTIONS: SectionOption[] = [
  { value: "hardware_network", label: "Hardware & Network" },
  { value: "software",         label: "Software" },
  { value: "web_ecommerce",    label: "Web & E-commerce" },
  { value: "compliance",       label: "Compliance" },
  { value: "iot_ai",           label: "IoT & AI" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SurveyFileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))       return <FileImage className="size-4 text-sky-400" />
  if (mimeType === "application/pdf")      return <FileText  className="size-4 text-rose-400" />
  if (mimeType.startsWith("text/"))        return <FileText  className="size-4 text-amber-400" />
  return <FileIcon className="size-4" style={{ color: "var(--muted-foreground)" }} />
}

type SurveyFileRow = {
  id: number; customerId: number; surveyId: number
  section: string | null; type: string | null
  name: string; cdnUrl: string; mimeType: string
  size: number; uploadedBy: string | null; createdAt: string
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

type ExpandedTab = "details" | "sections" | "branches" | "files"

function ExpandedRow({
  survey,
  colSpan,
  filesRefreshKey,
  onUploadFiles,
}: {
  survey: SurveyTableRow
  colSpan: number
  filesRefreshKey: number
  onUploadFiles: () => void
}) {
  const [tab,          setTab]          = useState<ExpandedTab>("details")
  const [files,        setFiles]        = useState<SurveyFileRow[] | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [deletingId,   setDeletingId]   = useState<number | null>(null)
  const [wizardSection, setWizardSection] = useState<string | null>(null)
  const [sectionStats, setSectionStats] = useState<Record<string, { answered: number; total: number }>>({})

  async function loadSectionStats() {
    try {
      const [resultsRes, questionsRes] = await Promise.all([
        fetch(`/api/site-surveys/${survey.id}/results`),
        fetch(`/api/site-surveys/questions`),
      ])
      if (!resultsRes.ok || !questionsRes.ok) return
      const { results } = await resultsRes.json() as { results: { answerValue: string | null; question: { section: string } }[] }
      const questions   = await questionsRes.json() as { section: string }[]

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

  // Load section stats on mount so badges are ready before switching tabs
  React.useEffect(() => { loadSectionStats() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    <tr className="border-b border-[var(--border)] bg-indigo-500/[2.5%]">
      {/* Empty cells under checkbox + chevron */}
      <td className="w-[40px]" />
      <td className="w-9" />

      <td colSpan={colSpan - 2} className="py-4 pr-6">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 mb-4 border-b border-[var(--border)]">
          {(["details", "sections", "branches", "files"] as const).map(t => {
            const label =
              t === "details"  ? "Details"
              : t === "sections" ? `Sections (${survey.sections.length})`
              : t === "branches" ? `Branches (${survey.branchIds.length})`
              : `Files${files ? ` (${files.length})` : ""}`
            return (
              <button
                key={t}
                onClick={e => { e.stopPropagation(); handleTabChange(t) }}
                className={cn(
                  "relative px-3.5 py-2 text-[11px] font-semibold transition-colors select-none flex items-center gap-1.5",
                  tab === t ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {t === "sections" && <Tag       className="size-3" />}
                {t === "branches" && <Building2 className="size-3" />}
                {t === "files"    && <Paperclip className="size-3" />}
                {label}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-indigo-500" />}
              </button>
            )
          })}
        </div>

        {/* ── Details tab ── */}
        {tab === "details" && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <DetailBlock label="Description" icon={<ClipboardList className="size-3" />}>
              <p className="text-[12px]" style={{ color: "var(--foreground)" }}>
                {survey.description || <span style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>—</span>}
              </p>
            </DetailBlock>
            <DetailBlock label="Customer" icon={<Building2 className="size-3" />}>
              <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
                {survey.customer.name ?? `#${survey.customer.id}`}
              </p>
            </DetailBlock>
            <DetailBlock label="Surveyor" icon={<User className="size-3" />}>
              <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
                {survey.surveyor.name ?? survey.surveyor.email}
              </p>
              {survey.surveyor.name && (
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{survey.surveyor.email}</p>
              )}
            </DetailBlock>
            <DetailBlock label="Date" icon={<Calendar className="size-3" />}>
              <p className="text-[12px]" style={{ color: "var(--foreground)" }}>
                {new Date(survey.date).toLocaleDateString("el-GR")}
              </p>
            </DetailBlock>
            <DetailBlock label="Status">
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border", STATUS_STYLES[survey.status] ?? STATUS_STYLES.DRAFT)}>
                {STATUS_LABELS[survey.status] ?? survey.status}
              </span>
            </DetailBlock>
            <DetailBlock label="Last Updated">
              <p className="text-[12px]" style={{ color: "var(--foreground)" }}>
                {new Date(survey.updatedAt).toLocaleDateString("el-GR")}
              </p>
            </DetailBlock>
          </div>
        )}

        {/* ── Sections tab ── */}
        {tab === "sections" && (
          <div className="space-y-2">
            {survey.sections.length === 0 ? (
              <p className="text-[12px] py-4" style={{ color: "var(--muted-foreground)" }}>No sections selected.</p>
            ) : survey.sections.map(s => {
              const stats    = sectionStats[s]
              const hasStats = stats && stats.total > 0
              const allDone  = hasStats && stats.answered === stats.total
              const started  = hasStats && stats.answered > 0 && !allDone

              return (
                <button
                  key={s}
                  type="button"
                  onClick={e => { e.stopPropagation(); setWizardSection(s) }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors group text-left",
                    allDone
                      ? "border-emerald-500/30 bg-emerald-500/[3%] hover:bg-emerald-500/[5%]"
                      : "border-[var(--border)] bg-[var(--muted)]/10 hover:bg-indigo-500/5 hover:border-indigo-500/30",
                  )}
                >
                  <div className={cn(
                    "size-7 rounded-lg border flex items-center justify-center shrink-0",
                    allDone
                      ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                      : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
                  )}>
                    {allDone ? <Check className="size-3.5" strokeWidth={3} /> : SECTION_ICONS[s]}
                  </div>
                  <p className="text-[13px] font-semibold flex-1" style={{ color: "var(--foreground)" }}>
                    {SECTION_LABELS[s] ?? s}
                  </p>
                  {hasStats && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums",
                      allDone
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : started
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]",
                    )}>
                      {stats.answered}/{stats.total}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <PlayCircle className="size-3.5" /> Fill out
                  </span>
                </button>
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
          sectionLabel={SECTION_LABELS[wizardSection ?? ""] ?? wizardSection ?? ""}
        />

        {/* ── Branches tab ── */}
        {tab === "branches" && (
          <div>
            {survey.branchIds.length === 0 ? (
              <p className="text-[12px] py-4" style={{ color: "var(--muted-foreground)" }}>
                All branches / HQ (no specific branches selected).
              </p>
            ) : (
              <p className="text-[12px] py-4" style={{ color: "var(--foreground)" }}>
                {survey.branchIds.length} branch{survey.branchIds.length !== 1 ? "es" : ""} selected
                <span className="ml-2 font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  (IDs: {survey.branchIds.join(", ")})
                </span>
              </p>
            )}
          </div>
        )}

        {/* ── Files tab ── */}
        {tab === "files" && (
          <div onClick={e => e.stopPropagation()} className="space-y-2">

            {filesLoading && (
              <div className="flex items-center gap-2 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-3.5 animate-spin" /> Loading files…
              </div>
            )}

            {!filesLoading && files && files.length === 0 && (
              <div className="flex items-center gap-2.5 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Paperclip className="size-3.5 shrink-0" />
                No files uploaded yet.
              </div>
            )}

            {!filesLoading && files && files.map(f => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors group">
                <div className="size-8 rounded-lg bg-[var(--muted)]/50 border border-[var(--border)] flex items-center justify-center shrink-0">
                  <SurveyFileTypeIcon mimeType={f.mimeType} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--foreground)" }}>{f.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {f.type && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {f.type}
                      </span>
                    )}
                    {f.section && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {SECTION_LABELS[f.section] ?? f.section}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {formatBytes(f.size)} · {f.mimeType} · {new Date(f.createdAt).toLocaleDateString("el-GR")}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <a
                    href={f.cdnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="rounded-md p-1.5 hover:bg-[var(--muted)] transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Download className="size-3" />
                  </a>
                  <button
                    onClick={() => handleDeleteFile(f.id)}
                    disabled={deletingId === f.id}
                    className="rounded-md p-1.5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {deletingId === f.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                  </button>
                </div>
              </div>
            ))}

            {!filesLoading && (
              <button
                onClick={onUploadFiles}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-dashed border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Plus className="size-3" />
                Upload file
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

function DetailBlock({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-2 border-l-indigo-500/40 bg-indigo-500/[4%] px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 text-indigo-400/70 flex items-center gap-1">
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
  const [surveys,    setSurveys]    = useState(initialSurveys)
  const [total,      setTotal]      = useState(initialTotal)
  const [search,     setSearch]     = useState("")
  const [page,       setPage]       = useState(1)
  const [sortField,  setSortField]  = useState<SortField>("date")
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc")
  const [loading,    setLoading]    = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selected,   setSelected]   = useState<Set<number>>(new Set())
  const [deletingId,       setDeletingId]       = useState<number | null>(null)
  const [dialogOpen,       setDialogOpen]       = useState(false)
  const [editTarget,       setEditTarget]       = useState<SurveyTableRow | null>(null)
  const [surveyCustomer,   setSurveyCustomer]   = useState<SurveyCustomer | null>(null)
  const [fileUploadSurvey, setFileUploadSurvey] = useState<SurveyTableRow | null>(null)
  const [reportSurvey,     setReportSurvey]     = useState<SurveyTableRow | null>(null)
  // Incremented after each upload to signal ExpandedRow to reload files
  const [filesRefreshKeys, setFilesRefreshKeys] = useState<Record<number, number>>({})

  const [, startDelete]   = useTransition()
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

  const totalPages  = Math.max(1, Math.ceil(total / pageSize))
  const visibleDefs = COLUMNS.filter(c => visibleCols.has(c.key))
  // checkbox + chevron + cols + actions
  const COL_COUNT   = 1 + 1 + visibleDefs.length + 1

  // ─── Selection ────────────────────────────────────────────────────────────

  const pageIds = surveys.map(s => s.id)
  const allSel  = pageIds.length > 0 && pageIds.every(id => selected.has(id))
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
        q:      opts.q    ?? search,
        sort:   opts.sort ?? sortField,
        dir:    opts.dir  ?? sortDir,
        limit:  String(opts.limit ?? pageSize),
        offset: String(((opts.pg ?? page) - 1) * (opts.limit ?? pageSize)),
      })
      const res  = await fetch(`/api/site-surveys?${params}`)
      const data = await res.json()
      setSurveys(data.surveys.map((s: any) => ({
        ...s,
        date:      new Date(s.date).toISOString(),
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
        branchIds: s.branchIds  ?? [],
        sections:  s.sections   ?? [],
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
              {s.sections.map(sec => (
                <span key={sec} className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border", SECTION_BADGE_STYLES[sec] ?? "bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]")}>
                  {SECTION_ICONS[sec]}{SECTION_LABELS[sec] ?? sec}
                </span>
              ))}
            </div>
          </td>
        )
      case "status":
        return (
          <td key="status" className="px-3 py-3">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border", STATUS_STYLES[s.status] ?? STATUS_STYLES.DRAFT)}>
              {STATUS_LABELS[s.status] ?? s.status}
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
            placeholder="Search surveys, customers, surveyors…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-xs" style={{ color: "var(--muted-foreground)" }}>Clear</button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Column picker */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors" style={{ color: "var(--muted-foreground)" }}>
                <Columns3 className="size-3.5" /> Columns
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150">
                {COLUMNS.map(col => {
                  const isVisible = visibleCols.has(col.key)
                  const locked    = col.alwaysVisible
                  return (
                    <DropdownMenu.Item
                      key={col.key}
                      onSelect={e => { e.preventDefault(); if (!locked) toggleCol(col.key) }}
                      className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none transition-colors", locked ? "opacity-50 cursor-default" : "hover:bg-[var(--muted)]")}
                    >
                      <div className={cn("size-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors", isVisible ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]")}>
                        {isVisible && <Check className="size-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <span style={{ color: "var(--foreground)" }}>{col.label}</span>
                      {locked && <span className="text-[10px] ml-auto" style={{ color: "var(--muted-foreground)" }}>locked</span>}
                    </DropdownMenu.Item>
                  )
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <Btn size="sm" onClick={openNew}>
            <Plus className="size-3.5" /> New Survey
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
                      <span className="truncate">{col.label}</span>
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
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No surveys found</p>
                  </div>
                </td></tr>
              )}
              {!loading && surveys.map((s, i) => {
                const isSel   = selected.has(s.id)
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
                                <Pencil className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> Edit
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setReportSurvey(s)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <FileBarChart2 className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> View Report
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => { setFileUploadSurvey(s); setExpandedId(s.id) }}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Paperclip className="size-3.5" style={{ color: "var(--muted-foreground)" }} /> Upload Files
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                              <DropdownMenu.Item
                                onSelect={() => handleDelete(s.id)}
                                disabled={deletingId === s.id}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none text-[var(--destructive)] hover:bg-[var(--destructive)]/8 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <Trash2 className="size-3.5" /> Delete
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
            <span className="text-xs text-[var(--muted-foreground)]">Rows per page</span>
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
              {total === 0 ? "0 surveys" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </span>
            <div className="flex items-center gap-1">
              {([
                { icon: ChevronsLeft,     action: () => handlePage(1),          disabled: page <= 1 },
                { icon: ChevronLeft,      action: () => handlePage(page - 1),   disabled: page <= 1 },
                { icon: ChevronRightIcon, action: () => handlePage(page + 1),   disabled: page >= totalPages },
                { icon: ChevronsRight,    action: () => handlePage(totalPages), disabled: page >= totalPages },
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

      <FileUploadDialog
        open={!!fileUploadSurvey}
        onClose={() => setFileUploadSurvey(null)}
        uploadUrl={fileUploadSurvey ? `/api/site-surveys/${fileUploadSurvey.id}/files` : ""}
        title="Upload Survey Files"
        subtitle={fileUploadSurvey?.customer.name ?? undefined}
        sections={SURVEY_SECTION_OPTIONS}
        onUploaded={() => {
          if (fileUploadSurvey) {
            setFilesRefreshKeys(prev => ({ ...prev, [fileUploadSurvey.id]: (prev[fileUploadSurvey.id] ?? 0) + 1 }))
          }
        }}
      />
    </div>
  )
}
