"use client"

import { useState, useTransition } from "react"
import {
  Search, Building2, MapPin, Calendar, Tag, Hash, AtSign, Globe,
  AlertCircle, Loader2, ChevronDown, ChevronRight, ChevronsLeft, ChevronLeft,
  ChevronRight as ChevronRightIcon, ChevronsRight, CheckCircle2, XCircle, Coins,
  Briefcase, Users, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn } from "@/components/ui/btn"
import { gemiSearch, gemiGetDocuments } from "@/app/actions/gemi"
import { formatGemiAddress, type GemiCompany, type GemiSearchCriteria, type GemiSortBy, type GemiDocumentSet } from "@/lib/gemi"
import { FileText as FileIcon, Download, ExternalLink } from "lucide-react"

const PAGE_SIZES = [10, 25, 50, 100, 200]

const SORT_OPTIONS: Array<{ value: GemiSortBy; label: string }> = [
  { value: "+arGemi", label: "Αρ. ΓΕΜΗ ↑" },
  { value: "-arGemi", label: "Αρ. ΓΕΜΗ ↓" },
  { value: "+coName", label: "Επωνυμία Α–Ω" },
  { value: "-coName", label: "Επωνυμία Ω–Α" },
  { value: "+afm", label: "ΑΦΜ ↑" },
  { value: "-afm", label: "ΑΦΜ ↓" },
  { value: "+incorporationDate", label: "Ημ. Ίδρυσης ↑" },
  { value: "-incorporationDate", label: "Ημ. Ίδρυσης ↓" },
]

type ActiveFilter = "any" | "active" | "inactive"

interface FormState {
  arGemi: string
  afm: string
  name: string
  active: ActiveFilter
  prefectures: string  // comma-separated ints
  municipalities: string
  legalTypes: string
  statuses: string
  activities: string
  gemiOffices: string
  sortBy: GemiSortBy
  pageSize: number
}

const INITIAL_FORM: FormState = {
  arGemi: "",
  afm: "",
  name: "",
  active: "any",
  prefectures: "",
  municipalities: "",
  legalTypes: "",
  statuses: "",
  activities: "",
  gemiOffices: "",
  sortBy: "+arGemi",
  pageSize: 25,
}

function csvToInts(s: string): number[] {
  return s.split(",").map((p) => parseInt(p.trim(), 10)).filter((n) => Number.isFinite(n))
}
function csvToStrings(s: string): string[] {
  return s.split(",").map((p) => p.trim()).filter(Boolean)
}

function buildCriteria(form: FormState, offset: number): GemiSearchCriteria {
  return {
    arGemi: form.arGemi.trim() || undefined,
    afm: form.afm.trim() || undefined,
    name: form.name.trim().length >= 3 ? form.name.trim() : undefined,
    isActive: form.active === "any" ? undefined : form.active === "active",
    prefectures: form.prefectures.trim() ? csvToInts(form.prefectures) : undefined,
    municipalities: form.municipalities.trim() ? csvToStrings(form.municipalities) : undefined,
    legalTypes: form.legalTypes.trim() ? csvToInts(form.legalTypes) : undefined,
    statuses: form.statuses.trim() ? csvToInts(form.statuses) : undefined,
    activities: form.activities.trim() ? csvToStrings(form.activities) : undefined,
    gemiOffices: form.gemiOffices.trim() ? csvToStrings(form.gemiOffices) : undefined,
    resultsSortBy: form.sortBy,
    resultsOffset: offset,
    resultsSize: form.pageSize,
  }
}

function hasAnyCriterion(form: FormState): boolean {
  return Boolean(
    form.arGemi.trim() || form.afm.trim() || (form.name.trim().length >= 3) ||
    form.active !== "any" || form.prefectures.trim() || form.municipalities.trim() ||
    form.legalTypes.trim() || form.statuses.trim() || form.activities.trim() || form.gemiOffices.trim()
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "var(--muted-foreground)" }}>
      {children}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-md border px-2.5 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30",
        props.className,
      )}
      style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)", ...(props.style ?? {}) }}
    />
  )
}

