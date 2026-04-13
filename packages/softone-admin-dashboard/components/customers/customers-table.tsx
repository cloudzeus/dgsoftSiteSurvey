"use client"

import React, { useState, useCallback, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
  Plus, RefreshCw, Search, Loader2, CheckCircle2, XCircle,
  ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown,
  Columns3, Check, ChevronLeft, ChevronsLeft, ChevronsRight,
  MoreHorizontal, Pencil, Trash2, Tag, MapPin, Users, X, Save, Building2, ExternalLink,
  Paperclip, FileText, FileImage, File as FileIcon, Download, ClipboardList,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { useTablePrefs, PAGE_SIZES, type ColDef } from "@/hooks/use-table-prefs"
import { CustomerDialog, type CustomerRow, type Country, type JobType, type TrdBusiness, type TrdGroup } from "./customer-dialog"
import { BranchDialog, type TrdBranchRow } from "./branch-dialog"
import { CustomerFileUploadDialog } from "./customer-file-upload-dialog"
import { saveCustomerKads, saveCustomerGeodata } from "@/app/actions/aeede"
import { syncCustomerBranches, syncAllCustomerBranches } from "@/app/actions/branches"
import { SiteSurveyDialog, type SurveyUser, type SurveyCustomer } from "@/components/site-survey/site-survey-dialog"
import dynamic from "next/dynamic"

const AddressMap = dynamic(
  () => import("../aeede/address-map").then((m) => m.AddressMap),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center rounded-xl" style={{ background: "var(--muted)" }}>
      <Loader2 className="size-4 animate-spin" style={{ color: "var(--muted-foreground)" }} />
    </div>
  )},
)

// ─── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: "name",    label: "Name",     sortable: true,  defaultVisible: true,  alwaysVisible: true  },
  { key: "afm",     label: "AFM",      sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "city",    label: "City",     sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "phone01", label: "Phone",    sortable: false, defaultVisible: true,  alwaysVisible: false },
  { key: "email",   label: "Email",    sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "isprosp", label: "Type",     sortable: true,  defaultVisible: true,  alwaysVisible: false },
  { key: "trdr",    label: "TRDR",     sortable: true,  defaultVisible: false, alwaysVisible: false },
  { key: "address", label: "Address",  sortable: false, defaultVisible: false, alwaysVisible: false },
  { key: "zip",     label: "ZIP",      sortable: false, defaultVisible: false, alwaysVisible: false },
  { key: "country", label: "Country",  sortable: false, defaultVisible: false, alwaysVisible: false },
  { key: "insdate", label: "Created",  sortable: true,  defaultVisible: false, alwaysVisible: false },
  { key: "upddate", label: "Updated",  sortable: true,  defaultVisible: false, alwaysVisible: false },
]

const DEFAULT_WIDTHS: Record<string, number> = {
  name: 220, afm: 110, city: 120, phone01: 130, email: 180,
  isprosp: 100, trdr: 70, address: 180, zip: 80, country: 80,
  insdate: 110, upddate: 110,
}

type SortField = "trdr" | "name" | "afm" | "city" | "email" | "isprosp" | "insdate" | "upddate"

// ─── Sub-components ────────────────────────────────────────────────────────────

const BADGE_COLORS = [
  "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  "bg-violet-500/15 text-violet-400 border-violet-500/25",
  "bg-sky-500/15 text-sky-400 border-sky-500/25",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "bg-rose-500/15 text-rose-400 border-rose-500/25",
  "bg-amber-500/15 text-amber-400 border-amber-500/25",
  "bg-teal-500/15 text-teal-400 border-teal-500/25",
] as const

function badgeColor(label: string) {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return BADGE_COLORS[h % BADGE_COLORS.length]
}

function DetailRow({ label, value, badge, mono }: { label: string; value: string | number | boolean | null | undefined; badge?: boolean; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-dotted border-[var(--border)]/60 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
        {label}
      </span>
      {badge ? (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0", badgeColor(label))}>
          {String(value)}
        </span>
      ) : (
        <span className={cn("text-[12px] text-right", mono ? "font-mono" : "font-medium")} style={{ color: "var(--foreground)" }}>
          {String(value)}
        </span>
      )}
    </div>
  )
}

const SECTION_STYLES: Record<string, { border: string; bg: string; title: string }> = {
  violet:  { border: "border-l-violet-500/40",  bg: "bg-violet-500/[4%]",  title: "text-violet-400/70"  },
  indigo:  { border: "border-l-indigo-500/40",  bg: "bg-indigo-500/[4%]",  title: "text-indigo-400/70"  },
  emerald: { border: "border-l-emerald-500/40", bg: "bg-emerald-500/[4%]", title: "text-emerald-400/70" },
  sky:     { border: "border-l-sky-500/40",     bg: "bg-sky-500/[4%]",     title: "text-sky-400/70"     },
  amber:   { border: "border-l-amber-500/40",   bg: "bg-amber-500/[4%]",   title: "text-amber-400/70"   },
  rose:    { border: "border-l-rose-500/40",    bg: "bg-rose-500/[4%]",    title: "text-rose-400/70"    },
}

function Section({ accent, title, children }: { accent: keyof typeof SECTION_STYLES; title: string; children: React.ReactNode }) {
  const s = SECTION_STYLES[accent] ?? SECTION_STYLES.indigo!
  return (
    <div className={cn("rounded-xl border-l-2 px-3 py-2.5", s.border, s.bg)}>
      <p className={cn("text-[9px] font-black uppercase tracking-widest mb-2", s.title)}>{title}</p>
      {children}
    </div>
  )
}

function countryName(id: number | null, countries: Country[]): string | null {
  if (id == null) return null
  return countries.find((c) => c.id === id)?.name ?? String(id)
}

function jobtypeName(id: number | null, jobtypes: JobType[]): string | null {
  if (id == null) return null
  return jobtypes.find((j) => j.id === id)?.name ?? String(id)
}

function trdBusinessName(id: number | null, businesses: TrdBusiness[]): string | null {
  if (id == null) return null
  return businesses.find((b) => b.id === id)?.name ?? String(id)
}

function trdGroupName(id: number | null, groups: TrdGroup[]): string | null {
  if (id == null) return null
  return groups.find((g) => g.id === id)?.name ?? String(id)
}

type CompanyKadRow = { id: number; kadCode: string; kadDescription: string; kadType: string }

