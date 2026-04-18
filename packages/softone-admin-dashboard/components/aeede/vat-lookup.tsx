"use client"

import { useState, useTransition, lazy, Suspense } from "react"
import dynamic from "next/dynamic"
import {
  Search, Building2, MapPin, Calendar, Tag,
  AlertCircle, Loader2, CheckCircle2, XCircle, Navigation,
  Globe, Mail, ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn } from "@/components/ui/btn"
import { lookupVat, geocodeAddress, lookupCompanyWeb, type AddressComponents } from "@/app/actions/aeede"
import { gemiSearch, gemiGetDocuments } from "@/app/actions/gemi"
import { saveCustomerFromLookup } from "@/app/actions/customer-from-lookup"
import type { AeedeResult } from "@/lib/aeede"
import type { CompanyWebInfo } from "@/lib/brave-search"
import type { GemiCompany, GemiDocumentSet } from "@/lib/gemi"
import { formatGemiAddress, reconcileContacts } from "@/lib/gemi"
import { Save, FileText, Briefcase, Coins, Hash, Download } from "lucide-react"

// Leaflet uses window — must be client-only, no SSR
const AddressMap = dynamic(
  () => import("./address-map").then((m) => m.AddressMap),
  { ssr: false, loading: () => <MapPlaceholder label="Φόρτωση χάρτη…" /> },
)

// ─── Sub-components ────────────────────────────────────────────────────────────

function MapPlaceholder({ label }: { label: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-2xl" style={{ background: "var(--muted)" }}>
      <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-[11px] w-40 shrink-0 font-medium pt-px" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </span>
      <span className="text-[13px] font-medium flex-1" style={{ color: "var(--foreground)" }}>
        {value}
      </span>
    </div>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border shrink-0",
      active
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : "bg-red-500/10 text-red-400 border-red-500/20"
    )}>
      {active ? <><CheckCircle2 className="size-3" /> Ενεργός</> : <><XCircle className="size-3" /> Ανενεργός</>}
    </span>
  )
}

function GemiRow({ icon, label, value, link }: { icon: React.ReactNode; label: string; value?: string | null; link?: string }) {
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

function KadBadge({ kind }: { kind: string }) {
  const primary = kind === "1"
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0",
      primary
        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
    )}>
      {primary ? "ΚΥΡΙΑ" : "ΔΕΥΤΕΡ."}
    </span>
  )
}

// ─── Coordinates state ─────────────────────────────────────────────────────────

interface Coords {
  lat: number
  lon: number
  displayName: string
}

// ─── Main component ────────────────────────────────────────────────────────────

