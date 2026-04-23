"use client"

import React, { useState, useCallback, useTransition } from "react"
import {
  FolderKanban, Plus, Search, Pencil, Trash2, Loader2,
  ChevronRight, MoreHorizontal, Sparkles, FileText,
  Cpu, ClipboardList, Globe, ShieldCheck, Bot,
  Building2, Calendar, ListChecks, X, Check,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ProjectDialog, type ProjectRow } from "./project-dialog"
import { AiAnalysisDialog } from "./ai-analysis-dialog"
import { SurveyProposalModal } from "./survey-proposal-modal"
import type { SurveyTableRow } from "./site-surveys-table"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequirementRow {
  id: number
  surveyId: number
  section: string
  source: string
  title: string
  description: string | null
}

interface Props {
  projects: SurveyTableRow[]
  users: { id: string; name: string | null; email: string }[]
  customerOptions: { id: number; name: string | null }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  hardware_network: <Cpu className="size-3" strokeWidth={1.5} />,
  software:         <ClipboardList className="size-3" strokeWidth={1.5} />,
  web_ecommerce:    <Globe className="size-3" strokeWidth={1.5} />,
  compliance:       <ShieldCheck className="size-3" strokeWidth={1.5} />,
  iot_ai:           <Bot className="size-3" strokeWidth={1.5} />,
}

const SECTION_BADGE: Record<string, string> = {
  hardware_network: "bg-sky-950/70 text-sky-300 border-sky-800/50",
  software:         "bg-violet-950/70 text-violet-300 border-violet-800/50",
  web_ecommerce:    "bg-blue-950/70 text-blue-300 border-blue-800/50",
  compliance:       "bg-rose-950/70 text-rose-300 border-rose-800/50",
  iot_ai:           "bg-teal-950/70 text-teal-300 border-teal-800/50",
}

const SECTION_LABELS: Record<string, string> = {
  hardware_network: "Υποδομή & Δίκτυα",
  software:         "Λογισμικό",
  web_ecommerce:    "Web & E-commerce",
  compliance:       "Συμμόρφωση",
  iot_ai:           "IoT & AI",
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT:       "bg-zinc-800/60 text-zinc-300 border-zinc-700/50",
  IN_PROGRESS: "bg-blue-950/60 text-blue-300 border-blue-800/50",
  COMPLETED:   "bg-emerald-950/60 text-emerald-300 border-emerald-800/50",
  CANCELLED:   "bg-red-950/60 text-red-300 border-red-800/50",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:       "Πρόχειρο",
  IN_PROGRESS: "Σε εξέλιξη",
  COMPLETED:   "Ολοκληρώθηκε",
  CANCELLED:   "Ακυρώθηκε",
}

// ─── SectionBadges ────────────────────────────────────────────────────────────

function SectionBadges({ sections }: { sections: string[] }) {
  if (sections.length === 0) {
    return <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>—</span>
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {sections.map((s) => (
        <span
          key={s}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
            SECTION_BADGE[s] ?? "bg-zinc-800 text-zinc-300 border-zinc-700"
          )}
        >
          {SECTION_ICONS[s]}
          {SECTION_LABELS[s] ?? s}
        </span>
      ))}
    </div>
  )
}

// ─── RequirementPanel ─────────────────────────────────────────────────────────

