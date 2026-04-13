"use client"

import React, { useState, useTransition } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import * as Checkbox from "@radix-ui/react-checkbox"
import { X, Loader2, Check, CalendarDays, ClipboardList } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import {
  createSiteSurvey, updateSiteSurvey, getCustomerBranches,
  type SurveySection, type SurveyStatus, type SiteSurveyInput,
} from "@/app/actions/site-survey"

export type SurveyBranch = { id: number; name: string | null; code: string | null }

export interface SurveyCustomer {
  id: number
  name: string | null
  branches: SurveyBranch[] // pre-loaded server-side (from customer row action)
  mainAddress?: string | null
}

export interface SurveyUser {
  id: string
  name: string | null
  email: string
}

export interface SurveyCustomerOption {
  id: number
  name: string | null
}

export interface SiteSurveyRow {
  id: number
  name: string
  description: string | null
  date: Date
  customerId: number
  surveyorId: string
  branchIds: number[]
  sections: SurveySection[]
  status: SurveyStatus
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Pre-set customer with branches already loaded (from customer row action or edit). */
  customer?: SurveyCustomer | undefined
  /** Customer list for the picker (site-survey page "New" flow). */
  customerOptions?: SurveyCustomerOption[] | undefined
  users: SurveyUser[]
  survey?: SiteSurveyRow | undefined
}

const SECTIONS: { key: SurveySection; label: string }[] = [
  { key: "hardware_network", label: "Hardware & Network" },
  { key: "software",         label: "Software" },
  { key: "web_ecommerce",    label: "Web & E-commerce" },
  { key: "compliance",       label: "Compliance" },
  { key: "iot_ai",           label: "IoT & AI" },
]

