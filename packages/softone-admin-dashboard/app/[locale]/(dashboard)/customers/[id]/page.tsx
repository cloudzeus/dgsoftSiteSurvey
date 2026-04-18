import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, MapPin, Phone, Mail, Globe, Building2,
  Users, Tag, FileText, Calendar, Hash, Briefcase,
  CheckCircle2, XCircle, ExternalLink,
  Paperclip, FileImage, File as FileIcon, Download,
} from "lucide-react"

export const dynamic = "force-dynamic"

function fmt(d: Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))  return <FileImage className="size-4 text-sky-400" />
  if (mimeType === "application/pdf") return <FileText  className="size-4 text-rose-400" />
  if (mimeType.startsWith("text/"))   return <FileText  className="size-4 text-amber-400" />
  return <FileIcon className="size-4" style={{ color: "var(--muted-foreground)" }} />
}

function val(v: string | number | null | undefined, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback
  return String(v)
}

function SectionCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-1 h-4 rounded-full" style={{ background: accent }} />
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
      <p
        className={`text-[13px] ${mono ? "font-mono" : ""}`}
        style={{ color: value === "—" ? "var(--muted-foreground)" : "var(--foreground)" }}
      >
        {value}
      </p>
    </div>
  )
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const customer = await db.customer.findUnique({
    where: { id: Number(id) },
    include: {
      kads:     { orderBy: [{ kadType: "asc" }, { kadCode: "asc" }] },
      contacts: { orderBy: { name: "asc" } },
      branches: { orderBy: { name: "asc" } },
      files:    { where: { surveyId: null }, orderBy: { createdAt: "desc" } },
    },
  })
  if (!customer) notFound()

  const isProspect = customer.isprosp === 1
  const hasCoords = customer.latitude != null && customer.longitude != null
  const primaryKads   = customer.kads.filter((k) => k.kadType === "1")
  const secondaryKads = customer.kads.filter((k) => k.kadType === "2")

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/customers"
          className="mt-0.5 size-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-[var(--muted)]"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-bold tracking-tight truncate" style={{ color: "var(--foreground)" }}>
              {val(customer.name, "Unnamed Customer")}
            </h1>
            <span
              className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: isProspect ? "#f59e0b20" : "#22c55e20",
                color:      isProspect ? "#f59e0b"   : "#22c55e",
              }}
            >
              {isProspect ? "Prospect" : "Customer"}
            </span>
            {customer.consent && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: "#6366f120", color: "#6366f1" }}>
                Consent
              </span>
            )}
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {customer.sotitle && <span>{customer.sotitle} · </span>}
            {customer.trdr ? <span>TRDR {customer.trdr}</span> : <span className="italic">Not synced to Softone</span>}
            {customer.code && <span> · #{customer.code}</span>}
          </p>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Branches",  value: customer.branches.length,          color: "#6366f1" },
          { label: "Contacts",  value: customer.contacts.length,          color: "#0ea5e9" },
          { label: "KAD Codes", value: customer.kads.length,              color: "#10b981" },
          { label: "Files",     value: customer.files.length,             color: "#a855f7" },
          { label: "Employees", value: customer.numberOfEmployees ?? "—", color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4 relative overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: color }} />
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{label}</p>
            <p className="text-[26px] font-bold tabular-nums mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* General Info + Classification side by side on wider screens */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Identity */}
        <SectionCard title="Identity" accent="#6366f1">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="AFM" value={val(customer.afm)} mono />
            <Field label="IRS DOY" value={val(customer.irsdata)} />
            <Field label="GEMI Code" value={val(customer.gemiCode)} mono />
            <Field label="Registration Date" value={fmt(customer.registrationDate)} />
            <Field label="Employees" value={val(customer.numberOfEmployees)} />
            <Field label="Consent" value={
              customer.consent
                ? <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="size-3.5" /> Yes</span>
                : <span className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><XCircle className="size-3.5" /> No</span>
            } />
          </div>
        </SectionCard>

        {/* Classification */}
        <SectionCard title="Classification" accent="#8b5cf6">
          <div className="grid grid-cols-1 gap-y-4">
            <Field label="Job Type" value={val(customer.jobtypetrd)} />
            <Field label="Job Type ID" value={customer.jobtype ? String(customer.jobtype) : "—"} mono />
            <Field label="Business Type" value={val(customer.trdbusiness)} />
            <Field label="Price Group" value={customer.trdpgroup ? String(customer.trdpgroup) : "—"} />
          </div>
        </SectionCard>
      </div>

      {/* Contact & Location side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Contact */}
        <SectionCard title="Contact" accent="#0ea5e9">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Phone className="size-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <div>
                <p className="text-[12px]" style={{ color: "var(--foreground)" }}>{val(customer.phone01)}</p>
                {customer.phone02 && (
                  <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{customer.phone02}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="size-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <div className="min-w-0">
                {customer.email
                  ? <a href={`mailto:${customer.email}`} className="text-[12px] text-[#6366f1] hover:underline truncate block">{customer.email}</a>
                  : <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>—</p>}
                {customer.emailacc && (
                  <a href={`mailto:${customer.emailacc}`} className="text-[12px] text-[#6366f1] hover:underline truncate block">{customer.emailacc}</a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Globe className="size-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              {customer.webpage
                ? <a href={customer.webpage} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] text-[#6366f1] hover:underline flex items-center gap-1 truncate">
                    {customer.webpage} <ExternalLink className="size-3 shrink-0" />
                  </a>
                : <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>—</p>}
            </div>
          </div>
        </SectionCard>

        {/* Location */}
        <SectionCard title="Location" accent="#10b981">
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="size-3.5 shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }} />
              <div>
                <p className="text-[13px]" style={{ color: "var(--foreground)" }}>
                  {[customer.address, customer.zip, customer.city, customer.district, customer.area]
                    .filter(Boolean).join(", ") || "—"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Country ID: {val(customer.country)}
                </p>
              </div>
            </div>
            {hasCoords && (
              <a
                href={`https://maps.google.com/?q=${customer.latitude},${customer.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6366f1] hover:underline"
              >
                <MapPin className="size-3" />
                {customer.latitude?.toFixed(6)}, {customer.longitude?.toFixed(6)}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Remarks */}
      {customer.remark && (
        <SectionCard title="Remarks" accent="#f59e0b">
          <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: "var(--foreground)" }}>
            {customer.remark}
          </p>
        </SectionCard>
      )}

      {/* KAD Codes */}
      {customer.kads.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="w-1 h-4 rounded-full" style={{ background: "#10b981" }} />
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              Activity Codes (KAD)
            </h2>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
              {customer.kads.length}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Code", "Description", "Type"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...primaryKads, ...secondaryKads].map((k, i, arr) => (
                <tr key={k.id} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: "#6366f1" }}>{k.kadCode}</td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--foreground)" }}>{k.kadDescription}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: k.kadType === "1" ? "#6366f120" : "#64748b20",
                        color:      k.kadType === "1" ? "#6366f1"   : "#64748b",
                      }}>
                      {k.kadType === "1" ? "Primary" : "Secondary"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Branches */}
      {customer.branches.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="w-1 h-4 rounded-full" style={{ background: "#6366f1" }} />
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Branches</h2>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
              {customer.branches.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {customer.branches.map((b) => (
              <div key={b.id} className="px-4 py-3 grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-4">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                    {val(b.name, "Branch")}
                  </p>
                  {b.code && (
                    <p className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>#{b.code}</p>
                  )}
                  {b.trdbranch && (
                    <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>TRDBRANCH {b.trdbranch}</p>
                  )}
                </div>
                <div>
                  <p className="text-[12px]" style={{ color: "var(--foreground)" }}>
                    {[b.address, b.zip, b.areas, b.district].filter(Boolean).join(", ") || "—"}
                  </p>
                  {(b.phone1 || b.email) && (
                    <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {[b.phone1, b.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div>
                  {b.jobtypetrd && (
                    <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{b.jobtypetrd}</p>
                  )}
                  {b.latitude != null && b.longitude != null && (
                    <a
                      href={`https://maps.google.com/?q=${b.latitude},${b.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#6366f1] hover:underline"
                    >
                      <MapPin className="size-3" /> Map <ExternalLink className="size-3" />
                    </a>
                  )}
                  {b.remarks && (
                    <p className="text-[11px] mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>{b.remarks}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts */}
      {customer.contacts.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="w-1 h-4 rounded-full" style={{ background: "#0ea5e9" }} />
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Contacts</h2>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
              {customer.contacts.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {customer.contacts.map((c) => (
              <div key={c.id} className="px-4 py-3 grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-4">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                    {val(c.name, "Contact")}
                  </p>
                  {c.position && (
                    <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{c.position}</p>
                  )}
                </div>
                <div className="space-y-0.5">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-[12px] text-[#6366f1] hover:underline">
                      <Mail className="size-3" /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <p className="flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground)" }}>
                      <Phone className="size-3" style={{ color: "var(--muted-foreground)" }} /> {c.phone}
                    </p>
                  )}
                  {c.mobile && (
                    <p className="flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground)" }}>
                      <Phone className="size-3" style={{ color: "var(--muted-foreground)" }} /> {c.mobile}
                    </p>
                  )}
                </div>
                <div>
                  {[c.address, c.zip, c.city, c.country].filter(Boolean).join(", ") && (
                    <p className="text-[12px]" style={{ color: "var(--foreground)" }}>
                      {[c.address, c.zip, c.city, c.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {c.remarks && (
                    <p className="text-[11px] mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>{c.remarks}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {customer.files.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="w-1 h-4 rounded-full" style={{ background: "#a855f7" }} />
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Files</h2>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
              {customer.files.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {customer.files.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                {/* Icon */}
                <div className="size-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                  <FileTypeIcon mimeType={f.mimeType} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>{f.name}</p>
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
                    {formatBytes(f.size)} · {f.mimeType} · {new Date(f.createdAt).toLocaleDateString("el-GR")}
                  </p>
                </div>

                {/* Download */}
                <a
                  href={f.cdnUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--muted)]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Download className="size-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps footer */}
      <div className="flex items-center gap-6 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        <span>Created: <span className="font-medium">{fmt(customer.insdate)}</span></span>
        <span>Updated: <span className="font-medium">{fmt(customer.upddate)}</span></span>
        {customer.prjcs != null && <span>PRJCS: <span className="font-mono font-medium">{customer.prjcs}</span></span>}
      </div>
    </div>
  )
}
