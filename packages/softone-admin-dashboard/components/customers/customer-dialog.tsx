"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Loader2, ContactRound, AlertTriangle, Search, Check, Building2, MapPin, RefreshCw, CheckCircle2 } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { geocodeAddress } from "@/app/actions/aeede"
import { cn } from "@/lib/utils"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CustomerBranch = { id: number; name: string | null; code: string | null }

export type CustomerRow = {
  id: number
  trdr: number | null
  code: string | null
  name: string | null
  afm: string | null
  sotitle: string | null
  isprosp: number
  country: number | null
  address: string | null
  zip: string | null
  district: string | null
  city: string | null
  area: string | null
  latitude: number | null
  longitude: number | null
  phone01: string | null
  phone02: string | null
  jobtype: number | null
  jobtypetrd: string | null
  trdpgroup: number | null
  webpage: string | null
  email: string | null
  emailacc: string | null
  trdbusiness: number | null
  irsdata: string | null
  consent: boolean
  prjcs: number | null
  remark: string | null
  registrationDate: string | null
  numberOfEmployees: number | null
  gemiCode: string | null
  insdate: string | null
  upddate: string | null
  branches: CustomerBranch[]
}

export type Country     = { id: number; name: string }
export type JobType     = { id: number; name: string }
export type TrdBusiness = { id: number; name: string }
export type TrdGroup    = { id: number; name: string }

type FormState = Omit<CustomerRow, "id" | "insdate" | "upddate">

const EMPTY: FormState = {
  trdr: null, code: "", name: "", afm: "", sotitle: "",
  isprosp: 0, country: null, address: "", zip: "", district: "",
  city: "", area: "", latitude: null, longitude: null,
  phone01: "", phone02: "", jobtype: null, jobtypetrd: "",
  trdpgroup: null, webpage: "", email: "", emailacc: "",
  trdbusiness: null, irsdata: "", consent: false, prjcs: null, remark: "",
  registrationDate: null, numberOfEmployees: null, gemiCode: "",
  branches: [],
}

function rowToForm(c: CustomerRow): FormState {
  return {
    trdr: c.trdr, code: c.code ?? "", name: c.name ?? "",
    afm: c.afm ?? "", sotitle: c.sotitle ?? "",
    isprosp: c.isprosp, country: c.country, address: c.address ?? "",
    zip: c.zip ?? "", district: c.district ?? "", city: c.city ?? "",
    area: c.area ?? "", latitude: c.latitude, longitude: c.longitude,
    phone01: c.phone01 ?? "", phone02: c.phone02 ?? "",
    jobtype: c.jobtype, jobtypetrd: c.jobtypetrd ?? "",
    trdpgroup: c.trdpgroup, webpage: c.webpage ?? "",
    email: c.email ?? "", emailacc: c.emailacc ?? "",
    trdbusiness: c.trdbusiness, irsdata: c.irsdata ?? "",
    consent: c.consent, prjcs: c.prjcs, remark: c.remark ?? "",
    registrationDate: c.registrationDate ?? null,
    numberOfEmployees: c.numberOfEmployees ?? null,
    gemiCode: c.gemiCode ?? "",
    branches: c.branches,
  }
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

const inputBase = "w-full rounded-lg border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[var(--muted-foreground)]/40 transition-colors"

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-full" : undefined}>
      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--foreground)]/60">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputBase} />
}

function NumInput({ value, onChange, placeholder }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <input
      type="number" value={value ?? ""} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className={inputBase}
    />
  )
}

function DateInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputBase}
    />
  )
}

function Section({ title, children, color = "indigo" }: { title: string; children: React.ReactNode; color?: "indigo" | "violet" | "sky" | "emerald" }) {
  const accent: Record<string, string> = {
    indigo: "border-indigo-500/50 text-indigo-400",
    violet: "border-violet-500/50 text-violet-400",
    sky:    "border-sky-500/50 text-sky-400",
    emerald:"border-emerald-500/50 text-emerald-400",
  }
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 p-4 space-y-3">
      <p className={cn("text-[10px] font-bold uppercase tracking-widest border-l-2 pl-2", accent[color])}>{title}</p>
      {children}
    </div>
  )
}