const STATUS_OPTIONS: { value: SurveyStatus; label: string }[] = [
  { value: "DRAFT",       label: "Draft" },
  { value: "SCHEDULED",   label: "Scheduled" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED",   label: "Completed" },
  { value: "CANCELLED",   label: "Cancelled" },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Mounted fresh each time the parent changes its key — no useEffect needed to reset state.
function SiteSurveyForm({ onClose, onSaved, customer, customerOptions, users, survey }: Props) {
  const isEdit = !!survey

  const [name,        setName]     = useState(survey?.name ?? "")
  const [description, setDesc]     = useState(survey?.description ?? "")
  const [date,        setDate]     = useState(survey ? new Date(survey.date).toISOString().slice(0, 10) : today())
  const [surveyorId,  setSurveyor] = useState(survey?.surveyorId ?? users[0]?.id ?? "")
  const [branchIds,   setBranches] = useState<number[]>(survey?.branchIds ?? [])
  const [sections,    setSections] = useState<SurveySection[]>(survey?.sections ?? [])
  const [status,      setStatus]   = useState<SurveyStatus>(survey?.status ?? "DRAFT")
  const [error,       setError]    = useState("")

  // Picker state (only when no customer is pre-set)
  const [selectedId,      setSelectedId]     = useState<number | "">(!customer && survey ? survey.customerId : "")
  const [pickedBranches,  setPickedBranches]  = useState<SurveyBranch[]>([])
  const [pickedAddress,   setPickedAddress]   = useState<string | null>(null)

  const [isSaving,   startSave]       = useTransition()
  const [loadingBranches, startLoad]  = useTransition()

  // Branches + main address: from prop if customer is pre-set, otherwise from picker server action result
  const branches: SurveyBranch[] = customer?.branches ?? pickedBranches
  const mainAddress: string | null | undefined = customer?.mainAddress ?? pickedAddress

  const resolvedCustomerId: number | null = customer?.id ?? (selectedId !== "" ? selectedId : null)

  // Called when user picks a customer from the dropdown — invokes server action directly
  function handleCustomerChange(id: number | "") {
    setSelectedId(id)
    setBranches([])
    setPickedBranches([])
    setPickedAddress(null)
    if (id !== "") {
      startLoad(async () => {
        const { branches: data, mainAddress: addr } = await getCustomerBranches(id as number)
        setPickedBranches(data)
        setPickedAddress(addr)
      })
    }
  }

  function toggleBranch(id: number) {
    setBranches(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }

  function toggleSection(key: SurveySection) {
    setSections(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])
  }

  function handleSave() {
    if (!name.trim())          { setError("Name is required."); return }
    if (!date)                 { setError("Date is required."); return }
    if (!surveyorId)           { setError("Surveyor is required."); return }
    if (sections.length === 0) { setError("Select at least one section."); return }
    if (!resolvedCustomerId)   { setError("Select a customer."); return }

    setError("")
    const trimmedDesc = description.trim()
    const payload: SiteSurveyInput = {
      name: name.trim(),
      description: trimmedDesc !== "" ? trimmedDesc : undefined,
      date,
      customerId: resolvedCustomerId,
      surveyorId,
      branchIds,
      sections,
      status,
    }

    startSave(async () => {
      try {
        if (isEdit && survey) {
          await updateSiteSurvey(survey.id, payload)
        } else {
          await createSiteSurvey(payload)
        }
        onSaved()
        onClose()
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.")
      }
    })
  }

  return (
    <Dialog.Content className="fixed left-1/2 top-1/2 z-[51] -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl animate-in fade-in zoom-in-95 duration-150 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: "var(--muted)" }}>
          <ClipboardList className="size-4" style={{ color: "var(--muted-foreground)" }} />
        </div>
        <Dialog.Title className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
          {isEdit ? "Edit Site Survey" : "New Site Survey"}
        </Dialog.Title>
        <button onClick={onClose} className="ml-auto size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--muted)]" style={{ color: "var(--muted-foreground)" }}>
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Customer */}
        {customer ? (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
            Customer: <span className="font-medium" style={{ color: "var(--foreground)" }}>{customer.name}</span>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Customer *</label>
            <select
              value={selectedId}
              onChange={e => handleCustomerChange(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
              style={{ color: "var(--foreground)" }}
            >
              <option value="">— select customer —</option>
              {(customerOptions ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.name ?? `#${c.id}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Survey Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Annual IT Assessment 2026"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
            style={{ color: "var(--foreground)" }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDesc(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow resize-none"
            style={{ color: "var(--foreground)" }}
          />
        </div>

        {/* Date + Status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Date *</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-8 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
                style={{ color: "var(--foreground)" }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as SurveyStatus)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
              style={{ color: "var(--foreground)" }}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Surveyor */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Surveyor *</label>
          <select
            value={surveyorId}
            onChange={e => setSurveyor(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
            style={{ color: "var(--foreground)" }}
          >
            <option value="">— select surveyor —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
            ))}
          </select>
        </div>

        {/* Branches */}
        {loadingBranches ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 className="size-3.5 animate-spin" /> Loading branches…
          </div>
        ) : resolvedCustomerId !== null ? (
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
              {branches.length > 0 ? "Branches" : "Survey Location"}
            </label>
            {branches.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {branches.map(b => (
                  <label key={b.id} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Checkbox.Root
                      checked={branchIds.includes(b.id)}
                      onCheckedChange={() => toggleBranch(b.id)}
                      className="shrink-0 size-4 rounded border border-[var(--border)] bg-[var(--input)] flex items-center justify-center data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] transition-colors"
                    >
                      <Checkbox.Indicator>
                        <Check className="size-2.5 text-white" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <span className="text-sm" style={{ color: "var(--foreground)" }}>
                      {b.name ?? b.code ?? `Branch #${b.id}`}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                {mainAddress ?? "Main customer address"}
              </div>
            )}
          </div>
        ) : null}

        {/* Sections */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Sections to Cover *</label>
          <div className="space-y-1.5">
            {SECTIONS.map(s => (
              <label key={s.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <Checkbox.Root
                  checked={sections.includes(s.key)}
                  onCheckedChange={() => toggleSection(s.key)}
                  className="shrink-0 size-4 rounded border border-[var(--border)] bg-[var(--input)] flex items-center justify-center data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] transition-colors"
                >
                  <Checkbox.Indicator>
                    <Check className="size-2.5 text-white" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-sm" style={{ color: "var(--foreground)" }}>{s.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-xs rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--destructive) 8%, transparent)", color: "var(--destructive)" }}>
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2 justify-end">
        <Btn variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>Cancel</Btn>
        <Btn size="sm" onClick={handleSave} disabled={isSaving || loadingBranches}>
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          {isEdit ? "Save Changes" : "Create Survey"}
        </Btn>
      </div>
    </Dialog.Content>
  )
}

export function SiteSurveyDialog(props: Props) {
  return (
    <Dialog.Root open={props.open} onOpenChange={v => { if (!v) props.onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />
        <SiteSurveyForm key={props.open ? (props.survey?.id ?? "new") : "closed"} {...props} />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
