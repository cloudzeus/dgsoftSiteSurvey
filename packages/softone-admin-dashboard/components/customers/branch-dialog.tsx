"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Loader2, Check, Search } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import type { Country, JobType } from "./customer-dialog"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TrdBranchRow = {
  id: number
  customerId: number
  trdbranch: number | null
  code: string | null
  name: string | null
  country: number | null
  irsdata: string | null
  address: string | null
  areas: string | null
  district: string | null
  zip: string | null
  latitude: number | null
  longitude: number | null
  phone1: string | null
  phone2: string | null
  email: string | null
  emailacc: string | null
  jobtype: number | null
  jobtypetrd: string | null
  remarks: string | null
}

type FormState = Omit<TrdBranchRow, "id" | "customerId">

const EMPTY: FormState = {
  trdbranch: null, code: "", name: "", country: null,
  irsdata: "", address: "", areas: "", district: "", zip: "",
  latitude: null, longitude: null,
  phone1: "", phone2: "", email: "", emailacc: "",
  jobtype: null, jobtypetrd: "", remarks: "",
}

function rowToForm(b: TrdBranchRow): FormState {
  return {
    trdbranch: b.trdbranch,
    code: b.code ?? "", name: b.name ?? "", country: b.country,
    irsdata: b.irsdata ?? "", address: b.address ?? "", areas: b.areas ?? "",
    district: b.district ?? "", zip: b.zip ?? "",
    latitude: b.latitude, longitude: b.longitude,
    phone1: b.phone1 ?? "", phone2: b.phone2 ?? "",
    email: b.email ?? "", emailacc: b.emailacc ?? "",
    jobtype: b.jobtype, jobtypetrd: b.jobtypetrd ?? "", remarks: b.remarks ?? "",
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

function SectionBox({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 p-4 space-y-3">
      <p className={cn("text-[10px] font-bold uppercase tracking-widest border-l-2 pl-2", accent)}>{title}</p>
      {children}
    </div>
  )
}

// ─── Combobox ──────────────────────────────────────────────────────────────────

type ComboItem = { id: number; name: string }

function Combobox({ value, onChange, items, loading, placeholder }: {
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
        <div className="absolute z-[70] top-full mt-1 left-0 right-0 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
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

export function BranchDialog({
  open, onClose, customerId, branch, countries, jobtypes,
}: {
  open: boolean
  onClose: () => void
  customerId: number
  branch?: TrdBranchRow | null
  countries: Country[]
  jobtypes: JobType[]
}) {
  const isEdit = !!branch
  const [form,  setForm]  = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    setForm(branch ? rowToForm(branch) : EMPTY)
    setError(null)
  }, [branch, open])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim()) { setError("Name is required."); return }
    setSaving(true)
    setError(null)
    try {
      const url = isEdit
        ? `/api/customers/${customerId}/branches/${branch!.id}`
        : `/api/customers/${customerId}/branches`
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trdbranch:  form.trdbranch,
          code:       form.code       || null,
          name:       form.name,
          country:    form.country,
          irsdata:    form.irsdata    || null,
          address:    form.address    || null,
          areas:      form.areas      || null,
          district:   form.district   || null,
          zip:        form.zip        || null,
          latitude:   form.latitude,
          longitude:  form.longitude,
          phone1:     form.phone1     || null,
          phone2:     form.phone2     || null,
          email:      form.email      || null,
          emailacc:   form.emailacc   || null,
          jobtype:    form.jobtype,
          jobtypetrd: form.jobtypetrd || null,
          remarks:    form.remarks    || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? "Save failed")
        return
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <Dialog.Title className="text-[14px] font-bold text-[var(--foreground)]">
              {isEdit ? "Edit Branch" : "Add Branch"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="size-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">

            {/* Identity */}
            <SectionBox accent="border-indigo-500/50 text-indigo-400" title="Identity">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Code">
                  <input type="text" value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder="Branch code" className={inputBase} />
                </Field>
                <Field label="Name" full>
                  <input type="text" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Branch name" className={inputBase} />
                </Field>
                <Field label="IRS Data">
                  <input type="text" value={form.irsdata ?? ""} onChange={(e) => set("irsdata", e.target.value)} placeholder="ΔΟΥ" className={inputBase} />
                </Field>
              </div>
            </SectionBox>

            {/* Location */}
            <SectionBox accent="border-emerald-500/50 text-emerald-400" title="Location">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Country">
                  <Combobox value={form.country} onChange={(v) => set("country", v)} items={countries} loading={false} placeholder="Select country…" />
                </Field>
                <Field label="Address" full>
                  <input type="text" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Street address" className={inputBase} />
                </Field>
                <Field label="Areas">
                  <input type="text" value={form.areas ?? ""} onChange={(e) => set("areas", e.target.value)} placeholder="Area" className={inputBase} />
                </Field>
                <Field label="District">
                  <input type="text" value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} placeholder="District" className={inputBase} />
                </Field>
                <Field label="ZIP">
                  <input type="text" value={form.zip ?? ""} onChange={(e) => set("zip", e.target.value)} placeholder="ZIP" className={inputBase} />
                </Field>
                <Field label="Latitude">
                  <input type="number" value={form.latitude ?? ""} onChange={(e) => set("latitude", e.target.value === "" ? null : Number(e.target.value))} placeholder="37.97…" className={inputBase} />
                </Field>
                <Field label="Longitude">
                  <input type="number" value={form.longitude ?? ""} onChange={(e) => set("longitude", e.target.value === "" ? null : Number(e.target.value))} placeholder="23.72…" className={inputBase} />
                </Field>
              </div>
            </SectionBox>

            {/* Contact */}
            <SectionBox accent="border-sky-500/50 text-sky-400" title="Contact">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Phone 1">
                  <input type="text" value={form.phone1 ?? ""} onChange={(e) => set("phone1", e.target.value)} placeholder="+30 210…" className={inputBase} />
                </Field>
                <Field label="Phone 2">
                  <input type="text" value={form.phone2 ?? ""} onChange={(e) => set("phone2", e.target.value)} placeholder="+30 210…" className={inputBase} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="branch@example.com" className={inputBase} />
                </Field>
                <Field label="Email Acc">
                  <input type="email" value={form.emailacc ?? ""} onChange={(e) => set("emailacc", e.target.value)} placeholder="acc@example.com" className={inputBase} />
                </Field>
              </div>
            </SectionBox>

            {/* Classification */}
            <SectionBox accent="border-violet-500/50 text-violet-400" title="Classification">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Job Type">
                  <Combobox value={form.jobtype} onChange={(v) => set("jobtype", v)} items={jobtypes} loading={false} placeholder="Select job type…" />
                </Field>
                <Field label="Job Type TRD">
                  <input type="text" value={form.jobtypetrd ?? ""} onChange={(e) => set("jobtypetrd", e.target.value)} placeholder="TRD type" className={inputBase} />
                </Field>
              </div>
            </SectionBox>

            {/* Remarks */}
            <SectionBox accent="border-rose-500/50 text-rose-400" title="Remarks">
              <textarea
                value={form.remarks ?? ""}
                onChange={(e) => set("remarks", e.target.value)}
                rows={3}
                placeholder="Notes…"
                className={cn(inputBase, "resize-none")}
              />
            </SectionBox>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
            <Btn variant="secondary" size="md" onClick={onClose} disabled={saving}>Cancel</Btn>
            <Btn variant="primary" size="md" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Add branch"}
            </Btn>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