// ─── Generic combobox ──────────────────────────────────────────────────────────

type ComboItem = { id: number; name: string }

function Combobox({
  value, onChange, items, loading, placeholder,
}: {
  value: number | null
  onChange: (v: number | null) => void
  items: ComboItem[]
  loading: boolean
  placeholder: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")

  const unique   = Array.from(new Map(items.map((i) => [i.id, i])).values())
  const selected = unique.find((i) => i.id === value)
  const filtered = query
    ? unique.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : unique

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(inputBase, "flex items-center justify-between text-left")}
        style={{ height: "32px" }}
      >
        <span className={cn("truncate", selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]/40")}>
          {loading ? "Loading…" : selected ? selected.name : placeholder}
        </span>
        <Search className="size-3 text-[var(--muted-foreground)]/60 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-[60] top-full mt-1 left-0 right-0 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-[var(--border)]">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/40"
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setQuery("") }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors"
            >
              — None
            </button>
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onChange(item.id); setOpen(false); setQuery("") }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left hover:bg-[var(--muted)] transition-colors"
              >
                {value === item.id && <Check className="size-3 text-indigo-400 flex-shrink-0" />}
                <span className={cn("flex-1 text-[var(--foreground)] truncate", value === item.id && "font-semibold")}>{item.name}</span>
                <span className="text-[10px] font-mono text-[var(--muted-foreground)]/50 flex-shrink-0">{item.id}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-[11px] text-center text-[var(--muted-foreground)]">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dialog ────────────────────────────────────────────────────────────────────

type Tab = "general" | "details"

