"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, Loader2, Building2, User, Save, Trash2,
  Cpu, ClipboardList, Globe, ShieldCheck, Bot,
  Bold, Italic, Underline, List, ListOrdered, Plus,
  FileText, CheckCircle2, Clock, Send, XCircle,
  ChevronDown, Check, Sparkles, Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SurveyUser } from "./site-survey-dialog"
import type { SurveyTableRow } from "./site-surveys-table"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientRequirementRow {
  id: number
  surveyId: number
  section: string
  title: string
  description: string | null
  fileUrl: string | null
  fileName: string | null
}

interface ProposalData {
  id: number
  surveyId: number
  title: string
  description: string | null
  status: string
  assigneeIds: string[]
  responses: { requirementId: number; response: string | null }[]
  createdAt: string
  updatedAt: string
}

interface Props {
  open: boolean
  onClose: () => void
  survey: SurveyTableRow
  users: SurveyUser[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  HARDWARE_NETWORK: "Hardware & Network",
  SOFTWARE:         "Software",
  WEB_ECOMMERCE:    "Web & E-commerce",
  COMPLIANCE:       "Compliance",
  IOT_AI:           "IoT & AI",
}

const SECTION_ORDER = ["HARDWARE_NETWORK", "SOFTWARE", "WEB_ECOMMERCE", "COMPLIANCE", "IOT_AI"]

const SECTION_META: Record<string, { icon: React.ReactNode; badge: string; border: string; iconBg: string }> = {
  HARDWARE_NETWORK: {
    icon:   <Cpu          className="size-3" />,
    badge:  "bg-sky-500/10 text-sky-400 border-sky-500/20",
    border: "border-l-sky-400",
    iconBg: "bg-sky-500/10 border-sky-500/20 text-sky-400",
  },
  SOFTWARE: {
    icon:   <ClipboardList className="size-3" />,
    badge:  "bg-violet-500/10 text-violet-400 border-violet-500/20",
    border: "border-l-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  },
  WEB_ECOMMERCE: {
    icon:   <Globe        className="size-3" />,
    badge:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
    border: "border-l-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  },
  COMPLIANCE: {
    icon:   <ShieldCheck  className="size-3" />,
    badge:  "bg-rose-500/10 text-rose-400 border-rose-500/20",
    border: "border-l-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
  },
  IOT_AI: {
    icon:   <Bot          className="size-3" />,
    badge:  "bg-teal-500/10 text-teal-400 border-teal-500/20",
    border: "border-l-teal-400",
    iconBg: "bg-teal-500/10 border-teal-500/20 text-teal-400",
  },
}

const PROPOSAL_STATUSES = [
  { value: "DRAFT",    label: "Draft",    icon: <Clock className="size-3" />,       style: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  { value: "SENT",     label: "Sent",     icon: <Send className="size-3" />,        style: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  { value: "ACCEPTED", label: "Accepted", icon: <CheckCircle2 className="size-3" />, style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "REJECTED", label: "Rejected", icon: <XCircle className="size-3" />,    style: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
]

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

function RichToolbarBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className="size-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      {children}
    </button>
  )
}

function RichEditor({
  value,
  onChange,
  placeholder,
  minH = 100,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minH?: number
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastRef   = useRef(value)
  const [isEmpty, setIsEmpty] = useState(!value || value === "" || value === "<br>")

  useEffect(() => {
    if (editorRef.current && value !== lastRef.current) {
      editorRef.current.innerHTML = value
      lastRef.current = value
      setIsEmpty(!value || value === "" || value === "<br>")
    }
  }, [value])

  // Set initial content on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      lastRef.current = html
      setIsEmpty(html === "" || html === "<br>")
      onChange(html)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--input)] overflow-hidden focus-within:ring-1 focus-within:ring-[var(--ring)]">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[var(--border)] bg-[var(--muted)]/20">
        <RichToolbarBtn title="Bold" onClick={() => exec("bold")}>
          <Bold className="size-3" />
        </RichToolbarBtn>
        <RichToolbarBtn title="Italic" onClick={() => exec("italic")}>
          <Italic className="size-3" />
        </RichToolbarBtn>
        <RichToolbarBtn title="Underline" onClick={() => exec("underline")}>
          <Underline className="size-3" />
        </RichToolbarBtn>
        <div className="w-px h-3.5 mx-1 bg-[var(--border)]" />
        <RichToolbarBtn title="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <List className="size-3" />
        </RichToolbarBtn>
        <RichToolbarBtn title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="size-3" />
        </RichToolbarBtn>
      </div>
      {/* Editable area */}
      <div className="relative">
        {isEmpty && placeholder && (
          <span
            className="absolute top-2.5 left-3 text-[12px] pointer-events-none select-none"
            style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
          >
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            if (editorRef.current) {
              const html = editorRef.current.innerHTML
              lastRef.current = html
              setIsEmpty(html === "" || html === "<br>")
              onChange(html)
            }
          }}
          className={cn(
            "px-3 py-2.5 text-[13px] outline-none leading-relaxed bg-[var(--background)]",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline",
          )}
          style={{ minHeight: minH, color: "var(--foreground)" }}
        />
      </div>
    </div>
  )
}

// ─── Assignee Selector ────────────────────────────────────────────────────────

function AssigneeSelector({
  users,
  selected,
  onChange,
}: {
  users: SurveyUser[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const selectedUsers = users.filter(u => selected.includes(u.id))

  return (
    <div ref={dropRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] transition-colors",
          "border-[var(--input)] bg-[var(--background)] hover:bg-[var(--muted)]/40 text-left",
          open && "ring-1 ring-[var(--ring)]",
        )}
      >
        {selectedUsers.length === 0 ? (
          <span style={{ color: "var(--muted-foreground)" }}>Select assignees…</span>
        ) : (
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedUsers.map(u => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 text-[11px] font-medium"
              >
                <User className="size-2.5" />
                {u.name ?? u.email}
              </span>
            ))}
          </div>
        )}
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform ml-auto", open && "rotate-180")} style={{ color: "var(--muted-foreground)" }} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
          {users.map(u => {
            const checked = selected.includes(u.id)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-[var(--muted)] transition-colors text-left"
              >
                <div className={cn(
                  "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  checked ? "bg-indigo-600 border-indigo-600" : "border-[var(--input)]",
                )}>
                  {checked && <Check className="size-2.5 text-white" />}
                </div>
                <span style={{ color: "var(--foreground)" }}>{u.name ?? u.email}</span>
                <span className="text-[10px] ml-auto" style={{ color: "var(--muted-foreground)" }}>{u.email}</span>
              </button>
            )
          })}
          {users.length === 0 && (
            <p className="px-3 py-2.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>No users found</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SurveyProposalModal({ open, onClose, survey, users }: Props) {
  const [loadingData,      setLoadingData]      = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [deleting,         setDeleting]         = useState(false)
  const [exporting,        setExporting]        = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const [generatingDesc,   setGeneratingDesc]   = useState(false)
  const [generatingReqId,  setGeneratingReqId]  = useState<number | null>(null)

  const [existingId,   setExistingId]   = useState<number | null>(null)
  const [title,        setTitle]        = useState("")
  const [description,  setDescription]  = useState("")
  const [status,       setStatus]       = useState("DRAFT")
  const [assigneeIds,  setAssigneeIds]  = useState<string[]>([])
  const [requirements, setRequirements] = useState<ClientRequirementRow[]>([])
  const [responses,    setResponses]    = useState<Record<number, string>>({})

  // ── Load data when modal opens ──────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const [reqRes, propRes] = await Promise.all([
        fetch(`/api/site-surveys/${survey.id}/requirements`),
        fetch(`/api/site-surveys/${survey.id}/proposals`),
      ])