type CustomerFileRow = {
  id: number; customerId: number; surveyId: number | null
  section: string | null; type: string | null
  name: string; cdnUrl: string; mimeType: string; size: number
  uploadedBy: string | null; createdAt: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))       return <FileImage className="size-4 text-sky-400" />
  if (mimeType === "application/pdf")      return <FileText  className="size-4 text-rose-400" />
  if (mimeType.startsWith("text/"))        return <FileText  className="size-4 text-amber-400" />
  return <FileIcon className="size-4" style={{ color: "var(--muted-foreground)" }} />
}

type ContactRow = {
  id: number; customerId: number
  name: string | null; position: string | null; email: string | null
  phone: string | null; mobile: string | null; address: string | null
  zip: string | null; city: string | null; country: string | null; remarks: string | null
}

type ContactFormData = Omit<ContactRow, "id" | "customerId">

const EMPTY_CONTACT: ContactFormData = { name: "", position: "", email: "", phone: "", mobile: "", address: "", zip: "", city: "", country: "", remarks: "" }

function ContactForm({ initial, onSave, onCancel, saving }: {
  initial: ContactFormData
  onSave: (data: ContactFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<ContactFormData>(initial)
  const set = (k: keyof ContactFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const fieldCls = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-500/60 placeholder:text-[var(--muted-foreground)]/50"

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Name</label>
          <input className={fieldCls} value={form.name ?? ""} onChange={set("name")} placeholder="Full name" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Position</label>
          <input className={fieldCls} value={form.position ?? ""} onChange={set("position")} placeholder="Job title" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Email</label>
          <input className={fieldCls} type="email" value={form.email ?? ""} onChange={set("email")} placeholder="email@example.com" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Phone</label>
          <input className={fieldCls} value={form.phone ?? ""} onChange={set("phone")} placeholder="+30 210..." />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Mobile</label>
          <input className={fieldCls} value={form.mobile ?? ""} onChange={set("mobile")} placeholder="+30 69..." />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Address</label>
          <input className={fieldCls} value={form.address ?? ""} onChange={set("address")} placeholder="Street" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>ZIP</label>
          <input className={fieldCls} value={form.zip ?? ""} onChange={set("zip")} placeholder="ZIP" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>City</label>
          <input className={fieldCls} value={form.city ?? ""} onChange={set("city")} placeholder="City" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Country</label>
          <input className={fieldCls} value={form.country ?? ""} onChange={set("country")} placeholder="Country" />
        </div>
        <div className="space-y-1 col-span-2 lg:col-span-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Remarks</label>
          <textarea className={cn(fieldCls, "resize-none")} rows={2} value={form.remarks ?? ""} onChange={set("remarks")} placeholder="Notes…" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
          style={{ color: "var(--muted-foreground)" }}
        >
          <X className="size-3" />
          Cancel
        </button>
      </div>
    </div>
  )
}

function ExpandedRow({ c, colSpan, countries, jobtypes, businesses, trdgroups, branchRefreshKey, fileRefreshKey, onAddBranch, onEditBranch, onAddFile }: {
  c: CustomerRow; colSpan: number; countries: Country[]; jobtypes: JobType[]; businesses: TrdBusiness[]; trdgroups: TrdGroup[]
  branchRefreshKey: number
  fileRefreshKey: number
  onAddBranch: () => void
  onEditBranch: (b: TrdBranchRow) => void
  onAddFile: () => void
}) {
  const [tab, setTab]   = useState<"details" | "contacts" | "kad" | "map" | "branches" | "files">("details")
  const [kads, setKads] = useState<CompanyKadRow[] | null>(null)
  const [kadLoading, setKadLoading] = useState(false)

  // Branches state
  const [branches,        setBranches]        = useState<TrdBranchRow[] | null>(null)
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [deletingBranchId, setDeletingBranchId] = useState<number | null>(null)

  // Files state
  const [files,        setFiles]        = useState<CustomerFileRow[] | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null)

  // Reset caches when parent signals a refresh
  useEffect(() => { setBranches(null) }, [branchRefreshKey])
  useEffect(() => { setFiles(null) }, [fileRefreshKey])

  useEffect(() => {
    if (tab !== "branches" || branches !== null) return
    setBranchesLoading(true)
    fetch(`/api/customers/${c.id}/branches`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setBranches(data))
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false))
  }, [tab, c.id, branches])

  useEffect(() => {
    if (tab !== "files" || files !== null) return
    setFilesLoading(true)
    fetch(`/api/customers/${c.id}/files`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setFiles(data))
      .catch(() => setFiles([]))
      .finally(() => setFilesLoading(false))
  }, [tab, c.id, files])

  // Contacts state
  const [contacts, setContacts]           = useState<ContactRow[] | null>(null)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [showAddForm, setShowAddForm]     = useState(false)
  const [editingId, setEditingId]         = useState<number | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [deletingId, setDeletingId]       = useState<number | null>(null)

  useEffect(() => {
    if (tab !== "kad" || kads !== null) return
    setKadLoading(true)
    fetch(`/api/customers/${c.id}/kads`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setKads(data))
      .catch(() => setKads([]))
      .finally(() => setKadLoading(false))
  }, [tab, c.id, kads])

  useEffect(() => {
    if (tab !== "contacts" || contacts !== null) return
    setContactsLoading(true)
    fetch(`/api/customers/${c.id}/contacts`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setContacts(data))
      .catch(() => setContacts([]))
      .finally(() => setContactsLoading(false))
  }, [tab, c.id, contacts])

  async function handleAddContact(data: ContactFormData) {
    setSavingContact(true)
    try {
      const res = await fetch(`/api/customers/${c.id}/contacts`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setContacts((prev) => [...(prev ?? []), created])
        setShowAddForm(false)
      }
    } finally { setSavingContact(false) }
  }

  async function handleEditContact(id: number, data: ContactFormData) {
    setSavingContact(true)
    try {
      const res = await fetch(`/api/customers/${c.id}/contacts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setContacts((prev) => prev?.map((ct) => ct.id === id ? updated : ct) ?? null)
        setEditingId(null)
      }
    } finally { setSavingContact(false) }
  }

  async function handleDeleteContact(id: number) {
    setDeletingId(id)
    try {
      await fetch(`/api/customers/${c.id}/contacts/${id}`, { method: "DELETE" })
      setContacts((prev) => prev?.filter((ct) => ct.id !== id) ?? null)
    } finally { setDeletingId(null) }
  }

  const primaryKads   = kads?.filter((k) => k.kadType === "1") ?? []
  const secondaryKads = kads?.filter((k) => k.kadType !== "1") ?? []

  async function handleDeleteBranch(branchId: number) {
    setDeletingBranchId(branchId)
    try {
      await fetch(`/api/customers/${c.id}/branches/${branchId}`, { method: "DELETE" })
      setBranches((prev) => prev?.filter((b) => b.id !== branchId) ?? null)
    } finally {
      setDeletingBranchId(null)
    }
  }

  async function handleDeleteFile(fileId: number) {
    setDeletingFileId(fileId)
    try {
      await fetch(`/api/customers/${c.id}/files/${fileId}`, { method: "DELETE" })
      setFiles((prev) => prev?.filter((f) => f.id !== fileId) ?? null)
    } finally {
      setDeletingFileId(null)
    }
  }

  return (
    <tr className="border-b border-[var(--border)]" style={{ background: "rgba(99,102,241,0.025)" }}>
      {/* Empty cells to align under checkbox + chevron */}
      <td className="w-[40px]" />
      <td className="w-9" />

      <td colSpan={colSpan - 2} className="py-4 pr-6">

        {/* Tabs */}
        <div className="flex items-center gap-0.5 mb-4 border-b border-[var(--border)]">
          {(["details", "contacts", "kad", "branches", "files", "map"] as const).map((t) => {
            const hasMap = c.latitude != null && c.longitude != null
            const label =
              t === "details"    ? "Details"
              : t === "contacts"  ? `Contacts${contacts ? ` (${contacts.length})` : ""}`
              : t === "kad"       ? `KAD${kads ? ` (${kads.length})` : ""}`
              : t === "branches"  ? `Branches${branches ? ` (${branches.length})` : ""}`
              : t === "files"     ? `Files${files ? ` (${files.length})` : ""}`
              : "Map"
            return (
              <button
                key={t}
                onClick={(e) => { e.stopPropagation(); setTab(t) }}
                className={cn(
                  "relative px-3.5 py-2 text-[11px] font-semibold transition-colors select-none flex items-center gap-1.5",
                  tab === t ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  t === "map" && !hasMap && "opacity-40 cursor-not-allowed",
                )}
                disabled={t === "map" && !hasMap}
              >
                {t === "contacts" && <Users className="size-3" />}
                {t === "branches" && <Building2 className="size-3" />}
                {t === "files"    && <Paperclip className="size-3" />}
                {t === "map"      && <MapPin className="size-3" />}
                {label}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-indigo-500" />}
              </button>
            )
          })}
        </div>

        {/* ── Details tab ── */}
        {tab === "details" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">

            {/* Identity */}
            {(c.sotitle || c.irsdata || c.registrationDate || c.gemiCode) && (
              <Section accent="violet" title="Ταυτότητα">
                <DetailRow label="SO Title"          value={c.sotitle} />
                <DetailRow label="IRS Data"          value={c.irsdata} mono />
                <DetailRow label="Registration Date" value={c.registrationDate ? new Date(c.registrationDate).toLocaleDateString() : null} />
                <DetailRow label="GEMI Code"         value={c.gemiCode} mono />
              </Section>
            )}

            {/* Classification */}
            {(c.jobtype || c.trdbusiness || c.trdpgroup || c.jobtypetrd) && (
              <Section accent="indigo" title="Κατηγοριοποίηση">
                <DetailRow label="Job Type"  value={jobtypeName(c.jobtype, jobtypes)} badge />
                <DetailRow label="Business"  value={trdBusinessName(c.trdbusiness, businesses)} badge />
                <DetailRow label="TRD Group" value={trdGroupName(c.trdpgroup, trdgroups)} badge />
                <DetailRow label="Job TRD"   value={c.jobtypetrd} badge />
              </Section>
            )}

            {/* Location */}
            {(c.address || c.zip || c.district || c.area || c.country) && (
              <Section accent="emerald" title="Τοποθεσία">
                <DetailRow label="Country"  value={countryName(c.country, countries)} badge />
                <DetailRow label="Address"  value={c.address} />
                <DetailRow label="ZIP"      value={c.zip} mono />
                <DetailRow label="District" value={c.district} />
                <DetailRow label="Area"     value={c.area} />
                {c.latitude != null && c.longitude != null && (
                  <DetailRow label="Lat/Lng" value={`${c.latitude}, ${c.longitude}`} mono />
                )}
              </Section>
            )}

            {/* Contact */}
            {(c.phone02 || c.emailacc || c.webpage) && (
              <Section accent="sky" title="Επικοινωνία">
                <DetailRow label="Phone 2"   value={c.phone02} mono />
                <DetailRow label="Email acc" value={c.emailacc} />
                <DetailRow label="Webpage"   value={c.webpage} />
              </Section>
            )}

            {/* Meta */}
            {(c.prjcs || c.consent || c.insdate || c.upddate || c.numberOfEmployees) && (
              <Section accent="amber" title="Στοιχεία">
                <DetailRow label="PRJCS"     value={c.prjcs} mono />
                <DetailRow label="Employees" value={c.numberOfEmployees} />
                <DetailRow label="Consent"   value={c.consent ? "Yes" : undefined} badge />
                <DetailRow label="Created"   value={c.insdate ? new Date(c.insdate).toLocaleDateString() : null} />
                <DetailRow label="Updated"   value={c.upddate ? new Date(c.upddate).toLocaleDateString() : null} />
              </Section>
            )}

            {/* Remark — full width */}
            {c.remark && (
              <div className="col-span-full">
                <Section accent="rose" title="Σημείωση">
                  <p className="text-[12px] whitespace-pre-wrap font-medium" style={{ color: "var(--foreground)" }}>{c.remark}</p>
                </Section>
              </div>
            )}

          </div>
        )}

        {/* ── Contacts tab ── */}
        {tab === "contacts" && (
          <div onClick={(e) => e.stopPropagation()} className="space-y-3">

            {contactsLoading && (
              <div className="flex items-center gap-2 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-3.5 animate-spin" /> Loading contacts…
              </div>
            )}

            {!contactsLoading && contacts && contacts.length === 0 && !showAddForm && (
              <div className="flex items-center gap-2.5 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Users className="size-3.5 shrink-0" />
                No contacts yet.
              </div>
            )}

            {!contactsLoading && contacts && contacts.map((ct) => (
              editingId === ct.id ? (
                <ContactForm
                  key={ct.id}
                  initial={{ name: ct.name, position: ct.position, email: ct.email, phone: ct.phone, mobile: ct.mobile, address: ct.address, zip: ct.zip, city: ct.city, country: ct.country, remarks: ct.remarks }}
                  onSave={(data) => handleEditContact(ct.id, data)}
                  onCancel={() => setEditingId(null)}
                  saving={savingContact}
                />
              ) : (
                <div key={ct.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors group">
                  {/* Avatar */}
                  <div className="size-8 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-indigo-400">
                      {(ct.name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4">
                    {ct.name     && <span className="col-span-full text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{ct.name}</span>}
                    {ct.position && <span className="col-span-full text-[11px] mb-1" style={{ color: "var(--muted-foreground)" }}>{ct.position}</span>}
                    {ct.email    && <span className="text-[11px] font-mono truncate" style={{ color: "var(--foreground)" }}>{ct.email}</span>}
                    {ct.phone    && <span className="text-[11px] font-mono" style={{ color: "var(--foreground)" }}>{ct.phone}</span>}
                    {ct.mobile   && <span className="text-[11px] font-mono" style={{ color: "var(--foreground)" }}>{ct.mobile}</span>}
                    {(ct.address || ct.city || ct.zip) && (
                      <span className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>
                        {[ct.address, ct.zip, ct.city, ct.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {ct.remarks  && <span className="col-span-full text-[11px] mt-1 italic" style={{ color: "var(--muted-foreground)" }}>{ct.remarks}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setEditingId(ct.id)}
                      className="rounded-md p-1.5 hover:bg-[var(--muted)] transition-colors"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteContact(ct.id)}
                      disabled={deletingId === ct.id}
                      className="rounded-md p-1.5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {deletingId === ct.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                    </button>
                  </div>
                </div>
              )
            ))}

            {showAddForm && (
              <ContactForm
                initial={EMPTY_CONTACT}
                onSave={handleAddContact}
                onCancel={() => setShowAddForm(false)}
                saving={savingContact}
              />
            )}

            {!contactsLoading && !showAddForm && editingId === null && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-dashed border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Plus className="size-3" />
                Add contact
              </button>
            )}

          </div>
        )}

        {/* ── KAD tab ── */}
        {tab === "kad" && (
          <div onClick={(e) => e.stopPropagation()}>
            {kadLoading && (
              <div className="flex items-center gap-2 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-3.5 animate-spin" /> Φόρτωση ΚΑΔ…
              </div>
            )}

            {!kadLoading && kads && kads.length === 0 && (
              <div className="flex items-center gap-2.5 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Tag className="size-3.5 shrink-0" />
                Δεν υπάρχουν ΚΑΔ. Χρησιμοποιήστε &ldquo;Get KAD&rdquo; από τις ενέργειες.
              </div>
            )}

            {!kadLoading && kads && kads.length > 0 && (
              <div className="space-y-4">

                {/* Primary */}
                {primaryKads.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-indigo-400/70">Κύρια Δραστηριότητα</p>
                    <div className="space-y-px">
                      {primaryKads.map((kad) => (
                        <div key={kad.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-indigo-500/5 border border-indigo-500/15">
                          <span className="text-[11px] font-mono font-bold text-indigo-400 shrink-0 w-20">{kad.kadCode}</span>
                          <span className="text-[12px] font-medium flex-1" style={{ color: "var(--foreground)" }}>{kad.kadDescription}</span>
                          <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">ΚΥΡΙΑ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Secondary */}
                {secondaryKads.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-zinc-400/70">Δευτερεύουσες Δραστηριότητες ({secondaryKads.length})</p>
                    <div className="space-y-px">
                      {secondaryKads.map((kad) => (
                        <div key={kad.id} className="flex items-center gap-3 rounded-lg px-3 py-2 border border-[var(--border)]/60 hover:bg-[var(--muted)]/30 transition-colors">
                          <span className="text-[11px] font-mono font-semibold shrink-0 w-20" style={{ color: "var(--muted-foreground)" }}>{kad.kadCode}</span>
                          <span className="text-[12px] flex-1" style={{ color: "var(--foreground)" }}>{kad.kadDescription}</span>
                          <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 shrink-0">ΔΕΥΤΕΡ.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ── Branches tab ── */}
        {tab === "branches" && (
          <div onClick={(e) => e.stopPropagation()} className="space-y-2">

            {branchesLoading && (
              <div className="flex items-center gap-2 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-3.5 animate-spin" /> Loading branches…
              </div>
            )}

            {!branchesLoading && branches && branches.length === 0 && (
              <div className="flex items-center gap-2.5 py-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <Building2 className="size-3.5 shrink-0" />
                No branches yet. Use &ldquo;Get Branches&rdquo; from the row actions or add one manually.
              </div>
            )}

            {!branchesLoading && branches && branches.map((b) => (
              <div key={b.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors group">
                {/* Icon */}
                <div className="size-8 rounded-full bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="size-3.5 text-sky-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4">
                  {b.name    && <span className="col-span-full text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{b.name}</span>}
                  {b.code    && <span className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>#{b.code}</span>}
                  {b.trdbranch != null && <span className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>S1: {b.trdbranch}</span>}
                  {b.address && <span className="col-span-full text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>{[b.address, b.zip, b.areas, b.district].filter(Boolean).join(", ")}</span>}
                  {b.phone1  && <span className="text-[11px] font-mono" style={{ color: "var(--foreground)" }}>{b.phone1}</span>}
                  {b.phone2  && <span className="text-[11px] font-mono" style={{ color: "var(--foreground)" }}>{b.phone2}</span>}
                  {b.email   && <span className="text-[11px] font-mono truncate" style={{ color: "var(--foreground)" }}>{b.email}</span>}
                  {b.remarks && <span className="col-span-full text-[11px] mt-1 italic" style={{ color: "var(--muted-foreground)" }}>{b.remarks}</span>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => onEditBranch(b)}
                    className="rounded-md p-1.5 hover:bg-[var(--muted)] transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteBranch(b.id)}
                    disabled={deletingBranchId === b.id}
                    className="rounded-md p-1.5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {deletingBranchId === b.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                  </button>
                </div>
              </div>
            ))}

            {!branchesLoading && (
              <button
                onClick={onAddBranch}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-dashed border-[var(--border)] hover:border-sky-500/40 hover:bg-sky-500/5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Plus className="size-3" />
                Add branch
              </button>
            )}

          </div>
        )}

        {/* ── Files tab ── */}
        {tab === "files" && (
          <div onClick={(e) => e.stopPropagation()} className="space-y-2">

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

            {!filesLoading && files && files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors group">
                {/* Icon */}
                <div className="size-8 rounded-lg bg-[var(--muted)]/50 border border-[var(--border)] flex items-center justify-center shrink-0">
                  <FileTypeIcon mimeType={f.mimeType} />
                </div>

                {/* Info */}
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
                        {f.section}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {formatBytes(f.size)} · {f.mimeType} · {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <a
                    href={f.cdnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-md p-1.5 hover:bg-[var(--muted)] transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Download className="size-3" />
                  </a>
                  <button
                    onClick={() => handleDeleteFile(f.id)}
                    disabled={deletingFileId === f.id}
                    className="rounded-md p-1.5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {deletingFileId === f.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                  </button>
                </div>
              </div>
            ))}

            {!filesLoading && (
              <button
                onClick={onAddFile}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-dashed border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Plus className="size-3" />
                Upload file
              </button>
            )}

          </div>
        )}

        {/* ── Map tab ── */}
        {tab === "map" && c.latitude != null && c.longitude != null && (
          <div onClick={(e) => e.stopPropagation()}>
            <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: 340 }}>
              <AddressMap
                lat={c.latitude}
                lon={c.longitude}
                label={[c.name, c.address, c.city].filter(Boolean).join(" — ")}
              />
            </div>
            <p className="mt-2 text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>
              {c.latitude.toFixed(6)}, {c.longitude.toFixed(6)}
            </p>
          </div>
        )}

      </td>
    </tr>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type Props = { initialCustomers: CustomerRow[]; total: number; users: SurveyUser[] }

export function CustomersTable({ initialCustomers, total: initialTotal, users }: Props) {
  const router = useRouter()

  const [customers,  setCustomers]  = useState(initialCustomers)
  const [total,      setTotal]      = useState(initialTotal)
  const [search,     setSearch]     = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selected,   setSelected]   = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CustomerRow | null>(null)
  const [deletingId, setDeletingId]   = useState<number | null>(null)
  const [kadLoadingId, setKadLoadingId] = useState<number | null>(null)
  const [kadResult, setKadResult]       = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [geoLoadingId, setGeoLoadingId] = useState<number | null>(null)
  const [geoResult, setGeoResult]       = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [branchLoadingId, setBranchLoadingId] = useState<number | null>(null)
  const [branchResult, setBranchResult]       = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [branchDialogOpen, setBranchDialogOpen]         = useState(false)
  const [branchDialogCustomerId, setBranchDialogCustomerId] = useState<number | null>(null)
  const [branchDialogBranch, setBranchDialogBranch]     = useState<TrdBranchRow | null>(null)
  const [branchRefreshKeys, setBranchRefreshKeys]       = useState<Record<number, number>>({})
  const [fileUploadCustomer, setFileUploadCustomer]     = useState<CustomerRow | null>(null)
  const [fileRefreshKeys,    setFileRefreshKeys]         = useState<Record<number, number>>({})
  const [surveyCustomer,    setSurveyCustomer]           = useState<SurveyCustomer | null>(null)
  const [surveyDialogOpen,  setSurveyDialogOpen]         = useState(false)
  const [allBranchesLoading, setAllBranchesLoading] = useState(false)
  const [allBranchesResult, setAllBranchesResult]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [syncing, startSync]        = useTransition()
  const [syncResult, setSyncResult] = useState<{ ok: boolean; pulled?: number; pushed?: number; error?: string } | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [countries,  setCountries]  = useState<Country[]>([])
  const [jobtypes,   setJobtypes]   = useState<JobType[]>([])
  const [businesses, setBusinesses] = useState<TrdBusiness[]>([])
  const [trdgroups,  setTrdgroups]  = useState<TrdGroup[]>([])

  useEffect(() => {
    fetch("/api/s1/countries")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCountries(data))
      .catch(() => {})
    fetch("/api/s1/jobtypes")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setJobtypes(data.filter((j: JobType, i: number, a: JobType[]) => a.findIndex((x) => x.id === j.id) === i)))
      .catch(() => {})
    fetch("/api/s1/trdbusiness")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setBusinesses(data))
      .catch(() => {})
    fetch("/api/s1/trdgroup")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setTrdgroups(data))
      .catch(() => {})
  }, [])

  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc")
  const [page,      setPage]      = useState(1)

  const { visibleCols, toggleCol, pageSize, setPageSize, colWidths, setColWidth, hydrated } =
    useTablePrefs("customers", COLUMNS, 25, DEFAULT_WIDTHS)

  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null)

  function onResizeMouseDown(e: React.MouseEvent, key: string) {
    e.preventDefault()
    e.stopPropagation()
    const startW = colWidths[key] ?? DEFAULT_WIDTHS[key] ?? 120
    resizingRef.current = { key, startX: e.clientX, startW }

    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return
      const delta = ev.clientX - resizingRef.current.startX
      const next  = Math.max(60, resizingRef.current.startW + delta)
      setColWidth(resizingRef.current.key, next)
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
  const visibleDefs = COLUMNS.filter((c) => visibleCols.has(c.key))
  // checkbox + chevron + visible cols + actions
  const COL_COUNT   = 1 + 1 + visibleDefs.length + 1

  // ─── Selection ──────────────────────────────────────────────────────────────

  const pageIds = customers.map((c) => c.id)
  const allSel  = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someSel = pageIds.some((id) => selected.has(id)) && !allSel

  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s)
      allSel ? pageIds.forEach((id) => n.delete(id)) : pageIds.forEach((id) => n.add(id))
      return n
    })
  }
  function toggleRow(id: number) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async (opts: {
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
      const res  = await fetch(`/api/customers?${params}`)
      const data = await res.json()
      setCustomers(data.customers)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [search, sortField, sortDir, page, pageSize])

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleSearch(q: string) {
    setSearch(q); setPage(1); fetchCustomers({ q, pg: 1 })
  }

  function handleSort(col: ColDef) {
    if (!col.sortable) return
    const field = col.key as SortField
    const dir: "asc" | "desc" = sortField === field && sortDir === "asc" ? "desc" : "asc"
    setSortField(field); setSortDir(dir); setPage(1)
    fetchCustomers({ sort: field, dir, pg: 1 })
  }

  function handlePageSize(n: number) {
    setPageSize(n as typeof PAGE_SIZES[number]); setPage(1)
    fetchCustomers({ limit: n, pg: 1 })
  }

  function handlePage(p: number) { setPage(p); fetchCustomers({ pg: p }) }

  function openEdit(c: CustomerRow) {
    setEditTarget(c); setDialogOpen(true)
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this customer?")) return
    setDeletingId(id)
    try {
      await fetch(`/api/customers/${id}`, { method: "DELETE" })
      setSelected((s) => { const n = new Set(s); n.delete(id); return n })
      await fetchCustomers()
    } finally {
      setDeletingId(null)
    }
  }

  async function handleGetKad(c: CustomerRow) {
    if (!c.afm) {
      setKadResult({ id: c.id, ok: false, msg: "Δεν υπάρχει ΑΦΜ για αυτόν τον πελάτη." })
      return
    }
    setKadLoadingId(c.id)
    setKadResult(null)
    try {
      const res = await saveCustomerKads(c.id, c.afm)
      if (res.ok) setKadResult({ id: c.id, ok: true, msg: `Αποθηκεύτηκαν ${res.saved} ΚΑΔ.` })
      else setKadResult({ id: c.id, ok: false, msg: res.error })
    } finally {
      setKadLoadingId(null)
    }
  }

  async function handleGetGeodata(c: CustomerRow) {
    if (!c.address && !c.city && !c.zip) {
      setGeoResult({ id: c.id, ok: false, msg: "Δεν υπάρχει διεύθυνση για αυτόν τον πελάτη." })
      return
    }
    setGeoLoadingId(c.id)
    setGeoResult(null)
    try {
      const geoAddr: { street?: string; postalCode?: string; city?: string } = {}
      if (c.address) geoAddr.street     = c.address
      if (c.zip)     geoAddr.postalCode = c.zip
      if (c.city)    geoAddr.city       = c.city
      const res = await saveCustomerGeodata(c.id, geoAddr)
      if (res.ok) {
        // Update in-place so map tab shows immediately without refetch
        setCustomers((prev) => prev.map((r) =>
          r.id === c.id ? { ...r, latitude: res.lat, longitude: res.lon } : r
        ))
        setGeoResult({ id: c.id, ok: true, msg: `Συντεταγμένες αποθηκεύτηκαν: ${res.lat.toFixed(5)}, ${res.lon.toFixed(5)}` })
      } else {
        setGeoResult({ id: c.id, ok: false, msg: res.error })
      }
    } finally {
      setGeoLoadingId(null)
    }
  }

  async function handleGetBranches(c: CustomerRow) {
    if (!c.trdr) {
      setBranchResult({ id: c.id, ok: false, msg: "Customer has no TRDR — cannot sync branches from Softone." })
      return
    }
    setBranchLoadingId(c.id)
    setBranchResult(null)
    try {
      const res = await syncCustomerBranches(c.id, c.trdr)
      if (res.ok) {
        setBranchResult({ id: c.id, ok: true, msg: `Synced ${res.saved} branch${res.saved !== 1 ? "es" : ""}.` })
        setBranchRefreshKeys((k) => ({ ...k, [c.id]: (k[c.id] ?? 0) + 1 }))
      } else {
        setBranchResult({ id: c.id, ok: false, msg: res.error })
      }
    } finally {
      setBranchLoadingId(null)
    }
  }

  function handleOpenAddBranch(c: CustomerRow) {
    setBranchDialogCustomerId(c.id)
    setBranchDialogBranch(null)
    setBranchDialogOpen(true)
    setExpandedId(c.id)
  }

  function handleNewSurvey(c: CustomerRow) {
    const parts = [c.address, c.city, c.zip].filter(Boolean)
    const mainAddress = parts.length > 0 ? parts.join(", ") : null
    setSurveyCustomer({ id: c.id, name: c.name, branches: c.branches, mainAddress })
    setSurveyDialogOpen(true)
  }

  function handleBranchDialogClose() {
    const cid = branchDialogCustomerId
    setBranchDialogOpen(false)
    setBranchDialogBranch(null)
    if (cid) setBranchRefreshKeys((k) => ({ ...k, [cid]: (k[cid] ?? 0) + 1 }))
  }

  function handleEditBranch(customerId: number, branch: TrdBranchRow) {
    setBranchDialogCustomerId(customerId)
    setBranchDialogBranch(branch)
    setBranchDialogOpen(true)
  }

  async function handleSyncAllBranches() {
    setAllBranchesLoading(true)
    setAllBranchesResult(null)
    try {
      const res = await syncAllCustomerBranches()
      if (res.ok) {
        setAllBranchesResult({ ok: true, msg: `Synced ${res.synced} branch${res.synced !== 1 ? "es" : ""} across all customers${res.failed ? ` (${res.failed} failed)` : ""}.` })
        setBranchRefreshKeys((k) => {
          const next = { ...k }
          customers.forEach((c) => { if (c.trdr) next[c.id] = (next[c.id] ?? 0) + 1 })
          return next
        })
      } else {
        setAllBranchesResult({ ok: false, msg: res.error })
      }
    } finally {
      setAllBranchesLoading(false)
    }
  }

  function handleSync() {
    setSyncResult(null)
    startSync(async () => {
      const res  = await fetch("/api/customers/sync", { method: "POST" })
      const data = await res.json()
      setSyncResult(data)
      await fetchCustomers()
      router.refresh()
    })
  }

  function handleDialogClose() { setDialogOpen(false); fetchCustomers() }

  // ─── Cell renderer ───────────────────────────────────────────────────────────

  function renderCell(col: ColDef, c: CustomerRow) {
    switch (col.key) {
      case "name":
        return (
          <td key="name" className="px-3 py-3">
            <p className="text-[12px] font-semibold text-[var(--foreground)] truncate">{c.name ?? "—"}</p>
            {(c.code || c.trdr) && (
              <p className="text-[11px] font-mono text-[var(--muted-foreground)] truncate mt-0.5">
                {[c.code, c.trdr != null ? `#${c.trdr}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </td>
        )
      case "afm":
        return <td key="afm" className="px-3 py-3 text-[12px] font-mono text-[var(--muted-foreground)] truncate">{c.afm ?? "—"}</td>
      case "city":
        return <td key="city" className="px-3 py-3 text-[12px] text-[var(--foreground)] truncate">{c.city ?? "—"}</td>
      case "phone01":
        return <td key="phone01" className="px-3 py-3 text-[12px] text-[var(--foreground)] truncate">{c.phone01 ?? "—"}</td>
      case "email":
        return <td key="email" className="px-3 py-3 text-[12px] text-[var(--foreground)] truncate">{c.email ?? "—"}</td>
      case "isprosp":
        return (
          <td key="isprosp" className="px-3 py-3">
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border", c.isprosp
              ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
              : "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
            )}>
              {c.isprosp ? "Prospect" : "Customer"}
            </span>
          </td>
        )
      case "trdr":
        return <td key="trdr" className="px-3 py-3 text-[12px] font-mono text-[var(--muted-foreground)]">{c.trdr ?? <span className="opacity-30">—</span>}</td>
      case "address":
        return <td key="address" className="px-3 py-3 text-[12px] text-[var(--foreground)] truncate">{c.address ?? "—"}</td>
      case "zip":
        return <td key="zip" className="px-3 py-3 text-[12px] font-mono text-[var(--muted-foreground)]">{c.zip ?? "—"}</td>
      case "country":
        return <td key="country" className="px-3 py-3 text-[12px] text-[var(--muted-foreground)]">{countryName(c.country, countries) ?? "—"}</td>
      case "insdate":
        return <td key="insdate" className="px-3 py-3 text-[12px] text-[var(--muted-foreground)]">{c.insdate ? new Date(c.insdate).toLocaleDateString() : "—"}</td>
      case "upddate":
        return <td key="upddate" className="px-3 py-3 text-[12px] text-[var(--muted-foreground)]">{c.upddate ? new Date(c.upddate).toLocaleDateString() : "—"}</td>
      default:
        return <td key={col.key} />
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (!hydrated) return null

  return (
    <div className="flex flex-col gap-3">

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--muted-foreground)]" />
          <input
            type="search"
            placeholder="Search name, code, AFM…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-1.5">
            <span className="text-xs font-semibold text-[var(--foreground)]">{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Clear</button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Column picker */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                <Columns3 className="size-4" />
                Columns
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150">
                {COLUMNS.map((col) => {
                  const isVisible = visibleCols.has(col.key)
                  const locked    = col.alwaysVisible
                  return (
                    <DropdownMenu.Item
                      key={col.key}
                      onSelect={(e) => { e.preventDefault(); if (!locked) toggleCol(col.key) }}
                      className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none transition-colors", locked ? "opacity-50 cursor-default" : "hover:bg-[var(--muted)]")}
                    >
                      <div className={cn("size-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors", isVisible ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]")}>
                        {isVisible && <Check className="size-2.5 text-[var(--primary-foreground)]" strokeWidth={3} />}
                      </div>
                      <span className="flex-1">{col.label}</span>
                      {locked && <span className="text-[10px] text-[var(--muted-foreground)]">locked</span>}
                    </DropdownMenu.Item>
                  )
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <Btn variant="secondary" size="md" onClick={handleSyncAllBranches} disabled={allBranchesLoading}>
            {allBranchesLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Building2 className="size-3.5" />}
            Sync All Branches
          </Btn>
          <Btn variant="secondary" size="md" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Sync S1
          </Btn>
          <Btn variant="primary" size="md" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            <Plus className="size-3.5" />
            New customer
          </Btn>
        </div>
      </div>

      {/* All-branches sync result */}
      {allBranchesResult && (
        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]", allBranchesResult.ok ? "bg-emerald-500/10" : "bg-red-500/10")}>
          {allBranchesResult.ok ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> : <XCircle className="size-4 text-red-500 shrink-0" />}
          <span style={{ color: allBranchesResult.ok ? "#16a34a" : "#dc2626" }}>{allBranchesResult.msg}</span>
          <button className="ml-auto text-[10px] underline text-[var(--muted-foreground)]" onClick={() => setAllBranchesResult(null)}>dismiss</button>
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={cn("flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px]", syncResult.ok ? "bg-emerald-500/10" : "bg-red-500/10")}>
          {syncResult.ok
            ? <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
            : <XCircle className="size-4 text-red-500 mt-0.5 shrink-0" />}
          <span style={{ color: syncResult.ok ? "#16a34a" : "#dc2626" }}>
            {syncResult.ok
              ? `Sync complete — pulled ${syncResult.pulled}, pushed ${syncResult.pushed}`
              : `Sync error: ${syncResult.error}`}
          </span>
          <button className="ml-auto text-[10px] underline text-[var(--muted-foreground)]" onClick={() => setSyncResult(null)}>dismiss</button>
        </div>
      )}

      {kadResult && (
        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]", kadResult.ok ? "bg-emerald-500/10" : "bg-red-500/10")}>
          {kadResult.ok ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> : <XCircle className="size-4 text-red-500 shrink-0" />}
          <span style={{ color: kadResult.ok ? "#16a34a" : "#dc2626" }}>{kadResult.msg}</span>
          <button className="ml-auto text-[10px] underline text-[var(--muted-foreground)]" onClick={() => setKadResult(null)}>dismiss</button>
        </div>
      )}

      {geoResult && (
        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]", geoResult.ok ? "bg-emerald-500/10" : "bg-red-500/10")}>
          {geoResult.ok ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> : <XCircle className="size-4 text-red-500 shrink-0" />}
          <span style={{ color: geoResult.ok ? "#16a34a" : "#dc2626" }}>{geoResult.msg}</span>
          <button className="ml-auto text-[10px] underline text-[var(--muted-foreground)]" onClick={() => setGeoResult(null)}>dismiss</button>
        </div>
      )}

      {branchResult && (
        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]", branchResult.ok ? "bg-emerald-500/10" : "bg-red-500/10")}>
          {branchResult.ok ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> : <XCircle className="size-4 text-red-500 shrink-0" />}
          <span style={{ color: branchResult.ok ? "#16a34a" : "#dc2626" }}>{branchResult.msg}</span>
          <button className="ml-auto text-[10px] underline text-[var(--muted-foreground)]" onClick={() => setBranchResult(null)}>dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 36 }} />
              {visibleDefs.map((col) => (
                <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_WIDTHS[col.key] ?? 120 }} />
              ))}
              <col style={{ width: 48 }} />
            </colgroup>

            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                {/* Select-all */}
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSel}
                    ref={(el) => { if (el) el.indeterminate = someSel }}
                    onChange={toggleAll}
                    className="rounded accent-indigo-500 cursor-pointer"
                  />
                </th>
                {/* Expand chevron col */}
                <th className="w-9" />

                {visibleDefs.map((col) => (
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
                            ? <ChevronUp className="size-3.5 flex-shrink-0 text-[var(--foreground)]" />
                            : <ChevronDown className="size-3.5 flex-shrink-0 text-[var(--foreground)]" />
                          : <ChevronsUpDown className="size-3.5 flex-shrink-0 text-[var(--muted-foreground)]/40" />
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => onResizeMouseDown(e, col.key)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center group"
                    >
                      <div className="w-px h-4 bg-[var(--border)] group-hover:bg-[var(--primary)] transition-colors" />
                    </div>
                  </th>
                ))}
                <th className="px-2 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center py-10">
                    <Loader2 className="size-5 animate-spin mx-auto text-[var(--muted-foreground)]" />
                  </td>
                </tr>
              )}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center py-10 text-sm text-[var(--muted-foreground)]">
                    No customers found
                  </td>
                </tr>
              )}
              {!loading && customers.map((c, i) => {
                const isSel    = selected.has(c.id)
                const expanded = expandedId === c.id
                return (
                  <React.Fragment key={c.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                      className={cn(
                        "border-b border-[var(--border)]/50 last:border-0 transition-colors cursor-pointer",
                        isSel ? "bg-[var(--primary)]/5" : i % 2 === 0 ? "bg-transparent" : "bg-[var(--muted)]/10",
                        "hover:bg-[var(--muted)]/25",
                        expanded && "!bg-indigo-500/5 border-b-0",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(c.id)}
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

                      {visibleDefs.map((col) => renderCell(col, c))}

                      {/* Row actions */}
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="size-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                              {deletingId === c.id
                                ? <Loader2 className="size-4 animate-spin" />
                                : <MoreHorizontal className="size-4" />}
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              className="z-50 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 animate-in fade-in zoom-in-95 duration-150"
                            >
                              <DropdownMenu.Item
                                onSelect={() => router.push(`/customers/${c.id}`)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <ExternalLink className="size-3.5 text-[var(--muted-foreground)]" />
                                View Details
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => openEdit(c)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Pencil className="size-3.5 text-[var(--muted-foreground)]" />
                                Edit
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => handleGetKad(c)}
                                disabled={kadLoadingId === c.id}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                              >
                                {kadLoadingId === c.id
                                  ? <Loader2 className="size-3.5 animate-spin text-[var(--muted-foreground)]" />
                                  : <Tag className="size-3.5 text-[var(--muted-foreground)]" />}
                                Get KAD
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => handleGetGeodata(c)}
                                disabled={geoLoadingId === c.id}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                              >
                                {geoLoadingId === c.id
                                  ? <Loader2 className="size-3.5 animate-spin text-[var(--muted-foreground)]" />
                                  : <MapPin className="size-3.5 text-[var(--muted-foreground)]" />}
                                Get Geodata
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => handleGetBranches(c)}
                                disabled={branchLoadingId === c.id}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                              >
                                {branchLoadingId === c.id
                                  ? <Loader2 className="size-3.5 animate-spin text-[var(--muted-foreground)]" />
                                  : <Building2 className="size-3.5 text-[var(--muted-foreground)]" />}
                                Get Branches
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => handleOpenAddBranch(c)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Building2 className="size-3.5 text-[var(--muted-foreground)]" />
                                Add Branch
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => { setFileUploadCustomer(c); setExpandedId(c.id) }}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <Paperclip className="size-3.5 text-[var(--muted-foreground)]" />
                                New File
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => handleNewSurvey(c)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
                              >
                                <ClipboardList className="size-3.5 text-[var(--muted-foreground)]" />
                                New Site Survey
                              </DropdownMenu.Item>

                              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

                              <DropdownMenu.Item
                                onSelect={() => handleDelete(c.id)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none text-[var(--destructive)] hover:bg-[var(--destructive)]/8 transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>

                    {expanded && (
                      <ExpandedRow
                        c={c} colSpan={COL_COUNT} countries={countries} jobtypes={jobtypes} businesses={businesses} trdgroups={trdgroups}
                        branchRefreshKey={branchRefreshKeys[c.id] ?? 0}
                        fileRefreshKey={fileRefreshKeys[c.id] ?? 0}
                        onAddBranch={() => { setBranchDialogCustomerId(c.id); setBranchDialogBranch(null); setBranchDialogOpen(true) }}
                        onEditBranch={(b) => handleEditBranch(c.id, b)}
                        onAddFile={() => setFileUploadCustomer(c)}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--muted)]/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSize(Number(e.target.value))}
              className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted-foreground)]">
              {total === 0 ? "0 customers" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="size-7 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-xs font-medium text-[var(--foreground)] px-2">{page} / {totalPages}</span>
              <button
                onClick={() => handlePage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="size-7 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <CustomerDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        customer={editTarget}
      />

      {branchDialogOpen && branchDialogCustomerId != null && (
        <BranchDialog
          open={branchDialogOpen}
          onClose={handleBranchDialogClose}
          customerId={branchDialogCustomerId}
          branch={branchDialogBranch}
          countries={countries}
          jobtypes={jobtypes}
        />
      )}

      {fileUploadCustomer != null && (
        <CustomerFileUploadDialog
          open={fileUploadCustomer != null}
          onClose={() => {
            const cid = fileUploadCustomer.id
            setFileUploadCustomer(null)
            setFileRefreshKeys((k) => ({ ...k, [cid]: (k[cid] ?? 0) + 1 }))
          }}
          customerId={fileUploadCustomer.id}
          customerName={fileUploadCustomer.name}
        />
      )}

      <SiteSurveyDialog
        open={surveyDialogOpen}
        onClose={() => { setSurveyDialogOpen(false); setSurveyCustomer(null) }}
        onSaved={() => { setSurveyDialogOpen(false); setSurveyCustomer(null) }}
        customer={surveyCustomer ?? undefined}
        users={users}
      />
    </div>
  )
}