export function CustomerDialog({
  open, onClose, customer,
}: {
  open: boolean
  onClose: () => void
  customer?: CustomerRow | null
}) {
  const router   = useRouter()
  const isEdit   = !!customer
  const [form,   setForm]   = useState<FormState>(EMPTY)
  const [tab,    setTab]    = useState<Tab>("general")
  const [saving,       setSaving]      = useState(false)
  const [error,        setError]       = useState<string | null>(null)
  const [afmLooking,   setAfmLooking]  = useState(false)
  const [afmError,     setAfmError]    = useState<string | null>(null)
  const [geocoding,    setGeocoding]   = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [pushing,      setPushing]     = useState(false)
  const [pushResult,   setPushResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  const [countries,         setCountries]        = useState<Country[]>([])
  const [countriesLoading,  setCountriesLoading] = useState(false)
  const [jobtypes,          setJobtypes]         = useState<JobType[]>([])
  const [jobtypesLoading,   setJobtypesLoading]  = useState(false)
  const [businesses,        setBusinesses]        = useState<TrdBusiness[]>([])
  const [businessesLoading, setBusinessesLoading] = useState(false)
  const [trdgroups,         setTrdgroups]         = useState<TrdGroup[]>([])
  const [trdgroupsLoading,  setTrdgroupsLoading]  = useState(false)

  useEffect(() => {
    setForm(customer ? rowToForm(customer) : EMPTY)
    setError(null)
    setTab("general")
  }, [customer, open])

  useEffect(() => {
    if (!open || countries.length > 0) return
    setCountriesLoading(true)
    fetch("/api/s1/countries")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCountries(data))
      .catch(() => {})
      .finally(() => setCountriesLoading(false))
  }, [open, countries.length])

  useEffect(() => {
    if (!open || jobtypes.length > 0) return
    setJobtypesLoading(true)
    fetch("/api/s1/jobtypes")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setJobtypes(data.filter((j: JobType, i: number, a: JobType[]) => a.findIndex((x) => x.id === j.id) === i)))
      .catch(() => {})
      .finally(() => setJobtypesLoading(false))
  }, [open, jobtypes.length])

  useEffect(() => {
    if (!open || businesses.length > 0) return
    setBusinessesLoading(true)
    fetch("/api/s1/trdbusiness")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setBusinesses(data))
      .catch(() => {})
      .finally(() => setBusinessesLoading(false))
  }, [open, businesses.length])

  useEffect(() => {
    if (!open || trdgroups.length > 0) return
    setTrdgroupsLoading(true)
    fetch("/api/s1/trdgroup")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setTrdgroups(data))
      .catch(() => {})
      .finally(() => setTrdgroupsLoading(false))
  }, [open, trdgroups.length])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleGeocode(components: { street?: string; houseNumber?: string; postalCode?: string; city?: string }) {
    setGeocoding(true)
    setGeocodeError(null)
    const result = await geocodeAddress(components)
    if (result.ok) {
      setForm((f) => ({ ...f, latitude: result.lat, longitude: result.lon }))
    } else {
      setGeocodeError(result.error)
    }
    setGeocoding(false)
  }

  async function handleAfmLookup() {
    const afm = form.afm?.trim()
    if (!afm) return
    setAfmLooking(true)
    setAfmError(null)
    try {
      const res = await fetch(`/api/s1/afm-lookup?afm=${encodeURIComponent(afm)}`)
      const data = await res.json()
      if (!res.ok) { setAfmError(data.error ?? "Lookup failed"); return }
      setForm((f) => ({
        ...f,
        ...(data.name             && !f.name             ? { name:             data.name             } : {}),
        ...(data.sotitle          && !f.sotitle          ? { sotitle:          data.sotitle          } : {}),
        ...(data.address          && !f.address          ? { address:          data.address          } : {}),
        ...(data.city             && !f.city             ? { city:             data.city             } : {}),
        ...(data.zip              && !f.zip              ? { zip:              data.zip              } : {}),
        ...(data.irsdata          && !f.irsdata          ? { irsdata:          data.irsdata          } : {}),
        ...(data.registrationDate && !f.registrationDate ? { registrationDate: data.registrationDate } : {}),
      }))
      // auto-geocode using raw components from AADE response
      if (data._street || data.zip || data.city) {
        handleGeocode({
          street:      data._street      ?? undefined,
          houseNumber: data._houseNumber ?? undefined,
          postalCode:  data.zip          ?? undefined,
          city:        data.city         ?? undefined,
        })
      }
    } catch {
      setAfmError("Network error")
    } finally {
      setAfmLooking(false)
    }
  }

  async function handlePushS1() {
    if (!customer?.id) return
    setPushing(true)
    setPushResult(null)
    try {
      const res  = await fetch(`/api/customers/${customer.id}/push-s1`, { method: "POST" })
      const data = await res.json()
      setPushResult(res.ok ? { ok: true, msg: "Pushed to Softone" } : { ok: false, msg: data.error ?? "Push failed" })
    } catch {
      setPushResult({ ok: false, msg: "Network error" })
    } finally {
      setPushing(false)
    }
  }

  async function handleSave() {
    if (!form.name?.trim()) { setError("Name is required"); setTab("general"); return }
    setSaving(true)
    setError(null)
    try {
      const url    = isEdit ? `/api/customers/${customer!.id}` : "/api/customers"
      const res    = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Save failed")
      }
      router.refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "details", label: "Details" },
  ]

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden focus:outline-none max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                <ContactRound className="size-4 text-[var(--primary)]" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-bold text-[var(--foreground)]">
                  {isEdit ? "Edit customer" : "New customer"}
                </Dialog.Title>
                <Dialog.Description className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">
                  {isEdit ? `TRDR: ${customer?.trdr ?? "local only"}` : "Fill in details and save"}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="size-8 rounded-xl flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] px-6 flex-shrink-0">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "py-2.5 px-1 mr-6 text-sm font-semibold border-b-2 -mb-px transition-colors",
                  tab === t.key
                    ? "border-indigo-500 text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-6 py-5 space-y-5">

            {/* ── Tab: General ── */}
            {tab === "general" && (
              <>
                {/* Name – prominent hero field */}
                <div className="rounded-xl border-2 border-indigo-500/30 bg-indigo-500/5 px-4 pt-3 pb-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-indigo-400">Name *</label>
                  <input
                    type="text"
                    value={form.name ?? ""}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Company or customer name"
                    className="w-full bg-transparent text-[12px] font-semibold text-[var(--foreground)] placeholder:text-indigo-300/40 focus:outline-none"
                  />
                </div>

                {/* Type toggle */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-[var(--foreground)]/60">Type</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => set("isprosp", 0)}
                      className={cn(
                        "flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold border transition-all",
                        form.isprosp === 0
                          ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-indigo-500/30 hover:text-indigo-400/70"
                      )}
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => set("isprosp", 1)}
                      className={cn(
                        "flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold border transition-all",
                        form.isprosp === 1
                          ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-orange-500/30 hover:text-orange-400/70"
                      )}
                    >
                      Prospect
                    </button>
                  </div>
                </div>

                <Section title="Identity" color="indigo">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Code">
                      <TextInput value={form.code ?? ""} onChange={(v) => set("code", v)} />
                    </Field>
                    <Field label="AFM (VAT)">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={form.afm ?? ""}
                          onChange={(e) => { set("afm", e.target.value); setAfmError(null) }}
                          placeholder="e.g. 123456789"
                          className={cn(inputBase, "flex-1")}
                        />
                        <button
                          type="button"
                          onClick={handleAfmLookup}
                          disabled={!form.afm?.trim() || afmLooking}
                          title="Lookup company info from AADE"
                          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 text-[11px] font-semibold text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {afmLooking
                            ? <Loader2 className="size-3 animate-spin" />
                            : <Building2 className="size-3" />}
                          {afmLooking ? "…" : "AADE"}
                        </button>
                      </div>
                      {afmError && (
                        <p className="mt-1 text-[10px] text-red-400">{afmError}</p>
                      )}
                    </Field>
                    <Field label="SO Title" full>
                      <TextInput value={form.sotitle ?? ""} onChange={(v) => set("sotitle", v)} />
                    </Field>
                  </div>
                  <input type="hidden" value={form.trdr ?? ""} onChange={(e) => set("trdr", e.target.value === "" ? null : Number(e.target.value))} />
                </Section>

                <Section title="Address" color="sky">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Address" full>
                      <TextInput value={form.address ?? ""} onChange={(v) => set("address", v)} />
                    </Field>
                    <Field label="City">
                      <TextInput value={form.city ?? ""} onChange={(v) => set("city", v)} />
                    </Field>
                    <Field label="ZIP">
                      <TextInput value={form.zip ?? ""} onChange={(v) => set("zip", v)} />
                    </Field>
                    <Field label="District">
                      <TextInput value={form.district ?? ""} onChange={(v) => set("district", v)} />
                    </Field>
                    <Field label="Area">
                      <TextInput value={form.area ?? ""} onChange={(v) => set("area", v)} />
                    </Field>
                    <Field label="Country">
                      <Combobox
                        value={form.country}
                        onChange={(v) => set("country", v)}
                        items={countries}
                        loading={countriesLoading}
                        placeholder="Select country…"
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Contact" color="emerald">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone 01">
                      <TextInput value={form.phone01 ?? ""} onChange={(v) => set("phone01", v)} />
                    </Field>
                    <Field label="Phone 02">
                      <TextInput value={form.phone02 ?? ""} onChange={(v) => set("phone02", v)} />
                    </Field>
                    <Field label="Email">
                      <TextInput value={form.email ?? ""} onChange={(v) => set("email", v)} />
                    </Field>
                    <Field label="Email (accounting)">
                      <TextInput value={form.emailacc ?? ""} onChange={(v) => set("emailacc", v)} />
                    </Field>
                    <Field label="Webpage" full>
                      <TextInput value={form.webpage ?? ""} onChange={(v) => set("webpage", v)} placeholder="https://" />
                    </Field>
                  </div>
                </Section>
              </>
            )}

            {/* ── Tab: Details ── */}
            {tab === "details" && (
              <>
                <Section title="Classification" color="violet">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Job Type">
                      <Combobox
                        value={form.jobtype}
                        onChange={(v) => set("jobtype", v)}
                        items={jobtypes}
                        loading={jobtypesLoading}
                        placeholder="Select job type…"
                      />
                    </Field>
                    <Field label="Job Type TRD">
                      <TextInput value={form.jobtypetrd ?? ""} onChange={(v) => set("jobtypetrd", v)} />
                    </Field>
                    <Field label="TRD Group">
                      <Combobox
                        value={form.trdpgroup}
                        onChange={(v) => set("trdpgroup", v)}
                        items={trdgroups}
                        loading={trdgroupsLoading}
                        placeholder="Select group…"
                      />
                    </Field>
                    <Field label="TRD Business">
                      <Combobox
                        value={form.trdbusiness}
                        onChange={(v) => set("trdbusiness", v)}
                        items={businesses}
                        loading={businessesLoading}
                        placeholder="Select business…"
                      />
                    </Field>
                    <Field label="IRS Data">
                      <TextInput value={form.irsdata ?? ""} onChange={(v) => set("irsdata", v)} />
                    </Field>
                    <Field label="PRJCS">
                      <NumInput value={form.prjcs} onChange={(v) => set("prjcs", v)} />
                    </Field>
                    <Field label="Registration Date">
                      <DateInput value={form.registrationDate} onChange={(v) => set("registrationDate", v)} />
                    </Field>
                    <Field label="Employees">
                      <NumInput value={form.numberOfEmployees} onChange={(v) => set("numberOfEmployees", v)} placeholder="e.g. 50" />
                    </Field>
                    <Field label="GEMI Code" full>
                      <TextInput value={form.gemiCode ?? ""} onChange={(v) => set("gemiCode", v)} placeholder="e.g. 123456789000" />
                    </Field>
                  </div>
                </Section>

                <Section title="Location" color="sky">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Latitude">
                      <div className="relative">
                        <NumInput value={form.latitude} onChange={(v) => set("latitude", v)} placeholder="e.g. 37.9838" />
                        {geocoding && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-sky-400" />}
                      </div>
                    </Field>
                    <Field label="Longitude">
                      <div className="relative">
                        <NumInput value={form.longitude} onChange={(v) => set("longitude", v)} placeholder="e.g. 23.7275" />
                        {geocoding && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-sky-400" />}
                      </div>
                    </Field>
                  </div>
                  <button
                    type="button"
                    disabled={geocoding || (!form.address && !form.city && !form.zip)}
                    onClick={() => handleGeocode({
                      street:     form.address?.split(" ").slice(0, -1).join(" ") || form.address || undefined,
                      postalCode: form.zip     || undefined,
                      city:       form.city    || undefined,
                    })}
                    className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {geocoding ? <Loader2 className="size-3 animate-spin" /> : <MapPin className="size-3" />}
                    {geocoding ? "Locating…" : "Get coordinates from address"}
                  </button>
                  {geocodeError && <p className="text-[10px] text-red-400">{geocodeError}</p>}
                </Section>

                <Section title="Other" color="emerald">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => set("consent", !form.consent)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium border transition-all w-full",
                        form.consent
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-emerald-500/30"
                      )}
                    >
                      <div className={cn("size-4 rounded flex items-center justify-center border-2 transition-all flex-shrink-0",
                        form.consent ? "bg-emerald-500 border-emerald-500" : "border-[var(--muted-foreground)]/40"
                      )}>
                        {form.consent && <Check className="size-2.5 text-white" strokeWidth={3} />}
                      </div>
                      Consent given
                    </button>
                    <Field label="Remark">
                      <textarea
                        value={form.remark ?? ""}
                        onChange={(e) => set("remark", e.target.value)}
                        rows={4}
                        className={cn(inputBase, "resize-none")}
                      />
                    </Field>
                  </div>
                </Section>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3">
                <AlertTriangle className="size-4 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--destructive)]">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-6 py-4 border-t border-[var(--border)] flex-shrink-0">
            {pushResult && (
              <div className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium",
                pushResult.ok
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              )}>
                {pushResult.ok
                  ? <CheckCircle2 className="size-3.5 flex-shrink-0" />
                  : <AlertTriangle className="size-3.5 flex-shrink-0" />}
                {pushResult.msg}
                <button onClick={() => setPushResult(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              {isEdit && customer?.trdr && (
                <button
                  type="button"
                  onClick={handlePushS1}
                  disabled={pushing}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pushing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                  {pushing ? "Pushing…" : "Push to S1"}
                </button>
              )}
              <div className="flex items-center gap-2.5 ml-auto">
                <Btn variant="ghost" size="md" onClick={onClose}>Cancel</Btn>
                <Btn variant="primary" size="md" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  {saving ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
                </Btn>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