function StatusBadge({ active }: { active: boolean | undefined }) {
  if (active === undefined) return null
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0",
      active
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : "bg-rose-500/10 text-rose-400 border-rose-500/20",
    )}>
      {active ? <><CheckCircle2 className="size-2.5" /> Ενεργή</> : <><XCircle className="size-2.5" /> Ανενεργή</>}
    </span>
  )
}

type DocsState =
  | { status: "loading" }
  | { status: "ready"; data: GemiDocumentSet }
  | { status: "error"; error: string }

function DocumentsPanel({ state }: { state: DocsState | undefined }) {
  if (!state || state.status === "loading") {
    return (
      <div className="rounded-lg border p-3 flex items-center gap-2 text-[12px]" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)" }}>
        <Loader2 className="size-3.5 animate-spin" />
        Φόρτωση εγγράφων…
      </div>
    )
  }
  if (state.status === "error") {
    return (
      <div className="rounded-lg border px-3 py-2 flex items-center gap-2 text-[12px] bg-red-500/5 border-red-500/20 text-red-400">
        <AlertCircle className="size-3.5 shrink-0" />
        {state.error}
      </div>
    )
  }
  const { decision, publication } = state.data
  const total = decision.length + publication.length
  if (total === 0) {
    return (
      <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)" }}>
        Δεν βρέθηκαν διαθέσιμα έγγραφα.
      </div>
    )
  }
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <FileIcon className="size-3" style={{ color: "var(--muted-foreground)" }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Έγγραφα ΓΕΜΗ — {total}
        </span>
      </div>

      {/* Decisions */}
      {decision.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider bg-[var(--muted)]/40" style={{ color: "var(--muted-foreground)" }}>
            Αποφάσεις / Ανακοινώσεις ({decision.length})
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {decision.map((d, i) => (
              <div key={`dec-${i}`} className="px-3 py-2.5 space-y-1">
                <div className="flex items-start gap-2">
                  <FileIcon className="size-3.5 mt-0.5 shrink-0 text-indigo-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                      {d.decisionSubject || d.assembly || "—"}
                    </p>
                    {d.summary && (
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        {d.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                      {d.kak && <span className="font-mono">ΚΑΚ {d.kak}</span>}
                      {d.dateAnnounced && <span>Αν: {d.dateAnnounced}</span>}
                      {d.dateAssemblyDecided && <span>Απόφ: {d.dateAssemblyDecided}</span>}
                      {d.dateRegistrated && <span>Καταχ: {d.dateRegistrated}</span>}
                      {d.applicationStatusDescription && <span>· {d.applicationStatusDescription}</span>}
                    </div>
                  </div>
                  {d.assemblyDecisionUrl && (
                    <a
                      href={d.assemblyDecisionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--accent)] shrink-0"
                      style={{ color: "var(--foreground)" }}
                    >
                      <Download className="size-3" /> Λήψη
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publications */}
      {publication.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider bg-[var(--muted)]/40" style={{ color: "var(--muted-foreground)", borderTop: decision.length > 0 ? "1px solid var(--border)" : undefined }}>
            ΥΜΣ Δημοσιεύσεις ({publication.length})
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {publication.map((p, i) => (
              <div key={`pub-${i}`} className="px-3 py-2.5 flex items-center gap-2">
                <FileIcon className="size-3.5 shrink-0 text-violet-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-mono" style={{ color: "var(--foreground)" }}>
                    {p.kad || "—"}
                  </p>
                </div>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--accent)] shrink-0"
                    style={{ color: "var(--foreground)" }}
                  >
                    <ExternalLink className="size-3" /> Άνοιγμα
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CompanyDetail({ c, docs }: { c: GemiCompany; docs: DocsState | undefined }) {
  const address = formatGemiAddress(c)
  return (
    <div className="px-5 py-4 space-y-4 bg-[var(--muted)]/20" style={{ borderTop: "1px solid var(--border)" }}>
      {/* Trading titles */}
      {(c.coTitlesEl?.length || c.coTitlesEn?.length) ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>
            Διακριτικός Τίτλος
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...(c.coTitlesEl ?? []), ...(c.coTitlesEn ?? [])].map((t, i) => (
              <span key={i} className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {/* Identity */}
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>Στοιχεία</p>
          <DetailRow icon={<Hash className="size-3" />} label="Αρ. ΓΕΜΗ" value={String(c.arGemi)} />
          <DetailRow icon={<Hash className="size-3" />} label="ΑΦΜ" value={c.afm ?? "—"} />
          <DetailRow icon={<Briefcase className="size-3" />} label="Νομική Μορφή" value={c.legalType?.descr} />
          <DetailRow icon={<FileText className="size-3" />} label="Κατάσταση" value={c.status?.descr} />
          <DetailRow icon={<Calendar className="size-3" />} label="Ημ. Ίδρυσης" value={c.incorporationDate} />
          <DetailRow icon={<Calendar className="size-3" />} label="Τελ. Μεταβολή" value={c.lastStatusChange} />
        </div>

        {/* Address */}
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>Διεύθυνση & Επικοινωνία</p>
          <DetailRow icon={<MapPin className="size-3" />} label="Διεύθυνση" value={address || "—"} />
          <DetailRow icon={<MapPin className="size-3" />} label="Νομός" value={c.prefecture?.descr} />
          <DetailRow icon={<MapPin className="size-3" />} label="Δήμος" value={c.municipality?.descr} />
          <DetailRow icon={<Globe className="size-3" />} label="Ιστοσελίδα" value={c.url} link={c.url ? (c.url.startsWith("http") ? c.url : `https://${c.url}`) : undefined} />
          <DetailRow icon={<AtSign className="size-3" />} label="Email" value={c.email} link={c.email ? `mailto:${c.email}` : undefined} />
          <DetailRow icon={<Building2 className="size-3" />} label="Υπηρ. ΓΕΜΗ" value={c.gemiOffice?.descr} />
        </div>
      </div>

      {/* Capital */}
      {c.capital && c.capital.length > 0 && (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
            <Coins className="size-3" /> Κεφάλαιο
          </p>
          <div className="space-y-1.5">
            {c.capital.map((cap, i) => (
              <p key={i} className="text-[12px]" style={{ color: "var(--foreground)" }}>
                <span className="font-mono font-semibold">{cap.capitalStock?.toLocaleString("el-GR")}</span>{" "}
                <span className="text-[var(--muted-foreground)]">{cap.currency}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {c.activities && c.activities.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <Tag className="size-3" style={{ color: "var(--muted-foreground)" }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Δραστηριότητες (ΚΑΔ) — {c.activities.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {c.activities.map((a, i) => {
              const act = (a as { activity?: { id: string; descr: string } }).activity
              const isPrimary = Boolean((a as { isPrimary?: boolean }).isPrimary)
              return (
                <div key={i} className="px-3 py-2 flex items-start gap-2">
                  {isPrimary && (
                    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shrink-0">
                      ΚΥΡΙΑ
                    </span>
                  )}
                  <span className="text-[11px] font-mono shrink-0 text-[var(--muted-foreground)]">{act?.id}</span>
                  <span className="text-[12px] flex-1" style={{ color: "var(--foreground)" }}>{act?.descr}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Persons */}
      {c.persons && c.persons.length > 0 && (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
            <Users className="size-3" /> Πρόσωπα — {c.persons.length}
          </p>
          <pre className="text-[10px] font-mono overflow-x-auto p-2 rounded bg-[var(--background)]" style={{ color: "var(--muted-foreground)" }}>
{JSON.stringify(c.persons, null, 2)}
          </pre>
        </div>
      )}

      {/* Documents (auto-loaded on expand) */}
      <DocumentsPanel state={docs} />
    </div>
  )
}

function DetailRow({ icon, label, value, link }: { icon: React.ReactNode; label: string; value?: string | null; link?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="mt-0.5 text-[var(--muted-foreground)]">{icon}</span>
      <span className="text-[10px] font-medium w-28 shrink-0 pt-px" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[12px] flex-1 text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all">
          {value}
        </a>
      ) : (
        <span className="text-[12px] font-medium flex-1 break-words" style={{ color: "var(--foreground)" }}>{value}</span>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function GemiSearch() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [results, setResults] = useState<GemiCompany[]>([])
  const [meta, setMeta] = useState<{ totalCount: number; resultsOffset: number; resultsSize: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [docs, setDocs] = useState<Map<number, DocsState>>(new Map())
  const [isSearching, startSearch] = useTransition()

  async function loadDocsFor(arGemi: number) {
    if (docs.has(arGemi)) return // cached
    setDocs((prev) => new Map(prev).set(arGemi, { status: "loading" }))
    const res = await gemiGetDocuments(arGemi)
    setDocs((prev) => {
      const next = new Map(prev)
      next.set(arGemi, res.ok ? { status: "ready", data: res.data } : { status: "error", error: res.error })
      return next
    })
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function runSearch(offset = 0) {
    if (!hasAnyCriterion(form)) {
      setError("Πρέπει να εισαχθεί τουλάχιστον ένα κριτήριο αναζήτησης")
      return
    }
    setError(null)
    startSearch(async () => {
      const res = await gemiSearch(buildCriteria(form, offset))
      if (res.ok) {
        setResults(res.data.searchResults)
        setMeta(res.data.searchMetadata)
        setExpanded(new Set())
        setDocs(new Map())
        setSearched(true)
      } else {
        setError(res.error)
        setResults([])
        setMeta(null)
        setSearched(true)
      }
    })
  }

  function reset() {
    setForm(INITIAL_FORM)
    setResults([])
    setMeta(null)
    setError(null)
    setSearched(false)
    setExpanded(new Set())
    setDocs(new Map())
  }

  function toggleExpand(arGemi: number) {
    const opening = !expanded.has(arGemi)
    const next = new Set(expanded)
    if (opening) next.add(arGemi)
    else next.delete(arGemi)
    setExpanded(next)
    if (opening) void loadDocsFor(arGemi)
  }

  const totalPages = meta ? Math.max(1, Math.ceil(meta.totalCount / form.pageSize)) : 1
  const currentPage = meta ? Math.floor(meta.resultsOffset / form.pageSize) + 1 : 1

  function goToPage(page: number) {
    const clamped = Math.max(1, Math.min(totalPages, page))
    runSearch((clamped - 1) * form.pageSize)
  }

  return (
    <div className="space-y-5">

      {/* ── Search form ── */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel>Επωνυμία (≥3 χαρ.)</FieldLabel>
            <TextInput
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="π.χ. ΟΠΑΠ"
              onKeyDown={(e) => e.key === "Enter" && runSearch(0)}
            />
          </div>
          <div>
            <FieldLabel>ΑΦΜ (9 ψηφία)</FieldLabel>
            <TextInput
              value={form.afm}
              onChange={(e) => update("afm", e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="000000000"
              maxLength={9}
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && runSearch(0)}
            />
          </div>
          <div>
            <FieldLabel>Αρ. ΓΕΜΗ</FieldLabel>
            <TextInput
              value={form.arGemi}
              onChange={(e) => update("arGemi", e.target.value.replace(/\D/g, ""))}
              placeholder="π.χ. 12345601000"
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && runSearch(0)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel>Κατάσταση</FieldLabel>
            <select
              value={form.active}
              onChange={(e) => update("active", e.target.value as ActiveFilter)}
              className="w-full rounded-md border px-2.5 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
            >
              <option value="any">Όλες</option>
              <option value="active">Μόνο ενεργές</option>
              <option value="inactive">Μόνο ανενεργές</option>
            </select>
          </div>
          <div>
            <FieldLabel>Νομοί (IDs, comma)</FieldLabel>
            <TextInput
              value={form.prefectures}
              onChange={(e) => update("prefectures", e.target.value)}
              placeholder="π.χ. 1,2,3"
            />
          </div>
          <div>
            <FieldLabel>Δήμοι (IDs, comma)</FieldLabel>
            <TextInput
              value={form.municipalities}
              onChange={(e) => update("municipalities", e.target.value)}
              placeholder="π.χ. 100,101"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <FieldLabel>Νομικές Μορφές (IDs)</FieldLabel>
            <TextInput value={form.legalTypes} onChange={(e) => update("legalTypes", e.target.value)} placeholder="1,2" />
          </div>
          <div>
            <FieldLabel>Καταστάσεις (IDs)</FieldLabel>
            <TextInput value={form.statuses} onChange={(e) => update("statuses", e.target.value)} placeholder="1,2" />
          </div>
          <div>
            <FieldLabel>Δραστηριότητες (ΚΑΔ)</FieldLabel>
            <TextInput value={form.activities} onChange={(e) => update("activities", e.target.value)} placeholder="62.01.11" />
          </div>
          <div>
            <FieldLabel>Υπηρ. ΓΕΜΗ (IDs)</FieldLabel>
            <TextInput value={form.gemiOffices} onChange={(e) => update("gemiOffices", e.target.value)} placeholder="1,2" />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div>
            <FieldLabel>Ταξινόμηση</FieldLabel>
            <select
              value={form.sortBy}
              onChange={(e) => update("sortBy", e.target.value as GemiSortBy)}
              className="rounded-md border px-2.5 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Ανά σελίδα</FieldLabel>
            <select
              value={form.pageSize}
              onChange={(e) => update("pageSize", parseInt(e.target.value, 10))}
              className="rounded-md border px-2.5 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1" />
          <Btn variant="secondary" size="md" onClick={reset} disabled={isSearching}>Καθαρισμός</Btn>
          <Btn variant="primary" size="md" onClick={() => runSearch(0)} disabled={isSearching}>
            {isSearching
              ? <><Loader2 className="size-3.5 animate-spin" /> Αναζήτηση…</>
              : <><Search className="size-3.5" /> Αναζήτηση</>}
          </Btn>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] bg-red-500/10 border border-red-500/20">
          <AlertCircle className="size-4 text-red-400 shrink-0" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* ── Results ── */}
      {searched && !error && (
        <>
          {meta && (
            <div className="flex items-center justify-between text-[12px] text-[var(--muted-foreground)]">
              <span>
                {meta.totalCount === 0
                  ? "Δεν βρέθηκαν αποτελέσματα"
                  : `${meta.resultsOffset + 1}–${Math.min(meta.resultsOffset + results.length, meta.totalCount)} από ${meta.totalCount.toLocaleString("el-GR")}`}
              </span>
              {meta.totalCount > form.pageSize && (
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(1)} disabled={currentPage <= 1 || isSearching} className="size-7 inline-flex items-center justify-center rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--accent)]"><ChevronsLeft className="size-3.5" /></button>
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || isSearching} className="size-7 inline-flex items-center justify-center rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--accent)]"><ChevronLeft className="size-3.5" /></button>
                  <span className="px-2 text-[12px] tabular-nums">{currentPage} / {totalPages}</span>
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || isSearching} className="size-7 inline-flex items-center justify-center rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--accent)]"><ChevronRightIcon className="size-3.5" /></button>
                  <button onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages || isSearching} className="size-7 inline-flex items-center justify-center rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--accent)]"><ChevronsRight className="size-3.5" /></button>
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              {results.map((c, i) => {
                const isOpen = expanded.has(c.arGemi)
                const address = formatGemiAddress(c)
                return (
                  <div key={c.arGemi} style={{ borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none" }}>
                    {/* Row */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(c.arGemi)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/30"
                    >
                      <span className="mt-0.5 text-[var(--muted-foreground)]">
                        {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </span>
                      <div className="size-9 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-900 to-indigo-700">
                        <Building2 className="size-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                            {c.coNameEl ?? "—"}
                          </p>
                          <StatusBadge active={c.status?.descr ? !c.status.descr.toLowerCase().includes("διαγρ") && !c.status.descr.toLowerCase().includes("ανεν") : undefined} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap" style={{ color: "var(--muted-foreground)" }}>
                          <span className="font-mono">ΓΕΜΗ {c.arGemi}</span>
                          {c.afm && <span className="font-mono">ΑΦΜ {c.afm}</span>}
                          {c.legalType?.descr && <span>{c.legalType.descr}</span>}
                          {address && <span className="truncate">{address}</span>}
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && <CompanyDetail c={c} docs={docs.get(c.arGemi)} />}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