function RequirementsPanel({ projectId }: { projectId: number }) {
  const [reqs, setReqs]         = useState<RequirementRow[] | null>(null)
  const [loading, setLoading]   = useState(false)
  const [addMode, setAddMode]   = useState<"CUSTOMER" | "COMPANY" | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc,  setNewDesc]  = useState("")
  const [newSection, setNewSection] = useState("hardware_network")
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/site-surveys/${projectId}/requirements`)
      if (res.ok) {
        const data = await res.json()
        setReqs(data.requirements ?? data)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId])

  React.useEffect(() => { load() }, [load])

  const customerReqs = (reqs ?? []).filter((r) => r.source === "CUSTOMER")
  const companyReqs  = (reqs ?? []).filter((r) => r.source === "COMPANY")

  async function addReq(source: "CUSTOMER" | "COMPANY") {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const sectionEnum: Record<string, string> = {
        hardware_network: "HARDWARE_NETWORK",
        software: "SOFTWARE",
        web_ecommerce: "WEB_ECOMMERCE",
        compliance: "COMPLIANCE",
        iot_ai: "IOT_AI",
      }
      await fetch(`/api/site-surveys/${projectId}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: sectionEnum[newSection] ?? "HARDWARE_NETWORK",
          source,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
        }),
      })
      setNewTitle("")
      setNewDesc("")
      setAddMode(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deleteReq(id: number) {
    await fetch(`/api/site-surveys/${projectId}/requirements/${id}`, { method: "DELETE" })
    await load()
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid var(--border)",
    borderRadius: 5,
    padding: "5px 8px",
    fontSize: 12,
    color: "var(--foreground)",
    outline: "none",
    width: "100%",
  }

  function ReqList({ items, label }: { items: RequirementRow[]; label: string }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          {label}
        </p>
        {items.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", fontStyle: "italic" }}>Κανένα στοιχείο</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>{r.title}</p>
                  {r.description && (
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0" }}>{r.description}</p>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                      SECTION_BADGE[
                        Object.entries({ HARDWARE_NETWORK: "hardware_network", SOFTWARE: "software", WEB_ECOMMERCE: "web_ecommerce", COMPLIANCE: "compliance", IOT_AI: "iot_ai" })
                          .find(([k]) => k === r.section)?.[1] ?? "hardware_network"
                      ] ?? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    )}
                  >
                    {SECTION_LABELS[
                      Object.entries({ HARDWARE_NETWORK: "hardware_network", SOFTWARE: "software", WEB_ECOMMERCE: "web_ecommerce", COMPLIANCE: "compliance", IOT_AI: "iot_ai" })
                        .find(([k]) => k === r.section)?.[1] ?? "hardware_network"
                    ] ?? r.section}
                  </span>
                </div>
                <button
                  onClick={() => deleteReq(r.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 2, flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171" }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)" }}
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: "20px 0", display: "flex", justifyContent: "center" }}>
        <Loader2 className="size-4 animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    )
  }

  return (
    <div>
      <ReqList items={customerReqs} label="Απαιτήσεις Πελάτη" />
      <ReqList items={companyReqs} label="Προτάσεις Εταιρείας" />

      {/* Add form */}
      {addMode ? (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 12px",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 8 }}>
            {addMode === "CUSTOMER" ? "+ Απαίτηση Πελάτη" : "+ Πρόταση Εταιρείας"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              style={{ ...inputStyle }}
            >
              {Object.entries(SECTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              autoFocus
              placeholder="Τίτλος…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="Περιγραφή (προαιρετικό)…"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => { setAddMode(null); setNewTitle(""); setNewDesc("") }}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}
              >
                Ακύρωση
              </button>
              <button
                onClick={() => addReq(addMode)}
                disabled={saving || !newTitle.trim()}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 5, border: "none", background: "#0078D4", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: saving ? 0.7 : 1 }}
              >
                {saving && <Loader2 className="size-3 animate-spin" />}
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={() => setAddMode("CUSTOMER")}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Plus className="size-3" strokeWidth={2} />
            Απαίτηση Πελάτη
          </button>
          <button
            onClick={() => setAddMode("COMPANY")}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Plus className="size-3" strokeWidth={2} />
            Πρόταση Εταιρείας
          </button>
        </div>
      )}
    </div>
  )
}

// ─── ProjectRow component ─────────────────────────────────────────────────────

