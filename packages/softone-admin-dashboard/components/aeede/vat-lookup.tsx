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
import type { AeedeResult } from "@/lib/aeede"
import type { CompanyWebInfo } from "@/lib/brave-search"

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

  const [isSearching, startSearch]   = useTransition()
  const [isGeocoding, startGeocode]  = useTransition()
  const [isWebLookup, startWebLookup] = useTransition()

  function handleSearch() {
    setError(null)
    setResult(null)
    setCoords(null)
    setGeoError(null)
    setWebInfo(null)
    setWebError(null)
    startSearch(async () => {
      const res = await lookupVat(afm)
      if (res.ok) setResult(res.data)
      else setError(res.error)
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
