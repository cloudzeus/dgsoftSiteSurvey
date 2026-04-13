"use client"

import { useState, useTransition, useMemo } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as Checkbox from "@radix-ui/react-checkbox"
import {
  Plus, X, Search, MoreHorizontal, Check,
  ChevronUp, ChevronDown, ChevronsUpDown, Columns3,
  Trash2, ChevronLeft, ChevronRight, GripVertical,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { useTablePrefs, PAGE_SIZES, type ColDef, type PageSize } from "@/hooks/use-table-prefs"
import {
  createSurveyQuestion, updateSurveyQuestion, deleteSurveyQuestion, deleteSurveyQuestions,
  type SurveyQuestionRow,
} from "@/app/(dashboard)/master-options/survey-questions/actions"
import type { SurveySection, QuestionType } from "@prisma/client"

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS: SurveySection[] = ["HARDWARE_NETWORK", "SOFTWARE", "WEB_ECOMMERCE", "IOT_AI", "COMPLIANCE"]

const SECTION_LABELS: Record<SurveySection, string> = {
  HARDWARE_NETWORK: "Hardware & Network",
  SOFTWARE:         "Software",
  WEB_ECOMMERCE:    "Web & E-commerce",
  IOT_AI:           "IoT & AI",
  COMPLIANCE:       "Compliance",
}

const SECTION_COLORS: Record<SurveySection, { bg: string; fg: string }> = {
  HARDWARE_NETWORK: { bg: "#dbeafe", fg: "#1d4ed8" },
  SOFTWARE:         { bg: "#ede9fe", fg: "#6d28d9" },
  WEB_ECOMMERCE:    { bg: "#d1fae5", fg: "#065f46" },
  IOT_AI:           { bg: "#fef3c7", fg: "#92400e" },
  COMPLIANCE:       { bg: "#ffe4e6", fg: "#9f1239" },
}

const TYPES: QuestionType[] = ["TEXT", "BOOLEAN", "NUMBER", "DROPDOWN", "MULTI_SELECT", "DEVICE_LIST"]

const TYPE_LABELS: Record<QuestionType, string> = {
  TEXT:         "Text",
  BOOLEAN:      "Yes / No",
  NUMBER:       "Number",
  DROPDOWN:     "Dropdown",
  MULTI_SELECT: "Multi-select",
  DEVICE_LIST:  "Device List",
}

const TYPE_COLORS: Record<QuestionType, { bg: string; fg: string }> = {
  TEXT:         { bg: "#f1f5f9", fg: "#475569" },
  BOOLEAN:      { bg: "#fce7f3", fg: "#9d174d" },
  NUMBER:       { bg: "#d1fae5", fg: "#065f46" },
  DROPDOWN:     { bg: "#dbeafe", fg: "#1d4ed8" },
  MULTI_SELECT: { bg: "#ede9fe", fg: "#6d28d9" },
  DEVICE_LIST:  { bg: "#ecfdf5", fg: "#065f46" },
}

const OPTIONS_SOURCE_HINTS = [
  "software_vendor", "software_product:ERP", "software_product:CRM",
  "software_product:PRODUCTIVITY", "software_product:BACKUP",
  "software_product:CYBERSECURITY", "software_product:AI_TOOL",
  "web_platform:CMS", "web_platform:ECOMMERCE",
  "digital_tool:ANALYTICS", "digital_tool:ADS_PLATFORM",
  "digital_tool:SEO_SUITE", "digital_tool:MARKETING_AUTOMATION",
  "brand:SECURITY", "brand:NETWORKING", "brand:COMPUTING",
  "brand:STORAGE", "brand:POWER", "brand:IOT",
  "iot_category", "iot_product:LORAWAN", "iot_product:AI_VISION",
]

const COLUMNS: ColDef[] = [
  { key: "label",    label: "Question",      sortable: true,  defaultVisible: true, alwaysVisible: true },
  { key: "section",  label: "Section",       sortable: true,  defaultVisible: true },
  { key: "type",     label: "Type",          sortable: true,  defaultVisible: true },
  { key: "key",      label: "Key",           sortable: true,  defaultVisible: true },
  { key: "order",    label: "Order",         sortable: true,  defaultVisible: true },
  { key: "options",  label: "Options",       sortable: false, defaultVisible: true },
  { key: "isActive", label: "Active",        sortable: false, defaultVisible: true },
]

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  label: 320, section: 160, type: 130, key: 220, order: 80, options: 200, isActive: 80,
}