function ProjectTableRow({
  project,
  users,
  customerOptions,
  onEdit,
  onDelete,
  onAiAnalysis,
  onProposal,
}: {
  project: SurveyTableRow
  users: { id: string; name: string | null; email: string }[]
  customerOptions: { id: number; name: string | null }[]
  onEdit: (p: SurveyTableRow) => void
  onDelete: (id: number) => void
  onAiAnalysis: (p: SurveyTableRow) => void
  onProposal: (p: SurveyTableRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<"requirements" | "proposal">("requirements")

  const statusLabel = STATUS_LABELS[project.status] ?? project.status
  const statusClass = STATUS_STYLES[project.status] ?? "bg-zinc-800 text-zinc-300 border-zinc-700/50"

  return (
    <>
      <tr
        style={{
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
          transition: "background 80ms",
        }}
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
      >
        {/* Expand indicator */}
        <td style={{ width: 36, paddingLeft: 12, verticalAlign: "middle" }}>
          <ChevronRight
            className="size-3.5"
            strokeWidth={1.5}
            style={{
              color: "var(--muted-foreground)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 180ms",
            }}
          />
        </td>

        {/* Name + description */}
        <td style={{ padding: "10px 12px", verticalAlign: "middle", minWidth: 200 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>
            {project.name}
          </p>
          {project.description && (
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
              {project.description}
            </p>
          )}
        </td>

        {/* Customer */}
        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 className="size-3.5 flex-shrink-0" strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {project.customer.name ?? `#${project.customer.id}`}
            </span>
          </div>
        </td>

        {/* Sections */}
        <td style={{ padding: "10px 12px", verticalAlign: "middle", minWidth: 180 }}>
          <SectionBadges sections={project.sections} />
        </td>

        {/* Status */}
        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", statusClass)}>
            {statusLabel}
          </span>
        </td>

        {/* Created */}
        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {new Date(project.createdAt).toLocaleDateString("el-GR")}
          </span>
        </td>

        {/* Actions */}
        <td style={{ padding: "10px 12px", verticalAlign: "middle" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              title="AI Ανάλυση"
              onClick={() => onAiAnalysis(project)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "4px 6px", borderRadius: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#a78bfa"; e.currentTarget.style.background = "rgba(167,139,250,0.08)" }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.background = "none" }}
            >
              <Sparkles className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              title="Πρόταση"
              onClick={() => onProposal(project)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "4px 6px", borderRadius: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#60a5fa"; e.currentTarget.style.background = "rgba(96,165,250,0.08)" }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.background = "none" }}
            >
              <FileText className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              title="Επεξεργασία"
              onClick={() => onEdit(project)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "4px 6px", borderRadius: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)" }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.background = "none" }}
            >
              <Pencil className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              title="Διαγραφή"
              onClick={() => onDelete(project.id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "4px 6px", borderRadius: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(248,113,113,0.08)" }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.background = "none" }}
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0, background: "rgba(255,255,255,0.015)" }}>
            <div style={{ padding: "16px 48px 20px", borderBottom: "1px solid var(--border)" }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
                {(["requirements", "proposal"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: activeTab === tab ? "2px solid #0078D4" : "2px solid transparent",
                      cursor: "pointer",
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: activeTab === tab ? 600 : 400,
                      color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                      marginBottom: -1,
                    }}
                  >
                    {tab === "requirements" ? "Απαιτήσεις & Προτάσεις" : "Πρόταση"}
                  </button>
                ))}
              </div>

              {activeTab === "requirements" && (
                <RequirementsPanel projectId={project.id} />
              )}

              {activeTab === "proposal" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
                    Ανοίξτε το παράθυρο πρότασης για να δείτε ή να επεξεργαστείτε την πρόταση.
                  </p>
                  <button
                    onClick={() => onProposal(project)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 14px",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: 6,
                      border: "1px solid #0078D4",
                      background: "rgba(0,120,212,0.10)",
                      color: "#60b0f8",
                      cursor: "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    <FileText className="size-3.5" strokeWidth={1.5} />
                    Άνοιγμα Πρότασης
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── ProjectsTable ────────────────────────────────────────────────────────────

export function ProjectsTable({ projects: initialProjects, users, customerOptions }: Props) {
  const [projects, setProjects] = useState<SurveyTableRow[]>(initialProjects)
  const [search, setSearch]     = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<SurveyTableRow | null>(null)
  const [aiProject, setAiProject]     = useState<SurveyTableRow | null>(null)
  const [proposalProject, setProposalProject] = useState<SurveyTableRow | null>(null)
  const [isPending, startTransition]  = useTransition()

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.customer.name ?? "").toLowerCase().includes(q)
    )
  })

  function handleNew() {
    setEditingProject(null)
    setDialogOpen(true)
  }

  function handleEdit(p: SurveyTableRow) {
    setEditingProject(p)
    setDialogOpen(true)
  }

  function handleDelete(id: number) {
    if (!confirm("Διαγραφή αυτού του έργου;")) return
    startTransition(async () => {
      await fetch(`/api/site-surveys/${id}`, { method: "DELETE" })
      setProjects((prev) => prev.filter((p) => p.id !== id))
    })
  }

  async function handleSaved() {
    // Refresh from server
    const res = await fetch("/api/site-surveys?type=PROJECT&limit=200")
    if (res.ok) {
      const data = await res.json()
      setProjects(
        (data.surveys ?? []).map((s: Record<string, unknown>) => ({
          ...s,
          date: s.date,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          branchIds: (s.branchIds as number[]) ?? [],
          sections: (s.sections as string[]) ?? [],
          invitations: [],
        }))
      )
    }
  }

  // Build ProjectRow from SurveyTableRow for the dialog
  const editingProjectRow = editingProject
    ? {
        id: editingProject.id,
        name: editingProject.name,
        description: editingProject.description,
        customerId: editingProject.customerId,
        sections: editingProject.sections,
        status: editingProject.status,
        type: "PROJECT",
        createdAt: editingProject.createdAt,
        updatedAt: editingProject.updatedAt,
        customer: editingProject.customer,
      }
    : null

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search
            className="size-3.5"
            strokeWidth={1.5}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Αναζήτηση έργων…"
            style={{
              background: "var(--input)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "7px 10px 7px 30px",
              fontSize: 13,
              color: "var(--foreground)",
              width: "100%",
              outline: "none",
            }}
          />
        </div>

        <button
          onClick={handleNew}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            border: "none",
            background: "#0078D4",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Νέο Έργο
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ width: 36 }} />
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Έργο</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Πελάτης</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ενότητες</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Κατάσταση</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Δημιουργήθηκε</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <FolderKanban className="size-8 mx-auto mb-3" strokeWidth={1} style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                    {search ? "Δεν βρέθηκαν έργα" : "Δεν υπάρχουν έργα ακόμα"}
                  </p>
                </td>
              </tr>
            ) : filtered.map((project) => (
              <ProjectTableRow
                key={project.id}
                project={project}
                users={users}
                customerOptions={customerOptions}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAiAnalysis={setAiProject}
                onProposal={setProposalProject}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        project={editingProjectRow}
        users={users}
        customerOptions={customerOptions}
        onSaved={handleSaved}
      />

      {aiProject && (
        <AiAnalysisDialog
          surveyId={aiProject.id}
          surveyName={aiProject.name}
          customerName={aiProject.customer.name ?? ""}
          sections={aiProject.sections.length > 0 ? aiProject.sections : ["hardware_network", "software", "web_ecommerce", "compliance", "iot_ai"]}
          onClose={() => setAiProject(null)}
          onProposalCreated={() => { setAiProject(null) }}
        />
      )}

      {proposalProject && (
        <SurveyProposalModal
          open={Boolean(proposalProject)}
          onClose={() => setProposalProject(null)}
          survey={proposalProject}
          users={users}
        />
      )}
    </div>
  )
}