      if (reqRes.ok) {
        const reqs = await reqRes.json() as ClientRequirementRow[]
        setRequirements(Array.isArray(reqs) ? reqs : [])
      }

      if (propRes.ok) {
        const proposal = await propRes.json() as ProposalData | null
        if (proposal) {
          setExistingId(proposal.id)
          setTitle(proposal.title)
          setDescription(proposal.description ?? "")
          setStatus(proposal.status)
          setAssigneeIds(proposal.assigneeIds ?? [])
          const responseMap: Record<number, string> = {}
          for (const r of (proposal.responses ?? [])) {
            responseMap[r.requirementId] = r.response ?? ""
          }
          setResponses(responseMap)
        } else {
          // No proposal yet — reset to defaults
          setExistingId(null)
          setTitle(`Proposal for ${survey.name}`)
          setDescription("")
          setStatus("DRAFT")
          setAssigneeIds([survey.surveyorId])
          setResponses({})
        }
      }
    } catch {
      setError("Failed to load proposal data")
    } finally {
      setLoadingData(false)
    }
  }, [survey.id, survey.name, survey.surveyorId])

  useEffect(() => {
    if (open) loadData()
  }, [open, loadData])

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("Title is required"); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        title: title.trim(),
        description: description || null,
        status,
        assigneeIds,
        responses: Object.entries(responses).map(([reqId, response]) => ({
          requirementId: parseInt(reqId, 10),
          response,
        })),
      }
      const res = await fetch(`/api/site-surveys/${survey.id}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Failed to save")
        return
      }
      const saved = await res.json() as ProposalData
      setExistingId(saved.id)
      onClose()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  // ── Export Word ─────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/site-surveys/${survey.id}/proposals/export`)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Export failed")
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      const disp = res.headers.get("Content-Disposition") ?? ""
      const name = disp.match(/filename="([^"]+)"/)?.[1] ?? "proposal.docx"
      a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Export failed — please try again")
    } finally {
      setExporting(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!existingId) return
    if (!confirm("Delete this proposal? This cannot be undone.")) return
    setDeleting(true)
    try {
      await fetch(`/api/site-surveys/${survey.id}/proposals`, { method: "DELETE" })
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  // ── AI generation ────────────────────────────────────────────────────────────

  async function generateDescription() {
    setGeneratingDesc(true)
    setError(null)
    try {
      // Strip HTML tags for plain-text context sent to the AI
      const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

      const requirementsWithResponses = requirements.map(r => ({
        section:     r.section,
        title:       r.title,
        description: r.description ?? "",
        response:    stripHtml(responses[r.id] ?? ""),
      }))

      const res = await fetch("/api/ai/generate-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:                    "description",
          surveyName:              survey.name,
          customerName:            survey.customer.name ?? "",
          sections:                survey.sections,
          requirementsWithResponses,
          existingDescription:     stripHtml(description),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "AI generation failed"); return }
      setDescription(data.text ?? "")
    } catch {
      setError("AI generation failed")
    } finally {
      setGeneratingDesc(false)
    }
  }

  async function generateResponse(req: ClientRequirementRow) {
    setGeneratingReqId(req.id)
    setError(null)
    try {
      const res = await fetch("/api/ai/generate-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:                   "response",
          section:                req.section,
          requirementTitle:       req.title,
          requirementDescription: req.description ?? "",
          existingResponse:       responses[req.id] ?? "",
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "AI generation failed"); return }
      setResponses(prev => ({ ...prev, [req.id]: data.text ?? "" }))
    } catch {
      setError("AI generation failed")
    } finally {
      setGeneratingReqId(null)
    }
  }

  // ── Grouped requirements ────────────────────────────────────────────────────

  const grouped = React.useMemo(() => {
    const map: Record<string, ClientRequirementRow[]> = {}
    for (const r of requirements) {
      if (!map[r.section]) map[r.section] = []
      map[r.section].push(r)
    }
    return map
  }, [requirements])

  const activeSections = SECTION_ORDER.filter(s => grouped[s]?.length)
  const currentStatus  = PROPOSAL_STATUSES.find(s => s.value === status) ?? PROPOSAL_STATUSES[0]

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-3xl border-l border-[var(--border)] bg-[var(--background)] shadow-2xl animate-in slide-in-from-right duration-300 focus:outline-none"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">
            {existingId ? "Edit Proposal" : "New Proposal"}
          </Dialog.Title>
          <form onSubmit={handleSave} className="flex flex-col h-full">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText className="size-4 text-indigo-400 shrink-0" />
                  <h2 className="text-[15px] font-bold truncate" style={{ color: "var(--foreground)" }}>
                    {existingId ? "Edit Proposal" : "New Proposal"}
                  </h2>
                  {existingId && (
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", currentStatus.style)}>
                      {currentStatus.icon}
                      {currentStatus.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3" />
                    {survey.customer.name ?? `#${survey.customer.id}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="size-3" />
                    {survey.name}
                  </span>
                </div>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--muted)] shrink-0" style={{ color: "var(--muted-foreground)" }}>
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto">
              {loadingData ? (
                <div className="flex items-center justify-center gap-2 h-40 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="px-6 py-5 space-y-6">

                  {/* ── Metadata strip ── */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    {/* Title */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                        Proposal Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Enter proposal title…"
                        required
                        className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-[var(--ring)] transition"
                        style={{ color: "var(--foreground)" }}
                      />
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                        Status
                      </label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-[var(--ring)] transition"
                        style={{ color: "var(--foreground)" }}
                      >
                        {PROPOSAL_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Assignees */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                        Assignees
                      </label>
                      <AssigneeSelector users={users} selected={assigneeIds} onChange={setAssigneeIds} />
                    </div>
                  </div>

                  {/* ── Description ── */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                        Proposal Description
                      </label>
                      <button
                        type="button"
                        onClick={generateDescription}
                        disabled={generatingDesc}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {generatingDesc
                          ? <Loader2 className="size-3 animate-spin" />
                          : <Sparkles className="size-3" />}
                        {generatingDesc ? "Generating…" : "AI Generate"}
                      </button>
                    </div>
                    <RichEditor
                      value={description}
                      onChange={setDescription}
                      placeholder="Write a proposal overview, scope, approach, pricing notes…"
                      minH={140}
                    />
                  </div>

                  {/* ── Requirement Responses ── */}
                  {activeSections.length > 0 && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-[var(--border)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest px-2" style={{ color: "var(--muted-foreground)" }}>
                          Requirement Responses ({requirements.length})
                        </span>
                        <div className="h-px flex-1 bg-[var(--border)]" />
                      </div>

                      {activeSections.map(sec => {
                        const meta = SECTION_META[sec] ?? SECTION_META.SOFTWARE
                        return (
                          <div key={sec} className="space-y-3">
                            {/* Section header */}
                            <div className="flex items-center gap-2">
                              <div className={cn("size-5 rounded-md border flex items-center justify-center shrink-0", meta.iconBg)}>
                                {meta.icon}
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                                {SECTION_LABELS[sec]}
                              </span>
                              <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border tabular-nums", meta.badge)}>
                                {grouped[sec].length}
                              </span>
                            </div>

                            {/* Requirement cards */}
                            <div className="space-y-3 pl-1">
                              {grouped[sec].map((req, idx) => (
                                <div
                                  key={req.id}
                                  className={cn(
                                    "rounded-xl border border-[var(--border)] border-l-[3px] bg-[var(--card)] p-4 space-y-3",
                                    meta.border,
                                  )}
                                >
                                  {/* Requirement info */}
                                  <div className="flex items-start gap-2.5">
                                    <span className={cn("size-5 rounded-full border flex items-center justify-center shrink-0 text-[9px] font-black tabular-nums mt-0.5", meta.badge)}>
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                                        {req.title}
                                      </p>
                                      {req.description && (
                                        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                                          {req.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Response field */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                                        <Plus className="size-3" /> Our Response
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => generateResponse(req)}
                                        disabled={generatingReqId === req.id || generatingDesc}
                                        className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                      >
                                        {generatingReqId === req.id
                                          ? <Loader2 className="size-2.5 animate-spin" />
                                          : <Sparkles className="size-2.5" />}
                                        {generatingReqId === req.id ? "Generating…" : "AI"}
                                      </button>
                                    </div>
                                    <RichEditor
                                      value={responses[req.id] ?? ""}
                                      onChange={v => setResponses(prev => ({ ...prev, [req.id]: v }))}
                                      placeholder="Describe how you will address this requirement…"
                                      minH={80}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Empty requirements state */}
                  {activeSections.length === 0 && !loadingData && (
                    <div className="flex flex-col items-center gap-2 py-8 rounded-2xl border border-dashed border-[var(--border)]">
                      <div className="size-9 rounded-xl bg-zinc-500/10 border border-zinc-500/20 flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
                        <ClipboardList className="size-4.5" />
                      </div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                        No client requirements found for this survey
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
                        Add requirements from the Requirements tab first
                      </p>
                    </div>
                  )}

                  {error && (
                    <p className="text-[12px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--card)] shrink-0">
              <div>
                {existingId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--destructive)]/30 px-3.5 py-2 text-[12px] font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/8 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {existingId && (
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    {exporting ? "Exporting…" : "Download Word"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[var(--input)] bg-[var(--background)] px-4 py-2 text-[12px] font-semibold transition-colors hover:bg-[var(--muted)]"
                  style={{ color: "var(--foreground)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingData}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-[12px] font-semibold text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  {existingId ? "Save Changes" : "Create Proposal"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