type SortDir = "asc" | "desc"

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionBadge({ section }: { section: SurveySection }) {
  const c = SECTION_COLORS[section]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}>
      {SECTION_LABELS[section]}
    </span>
  )
}

function TypeBadge({ type }: { type: QuestionType }) {
  const c = TYPE_COLORS[type]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function RowCheckbox({ checked, onCheckedChange }: {
  checked: boolean | "indeterminate"; onCheckedChange: (v: boolean) => void
}) {
  return (
    <Checkbox.Root checked={checked} onCheckedChange={v => onCheckedChange(v === true)}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer",
        outline: "none", display: "flex", alignItems: "center", justifyContent: "center",
        border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
        background: checked ? "var(--primary)" : "transparent",
        transition: "background 120ms, border-color 120ms",
      }}>
      <Checkbox.Indicator>
        {checked === "indeterminate"
          ? <span style={{ width: 8, height: 2, background: "white", display: "block", borderRadius: 1 }} />
          : <Check className="size-2.5 text-white" strokeWidth={3} />}
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

// ─── Static options tag editor ────────────────────────────────────────────────

function OptionsEditor({ options, onChange }: {
  options: string[]
  onChange: (opts: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  function add() {
    const val = draft.trim()
    if (!val || options.includes(val)) return
    onChange([...options, val])
    setDraft("")
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-8">
        {options.map((opt, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium border"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            {opt}
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="ml-0.5 rounded-sm hover:text-red-500 transition-colors">
              <X className="size-3" />
            </button>
          </span>
        ))}
        {options.length === 0 && (
          <span className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>No options yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder="Type option and press Enter…"
          className="input-field flex-1 text-[12px]"
        />
        <Btn variant="secondary" size="sm" onClick={add} type="button">Add</Btn>
      </div>
    </div>
  )
}

// ─── Shared form fields ───────────────────────────────────────────────────────

type FormState = {
  section: SurveySection
  key: string
  label: string
  type: QuestionType
  order: number
  isActive: boolean
  optionsSource: string
  options: string[]
  optionsMode: "source" | "static" | "none"
}

function blankForm(): FormState {
  return {
    section: "HARDWARE_NETWORK",
    key: "", label: "", type: "TEXT",
    order: 99, isActive: true,
    optionsSource: "", options: [], optionsMode: "none",
  }
}

function fromRow(q: SurveyQuestionRow): FormState {
  const hasSource = !!q.optionsSource
  const hasStatic = !!(q.options?.length)
  return {
    section: q.section,
    key: q.key,
    label: q.label,
    type: q.type,
    order: q.order,
    isActive: q.isActive,
    optionsSource: q.optionsSource ?? "",
    options: q.options ?? [],
    optionsMode: hasSource ? "source" : hasStatic ? "static" : "none",
  }
}

function QuestionForm({
  form,
  error,
  onChange,
}: {
  form: FormState
  error: string
  onChange: (patch: Partial<FormState>) => void
}) {
  const needsOptions = form.type === "DROPDOWN" || form.type === "MULTI_SELECT"

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-[12px] px-3 py-2 rounded-lg"
          style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>{error}</p>
      )}

      {/* Section + Type row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--foreground-muted)" }}>Section *</label>
          <select value={form.section} onChange={e => onChange({ section: e.target.value as SurveySection })}
            className="input-field">
            {SECTIONS.map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--foreground-muted)" }}>Answer Type *</label>
          <select value={form.type} onChange={e => {
            const t = e.target.value as QuestionType
            onChange({ type: t, optionsMode: (t === "DROPDOWN" || t === "MULTI_SELECT") ? form.optionsMode === "none" ? "static" : form.optionsMode : "none" })
          }} className="input-field">
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--foreground-muted)" }}>Question Label *</label>
        <textarea
          value={form.label}
          onChange={e => onChange({ label: e.target.value })}
          rows={2}
          placeholder="e.g. Is there a secondary ISP (Failover) or 5G backup?"
          className="input-field resize-none"
        />
      </div>

      {/* Key + Order row */}
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--foreground-muted)" }}>Key * <span className="normal-case font-normal opacity-70">(unique, snake_case)</span></label>
          <input
            value={form.key}
            onChange={e => onChange({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
            placeholder="e.g. hw_internet_failover"
            className="input-field font-mono text-[12px]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--foreground-muted)" }}>Order</label>
          <input
            type="number"
            value={form.order}
            onChange={e => onChange({ order: Number(e.target.value) })}
            className="input-field"
            min={1}
          />
        </div>
      </div>

      {/* Options (only for DROPDOWN / MULTI_SELECT) */}
      {needsOptions && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-4"
          style={{ background: "var(--muted)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "var(--foreground-muted)" }}>Options source</p>
            <div className="flex gap-1 p-0.5 rounded-lg border border-[var(--border)]"
              style={{ background: "var(--surface)" }}>
              {(["source", "static"] as const).map(mode => (
                <button key={mode} type="button"
                  onClick={() => onChange({ optionsMode: mode })}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
                  style={{
                    background: form.optionsMode === mode ? "var(--primary)" : "transparent",
                    color: form.optionsMode === mode ? "white" : "var(--foreground-muted)",
                  }}>
                  {mode === "source" ? "Master table" : "Static list"}
                </button>
              ))}
            </div>
          </div>

          {form.optionsMode === "source" && (
            <div className="space-y-2">
              <input
                value={form.optionsSource}
                onChange={e => onChange({ optionsSource: e.target.value })}
                placeholder="e.g. brand:SECURITY or software_product:ERP"
                className="input-field font-mono text-[12px]"
              />
              <details className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                <summary className="cursor-pointer select-none">Available sources</summary>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {OPTIONS_SOURCE_HINTS.map(h => (
                    <button key={h} type="button"
                      onClick={() => onChange({ optionsSource: h })}
                      className="font-mono px-1.5 py-0.5 rounded text-[10px] border hover:border-indigo-400 transition-colors"
                      style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground-muted)" }}>
                      {h}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}

          {form.optionsMode === "static" && (
            <OptionsEditor
              options={form.options}
              onChange={opts => onChange({ options: opts })}
            />
          )}
        </div>
      )}

      {/* isActive */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={form.isActive} onChange={e => onChange({ isActive: e.target.checked })}
          className="rounded" />
        <span className="text-[13px]" style={{ color: "var(--foreground)" }}>Active (shown in wizard)</span>
      </label>
    </div>
  )
}

// ─── Add dialog ───────────────────────────────────────────────────────────────

function AddDialog({ onSuccess }: { onSuccess: (q: SurveyQuestionRow) => void }) {
  const [open, setOpen]   = useState(false)
  const [form, setForm]   = useState<FormState>(blankForm())
  const [error, setError] = useState("")
  const [pending, start]  = useTransition()

  function patch(p: Partial<FormState>) { setForm(prev => ({ ...prev, ...p })); setError("") }
  function close() { setOpen(false); setForm(blankForm()); setError("") }

  function submit() {
    start(async () => {
      const res = await createSurveyQuestion({
        section: form.section, key: form.key, label: form.label, type: form.type,
        order: form.order, isActive: form.isActive,
        optionsSource: form.optionsMode === "source" ? form.optionsSource : null,
        options: form.optionsMode === "static" ? form.options : null,
      })
      if (res.error) { setError(res.error); return }
      onSuccess(res.question!)
      close()
    })
  }

  return (
    <>
      <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5 mr-1" />Add question
      </Btn>

      {open && (
        <div className="fixed inset-0 flex items-start justify-center p-4 pt-16 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.45)", zIndex: 200 }}>
          <div className="modal-card w-full max-w-lg space-y-5 my-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Add question</h2>
              <button onClick={close} className="p-1 rounded-md"
                style={{ color: "var(--foreground-muted)" }}><X className="size-4" /></button>
            </div>

            <QuestionForm form={form} error={error} onChange={patch} />

            <div className="flex gap-2 justify-end pt-1">
              <Btn variant="secondary" size="sm" onClick={close}>Cancel</Btn>
              <Btn variant="primary" size="sm" loading={pending} onClick={submit}>Create</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({ question, onSuccess, onClose }: {
  question: SurveyQuestionRow
  onSuccess: (q: SurveyQuestionRow) => void
  onClose: () => void
}) {
  const [form, setForm]   = useState<FormState>(() => fromRow(question))
  const [error, setError] = useState("")
  const [pending, start]  = useTransition()

  function patch(p: Partial<FormState>) { setForm(prev => ({ ...prev, ...p })); setError("") }

  function submit() {
    start(async () => {
      const res = await updateSurveyQuestion(question.id, {
        section: form.section, key: form.key, label: form.label, type: form.type,
        order: form.order, isActive: form.isActive,
        optionsSource: form.optionsMode === "source" ? form.optionsSource : null,
        options: form.optionsMode === "static" ? form.options : null,
      })
      if (res.error) { setError(res.error); return }
      onSuccess(res.question!)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 flex items-start justify-center p-4 pt-16 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.45)", zIndex: 200 }}>
      <div className="modal-card w-full max-w-lg space-y-5 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Edit question</h2>
          <button onClick={onClose} className="p-1 rounded-md"
            style={{ color: "var(--foreground-muted)" }}><X className="size-4" /></button>
        </div>

        <QuestionForm form={form} error={error} onChange={patch} />

        <div className="flex gap-2 justify-end pt-1">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" size="sm" loading={pending} onClick={submit}>Save</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Column picker ────────────────────────────────────────────────────────────

function ColumnPicker({ visibleCols, onToggle }: {
  visibleCols: Set<string>; onToggle: (key: string) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-lg text-[12px] font-medium"
          style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--foreground-muted)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <Columns3 className="size-3.5" />Columns
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4}
          style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: 6, minWidth: 160, zIndex: 100 }}>
          {COLUMNS.filter(c => !c.alwaysVisible).map(col => (
            <DropdownMenu.Item key={col.key}
              onSelect={e => { e.preventDefault(); onToggle(col.key) }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer select-none outline-none"
              style={{ color: "var(--foreground)" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
              <Check className="size-3.5" style={{ opacity: visibleCols.has(col.key) ? 1 : 0, color: "var(--primary)" }} />
              {col.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ─── Section filter ───────────────────────────────────────────────────────────

function SectionFilter({ value, onChange }: {
  value: SurveySection | "ALL"
  onChange: (v: SurveySection | "ALL") => void
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {(["ALL", ...SECTIONS] as const).map(s => (
        <button key={s} type="button"
          onClick={() => onChange(s)}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
          style={{
            background: value === s ? "var(--primary)" : "var(--muted)",
            color: value === s ? "white" : "var(--foreground-muted)",
            border: "1px solid " + (value === s ? "var(--primary)" : "var(--border)"),
          }}>
          {s === "ALL" ? "All sections" : SECTION_LABELS[s]}
        </button>
      ))}
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function SurveyQuestionsTable({ initialQuestions }: { initialQuestions: SurveyQuestionRow[] }) {
  const [questions, setQuestions] = useState<SurveyQuestionRow[]>(initialQuestions)
  const [search, setSearch]       = useState("")
  const [sectionFilter, setSectionFilter] = useState<SurveySection | "ALL">("ALL")
  const [sortKey, setSortKey]     = useState<string>("order")
  const [sortDir, setSortDir]     = useState<SortDir>("asc")
  const [page, setPage]           = useState(1)
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [editing, setEditing]     = useState<SurveyQuestionRow | null>(null)
  const [, start]                 = useTransition()

  const { visibleCols, toggleCol, pageSize, setPageSize, hydrated } =
    useTablePrefs("survey-questions", COLUMNS, 25, DEFAULT_COL_WIDTHS)

  const filtered = useMemo(() => {
    let rows = questions
    if (sectionFilter !== "ALL") rows = rows.filter(r => r.section === sectionFilter)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.label.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q) ||
        SECTION_LABELS[r.section].toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortKey) {
        case "section": av = SECTION_LABELS[a.section]; bv = SECTION_LABELS[b.section]; break
        case "type":    av = TYPE_LABELS[a.type];       bv = TYPE_LABELS[b.type];       break
        case "order":   av = a.order;                   bv = b.order;                   break
        case "key":     av = a.key;                     bv = b.key;                     break
        default:        av = a.label;                   bv = b.label;
      }
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [questions, search, sectionFilter, sortKey, sortDir])

  const totalPages      = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage        = Math.min(page, totalPages)
  const pageRows        = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
  const someSelected    = pageRows.some(r => selected.has(r.id))

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
    setPage(1)
  }

  function handleDelete(id: number) {
    start(async () => {
      const res = await deleteSurveyQuestion(id)
      if (!res.error) setQuestions(prev => prev.filter(q => q.id !== id))
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selected)
    start(async () => {
      const res = await deleteSurveyQuestions(ids)
      if (!res.error) { setQuestions(prev => prev.filter(q => !ids.includes(q.id))); setSelected(new Set()) }
    })
  }

  const visibleColDefs = COLUMNS.filter(c => visibleCols.has(c.key))

  return (
    <>
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>

        {/* Section filter */}
        <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
          <SectionFilter value={sectionFilter} onChange={v => { setSectionFilter(v); setPage(1) }} />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 flex-1">
            {selected.size > 0 ? (
              <>
                <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                  {selected.size} selected
                </span>
                <button onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
                  style={{ background: "var(--danger-light)", color: "var(--danger-fg)", border: "1px solid #fca5a5" }}>
                  <Trash2 className="size-3.5" />Delete selected
                </button>
                <button onClick={() => setSelected(new Set())} className="text-[12px]"
                  style={{ color: "var(--foreground-muted)" }}>Clear</button>
              </>
            ) : (
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
                  style={{ color: "var(--foreground-subtle)" }} />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search questions, keys…"
                  style={{ paddingLeft: 32 }} className="input-field" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hydrated && <ColumnPicker visibleCols={visibleCols} onToggle={toggleCol} />}
            <AddDialog onSuccess={q => { setQuestions(prev => [q, ...prev]); setPage(1) }} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="text-[13px]"
            style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: 44 }} />
              {visibleColDefs.map(col => (
                <col key={col.key} style={{ width: DEFAULT_COL_WIDTHS[col.key] ?? 160 }} />
              ))}
              <col style={{ width: 44 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
                <th className="pl-4 pr-2 py-3">
                  <RowCheckbox
                    checked={allPageSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={v => {
                      if (v) setSelected(prev => new Set([...prev, ...pageRows.map(r => r.id)]))
                      else setSelected(prev => { const n = new Set(prev); pageRows.forEach(r => n.delete(r.id)); return n })
                    }} />
                </th>
                {visibleColDefs.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left">
                    {col.sortable ? (
                      <button onClick={() => toggleSort(col.key)}
                        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider select-none"
                        style={{ color: sortKey === col.key ? "var(--foreground)" : "var(--foreground-muted)" }}>
                        {col.label}
                        {sortKey === col.key
                          ? sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                          : <ChevronsUpDown className="size-3 opacity-30" />}
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--foreground-muted)" }}>{col.label}</span>
                    )}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColDefs.length + 2}
                    className="px-4 py-14 text-center text-[13px]"
                    style={{ color: "var(--foreground-muted)" }}>
                    {search ? "No questions match your search" : "No questions yet — add one above"}
                  </td>
                </tr>
              ) : pageRows.map((q, i) => {
                const isSel = selected.has(q.id)
                const optionsLabel = q.optionsSource
                  ? q.optionsSource
                  : q.options?.length
                    ? `${q.options.length} option${q.options.length !== 1 ? "s" : ""}`
                    : "—"

                return (
                  <tr key={q.id}
                    style={{
                      borderBottom: i < pageRows.length - 1 ? "1px solid var(--border)" : "none",
                      background: isSel ? "var(--primary-light)" : "transparent",
                      cursor: "default",
                    }}
                    onDoubleClick={() => setEditing(q)}>
                    <td className="pl-4 pr-2 py-3.5">
                      <RowCheckbox checked={isSel}
                        onCheckedChange={v => setSelected(prev => {
                          const n = new Set(prev); v ? n.add(q.id) : n.delete(q.id); return n
                        })} />
                    </td>

                    {visibleCols.has("label") && (
                      <td className="px-4 py-3.5 font-medium truncate"
                        style={{ color: "var(--foreground)" }}
                        title={q.label}>{q.label}</td>
                    )}
                    {visibleCols.has("section") && (
                      <td className="px-4 py-3.5"><SectionBadge section={q.section} /></td>
                    )}
                    {visibleCols.has("type") && (
                      <td className="px-4 py-3.5"><TypeBadge type={q.type} /></td>
                    )}
                    {visibleCols.has("key") && (
                      <td className="px-4 py-3.5 font-mono text-[11px] truncate"
                        style={{ color: "var(--foreground-muted)" }}>{q.key}</td>
                    )}
                    {visibleCols.has("order") && (
                      <td className="px-4 py-3.5 tabular-nums text-center"
                        style={{ color: "var(--foreground-muted)" }}>{q.order}</td>
                    )}
                    {visibleCols.has("options") && (
                      <td className="px-4 py-3.5 truncate font-mono text-[11px]"
                        style={{ color: "var(--foreground-muted)" }}
                        title={q.optionsSource ?? q.options?.join(", ")}>
                        {q.optionsSource
                          ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                              style={{ background: "#dbeafe", color: "#1d4ed8" }}>{q.optionsSource}</span>
                          : q.options?.length
                            ? optionsLabel
                            : <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                    )}
                    {visibleCols.has("isActive") && (
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={q.isActive
                            ? { background: "#d1fae5", color: "#065f46" }
                            : { background: "var(--muted)", color: "var(--foreground-subtle)" }}>
                          {q.isActive ? "Active" : "Hidden"}
                        </span>
                      </td>
                    )}

                    <td className="px-3 py-3.5">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="p-1.5 rounded-md"
                            style={{ color: "var(--foreground-muted)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content align="end" sideOffset={4}
                            style={{ background: "var(--surface)", border: "1px solid var(--border)",
                              borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
                              padding: 6, minWidth: 140, zIndex: 100 }}>
                            <DropdownMenu.Item
                              onSelect={() => setEditing(q)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer select-none outline-none"
                              style={{ color: "var(--foreground)" }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                              Edit
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                            <DropdownMenu.Item
                              onSelect={() => handleDelete(q.id)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer select-none outline-none"
                              style={{ color: "var(--danger)" }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--danger-light)")}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            Rows:
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value) as PageSize); setPage(1) }}
              className="input-field py-0.5 px-1.5 text-[12px] w-auto">
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{filtered.length} total</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
              className="size-7 rounded-lg border flex items-center justify-center disabled:opacity-40"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <ChevronLeft className="size-3.5" style={{ color: "var(--foreground-muted)" }} />
            </button>
            <span className="px-2 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              {safePage} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
              className="size-7 rounded-lg border flex items-center justify-center disabled:opacity-40"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <ChevronRight className="size-3.5" style={{ color: "var(--foreground-muted)" }} />
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <EditDialog
          question={editing}
          onSuccess={updated => setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