export function VatLookup() {
  const [afm, setAfm]       = useState("")
  const [result, setResult] = useState<AeedeResult | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [coords, setCoords]     = useState<Coords | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [webInfo, setWebInfo]   = useState<CompanyWebInfo | null>(null)
  const [webError, setWebError] = useState<string | null>(null)
  const [gemi, setGemi]         = useState<GemiCompany | null>(null)
  const [gemiError, setGemiError] = useState<string | null>(null)
  const [docs, setDocs]         = useState<GemiDocumentSet | null>(null)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [saveMsg, setSaveMsg]   = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const [isSearching, startSearch]   = useTransition()
  const [isGeocoding, startGeocode]  = useTransition()
  const [isWebLookup, startWebLookup] = useTransition()
  const [isGemiLookup, startGemiLookup] = useTransition()
  const [isDocsLookup, startDocsLookup] = useTransition()
  const [isSaving, startSave] = useTransition()

  function handleSearch() {
    setError(null)
    setResult(null)
    setCoords(null)
    setGeoError(null)
    setWebInfo(null)
    setWebError(null)
    setGemi(null)
    setGemiError(null)
    setDocs(null)
    setDocsError(null)
    setSaveMsg(null)
    startSearch(async () => {
      const res = await lookupVat(afm)
      if (res.ok) {
        setResult(res.data)
        // Fire-and-forget GEMI lookup by AFM (parallel display).
        startGemiLookup(async () => {
          const g = await gemiSearch({ afm, resultsSize: 1 })
          if (g.ok) {
            const company = g.data.searchResults[0] ?? null
            setGemi(company)
            if (!company) {
              setGemiError("Δεν βρέθηκε εταιρεία στο ΓΕΜΗ")
            } else {
              // Once we have an arGemi, fetch documents.
              startDocsLookup(async () => {
                const d = await gemiGetDocuments(String(company.arGemi))
                if (d.ok) setDocs(d.data)
                else setDocsError(d.error)
              })
            }
          } else {
            setGemiError(g.error)
          }
        })
      } else {
        setError(res.error)
      }
    })
  }

  function handleSave() {
    if (!result) return
    setSaveMsg(null)
    startSave(async () => {
      const res = await saveCustomerFromLookup({ aeede: result, gemi, webInfo })
      if (res.ok) {
        const docsPart = res.docCount > 0 ? ` · ${res.docCount} έγγραφα` : ""
        setSaveMsg({
          kind: "ok",
          text: res.created
            ? `Δημιουργήθηκε νέος πελάτης (#${res.customerId})${docsPart}`
            : `Ενημερώθηκε ο πελάτης (#${res.customerId})${docsPart}`,
        })
      } else {
        setSaveMsg({ kind: "err", text: res.error })
      }
    })
  }

  function handleGeocode() {
    if (!r) return
    const components: AddressComponents = {
      street:      r.postalAddress      || undefined,
      houseNumber: r.postalAddressNo    || undefined,
      postalCode:  r.postalZipCode      || undefined,
      city:        r.postalAreaDescription || undefined,
    }
    setGeoError(null)
    setCoords(null)
    startGeocode(async () => {
      const res = await geocodeAddress(components)
      if (res.ok) setCoords({ lat: res.lat, lon: res.lon, displayName: res.displayName })
      else setGeoError(res.error)
    })
  }

  function handleWebLookup() {
    if (!r) return
    // Prefer trading name (commerTitle) as it's usually shorter and more searchable
    const name = r.commerTitle || r.onomasia
    setWebError(null)
    setWebInfo(null)
    startWebLookup(async () => {
      const res = await lookupCompanyWeb(name, r.postalAreaDescription)
      if (res.ok) setWebInfo(res.data)
      else setWebError(res.error)
    })
  }

  const r         = result?.basicRec
  const isActive  = r?.deactivationFlag === "1"
  const hasAddress = r && (r.postalAddress || r.postalAreaDescription)
  const fullAddress = r
    ? [r.postalAddress, r.postalAddressNo, r.postalZipCode, r.postalAreaDescription].filter(Boolean).join(" ")
    : null

  return (
    <div className="space-y-5">

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            value={afm}
            onChange={(e) => setAfm(e.target.value.replace(/\D/g, "").slice(0, 9))}
            onKeyDown={(e) => e.key === "Enter" && !isSearching && afm.length === 9 && handleSearch()}
            placeholder="Εισάγετε ΑΦΜ (9 ψηφία)"
            maxLength={9}
            className="w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono tracking-wider"
            style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>
        <Btn variant="primary" size="md" onClick={handleSearch} disabled={afm.length !== 9 || isSearching}>
          {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : "Αναζήτηση"}
        </Btn>
      </div>

      {/* Search error */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] bg-red-500/10 border border-red-500/20">
          <AlertCircle className="size-4 text-red-400 shrink-0" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && r && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">

          {/* ── Company card ── */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {/* Header */}
            <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/30" }}>
              <div className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-900 to-indigo-700 shadow">
                <Building2 className="size-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold leading-tight truncate" style={{ color: "var(--foreground)" }}>
                  {r.onomasia}
                </p>
                {r.commerTitle && r.commerTitle !== r.onomasia && (
                  <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>
                    {r.commerTitle}
                  </p>
                )}
              </div>
              <StatusPill active={isActive} />
            </div>

            {/* Details */}
            <div className="px-5 py-1">
              <InfoRow label="ΑΦΜ"          value={r.afm} />
              <InfoRow label="Νομική Μορφή"  value={r.legalStatusDescr} />
              <InfoRow label="Κατηγορία"     value={r.firmFlagDescr} />
              <InfoRow label="Φ.Π."          value={r.iNiFlagDescr} />
              <InfoRow label="Κανονικό ΦΠΑ"  value={r.normalVatSystemFlag === "Y" ? "Ναι" : "Όχι"} />
            </div>

            {/* Address row + geocode button */}
            {fullAddress && (
              <div className="mx-5 mb-4 space-y-2">
                <div className="rounded-xl px-3.5 py-3 flex items-start gap-2.5" style={{ background: "var(--muted)" }}>
                  <MapPin className="size-3.5 mt-0.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  <span className="text-[12px] flex-1" style={{ color: "var(--foreground)" }}>{fullAddress}</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {!coords && (
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={handleGeocode}
                      disabled={isGeocoding}
                      fullWidth
                    >
                      {isGeocoding
                        ? <><Loader2 className="size-3.5 animate-spin" /> Αναζήτηση…</>
                        : <><Navigation className="size-3.5" /> Χάρτης</>}
                    </Btn>
                  )}
                  {!webInfo && (
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={handleWebLookup}
                      disabled={isWebLookup}
                      fullWidth
                    >
                      {isWebLookup
                        ? <><Loader2 className="size-3.5 animate-spin" /> Αναζήτηση…</>
                        : <><Globe className="size-3.5" /> Ιστοσελίδα / Email</>}
                    </Btn>
                  )}
                </div>

                {/* Geocode error */}
                {geoError && (
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="size-3.5 text-red-400 shrink-0" />
                    <span className="text-red-400">{geoError}</span>
                  </div>
                )}

                {/* Web lookup error */}
                {webError && (
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="size-3.5 text-red-400 shrink-0" />
                    <span className="text-red-400">{webError}</span>
                  </div>
                )}

                {/* Coordinates badge */}
                {coords && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      <CheckCircle2 className="size-3" />
                      {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
                    </span>
                    <button
                      onClick={() => { setCoords(null); setGeoError(null) }}
                      className="text-[10px] underline underline-offset-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Επαναφορά
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            {/* DOY + Dates */}
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <Calendar className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  ΔΟΥ & Ημερομηνίες
                </span>
              </div>
              <div className="px-4 py-1">
                <InfoRow label="ΔΟΥ"          value={r.doyDescr} />
                <InfoRow label="Κωδ. ΔΟΥ"     value={r.doy} />
                <InfoRow label="Ημ. Έναρξης"   value={r.registDate} />
                {r.stopDate && <InfoRow label="Ημ. Διακοπής" value={r.stopDate} />}
              </div>
            </div>

            {/* KAD count */}
            <div className="rounded-2xl border px-4 py-3.5 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="size-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-900 to-amber-700 shadow shrink-0">
                <Tag className="size-4 text-white" />
              </div>
              <div>
                <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: "var(--foreground)" }}>
                  {result.activities.length}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Κωδικοί ΚΑΔ ({result.activities.filter(a => a.firmActKind === "1").length} κύριοι)
                </p>
              </div>
            </div>

            {/* Web info card */}
            {webInfo && (webInfo.website || webInfo.email) && (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <Globe className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Διαδικτυακή Παρουσία
                  </span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {webInfo.website && (
                    <div className="flex items-start gap-2.5">
                      <Globe className="size-3.5 mt-0.5 shrink-0 text-indigo-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>
                          Ιστοσελίδα
                        </p>
                        <a
                          href={webInfo.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors break-all flex items-center gap-1"
                        >
                          {webInfo.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                  )}
                  {webInfo.email && (
                    <div className="flex items-start gap-2.5">
                      <Mail className="size-3.5 mt-0.5 shrink-0 text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>
                          Email
                        </p>
                        <a
                          href={`mailto:${webInfo.email}`}
                          className="text-[12px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors break-all"
                        >
                          {webInfo.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {!webInfo.website && !webInfo.email && (
                    <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      Δεν βρέθηκε ιστοσελίδα ή email.
                    </p>
                  )}
                  {webInfo.source && webInfo.email && (
                    <p className="text-[10px] pt-1" style={{ color: "var(--muted-foreground)" }}>
                      Email από: {webInfo.source.replace(/^https?:\/\//, "").split("/")[0]}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* No results state */}
            {webInfo && !webInfo.website && !webInfo.email && (
              <div className="rounded-2xl border px-4 py-3.5 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <Globe className="size-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Δεν βρέθηκε ιστοσελίδα ή email για αυτή την εταιρεία.
                </p>
              </div>
            )}
          </div>

          {/* ── GEMI panel — full width ── */}
          <div className="lg:col-span-2 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Στοιχεία ΓΕΜΗ
                </span>
              </div>
              <Btn
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                title="Δημιουργία ή ενημέρωση Πελάτη με στοιχεία AAEDE + ΓΕΜΗ"
              >
                {isSaving
                  ? <><Loader2 className="size-3.5 animate-spin" /> Αποθήκευση…</>
                  : <><Save className="size-3.5" /> Αποθήκευση Πελάτη</>}
              </Btn>
            </div>

            <div className="px-5 py-4">
              {isGemiLookup && (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  <Loader2 className="size-3.5 animate-spin" /> Αναζήτηση στο ΓΕΜΗ…
                </div>
              )}
              {!isGemiLookup && gemiError && !gemi && (
                <div className="flex items-center gap-2 text-[12px] text-amber-400">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {gemiError}
                </div>
              )}
              {gemi && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <GemiRow icon={<Hash className="size-3" />} label="Αρ. ΓΕΜΗ" value={String(gemi.arGemi)} />
                    <GemiRow icon={<Briefcase className="size-3" />} label="Νομική Μορφή" value={gemi.legalType?.descr} />
                    <GemiRow icon={<FileText className="size-3" />} label="Κατάσταση" value={gemi.status?.descr} />
                    <GemiRow icon={<Calendar className="size-3" />} label="Ημ. Ίδρυσης" value={gemi.incorporationDate} />
                    <GemiRow icon={<Calendar className="size-3" />} label="Τελ. Μεταβολή" value={gemi.lastStatusChange} />
                    <GemiRow icon={<Building2 className="size-3" />} label="Υπηρ. ΓΕΜΗ" value={gemi.gemiOffice?.descr} />
                  </div>
                  <div className="space-y-1">
                    <GemiRow icon={<MapPin className="size-3" />} label="Διεύθυνση" value={formatGemiAddress(gemi)} />
                    <GemiRow icon={<MapPin className="size-3" />} label="Νομός" value={gemi.prefecture?.descr} />
                    <GemiRow icon={<MapPin className="size-3" />} label="Δήμος" value={gemi.municipality?.descr} />
                    {(() => {
                      const { email: cEmail, webpage: cWebpage } = reconcileContacts(gemi.email, gemi.url)
                      return (
                        <>
                          {cWebpage && <GemiRow icon={<Globe className="size-3" />} label="Ιστοσελίδα" value={cWebpage.replace(/^https?:\/\//, "")} link={cWebpage} />}
                          {cEmail && <GemiRow icon={<Mail className="size-3" />} label="Email" value={cEmail} link={`mailto:${cEmail}`} />}
                        </>
                      )
                    })()}
                  </div>

                  {gemi.objective && (
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>
                        Σκοπός
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--foreground)" }}>{gemi.objective}</p>
                    </div>
                  )}

                  {gemi.capital && gemi.capital.length > 0 && (
                    <div className="md:col-span-2 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                        <Coins className="size-3" /> Κεφάλαιο
                      </p>
                      {gemi.capital.map((c, i) => (
                        <p key={i} className="text-[12px]" style={{ color: "var(--foreground)" }}>
                          <span className="font-mono font-semibold">{c.capitalStock?.toLocaleString("el-GR")}</span>{" "}
                          <span className="text-[var(--muted-foreground)]">{c.currency}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {saveMsg && (
                <div className={cn(
                  "mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] border",
                  saveMsg.kind === "ok"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20",
                )}>
                  {saveMsg.kind === "ok" ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                  <span>{saveMsg.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Documents panel — shown after GEMI lookup succeeds ── */}
          {gemi && (
            <div className="lg:col-span-2 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <FileText className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Έγγραφα ΓΕΜΗ
                  {docs && (
                    <span className="ml-2 font-normal text-[var(--foreground)]">
                      — {docs.decision.length + docs.publication.length}
                    </span>
                  )}
                </span>
              </div>

              <div className="px-5 py-4">
                {isDocsLookup && (
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    <Loader2 className="size-3.5 animate-spin" /> Φόρτωση εγγράφων…
                  </div>
                )}
                {!isDocsLookup && docsError && (
                  <div className="flex items-center gap-2 text-[12px] text-amber-400">
                    <AlertCircle className="size-3.5 shrink-0" /> {docsError}
                  </div>
                )}
                {!isDocsLookup && docs && docs.decision.length === 0 && docs.publication.length === 0 && (
                  <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Δεν βρέθηκαν διαθέσιμα έγγραφα.</p>
                )}
                {docs && (docs.decision.length > 0 || docs.publication.length > 0) && (
                  <div className="space-y-3">
                    {docs.decision.length > 0 && (
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider bg-[var(--muted)]/40" style={{ color: "var(--muted-foreground)" }}>
                          Αποφάσεις / Ανακοινώσεις ({docs.decision.length})
                        </div>
                        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                          {docs.decision.map((d, i) => (
                            <div key={`dec-${i}`} className="px-3 py-2.5 flex items-start gap-2">
                              <FileText className="size-3.5 mt-0.5 shrink-0 text-indigo-400" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                                  {d.decisionSubject || d.assembly || "—"}
                                </p>
                                {d.summary && (
                                  <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{d.summary}</p>
                                )}
                                <div className="flex items-center gap-3 flex-wrap text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                                  {d.kak && <span className="font-mono">ΚΑΚ {d.kak}</span>}
                                  {d.dateAnnounced && <span>Αν: {d.dateAnnounced}</span>}
                                  {d.dateAssemblyDecided && <span>Απόφ: {d.dateAssemblyDecided}</span>}
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
                          ))}
                        </div>
                      </div>
                    )}

                    {docs.publication.length > 0 && (
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider bg-[var(--muted)]/40" style={{ color: "var(--muted-foreground)" }}>
                          ΥΜΣ Δημοσιεύσεις ({docs.publication.length})
                        </div>
                        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                          {docs.publication.map((p, i) => (
                            <div key={`pub-${i}`} className="px-3 py-2.5 flex items-center gap-2">
                              <FileText className="size-3.5 shrink-0 text-violet-400" />
                              <p className="text-[12px] font-mono flex-1" style={{ color: "var(--foreground)" }}>
                                {p.kad || "—"}
                              </p>
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
                )}
              </div>
            </div>
          )}

          {/* ── Map — full width, shown after geocoding ── */}
          {coords && (
            <div className="lg:col-span-2 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", height: 380 }}>
              <AddressMap
                lat={coords.lat}
                lon={coords.lon}
                label={`${r.onomasia} — ${fullAddress}`}
              />
            </div>
          )}

          {/* ── KAD table — full width ── */}
          {result.activities.length > 0 && (
            <div className="lg:col-span-2 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/30" }}>
                <Tag className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Κωδικοί Αριθμοί Δραστηριότητας (ΚΑΔ)
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Κωδικός", "Περιγραφή", "Είδος"].map((h) => (
                      <th key={h} className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.activities
                    .sort((a, b) => Number(a.firmActKind) - Number(b.firmActKind))
                    .map((act, i) => (
                      <tr
                        key={`${act.firmActCode}-${i}`}
                        className={cn("transition-colors hover:bg-[var(--muted)]/40", act.firmActKind === "1" && "bg-indigo-500/3")}
                        style={{ borderBottom: i < result.activities.length - 1 ? "1px solid var(--border)" : "none" }}
                      >
                        <td className="px-5 py-3">
                          <span className="text-[12px] font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                            {act.firmActCode}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[12px]" style={{ color: "var(--foreground)" }}>
                            {act.firmActDescr}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <KadBadge kind={act.firmActKind} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
