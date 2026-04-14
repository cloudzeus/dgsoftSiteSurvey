"use client"

import { useEffect, useMemo, useState } from "react"
import { Wand2, ArrowRight, Check, AlertCircle, Pin } from "lucide-react"
import { autoMatchField } from "@/lib/import-targets"
import { Btn } from "@/components/ui/btn"
import type { ImportConfig, ColumnMapping } from "./types"

// Fields that become fixed-value selectors for BRAND_PRODUCTS
const BRAND_PRODUCTS_STATIC_FIELDS = ["brand_name", "category"]

type Props = {
  config: ImportConfig
  onChange: (patch: Partial<ImportConfig>) => void
}

// ─── Fixed Values panel for BRAND_PRODUCTS ────────────────────────────────────

function BrandProductsFixedPanel({
  staticValues,
  onChange,
}: {
  staticValues: Record<string, string>
  onChange: (vals: Record<string, string>) => void
}) {
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [catInput, setCatInput] = useState(staticValues.category ?? "")
  const [showCatSuggestions, setShowCatSuggestions] = useState(false)

  useEffect(() => {
    fetch("/api/import/brands")
      .then(r => r.json())
      .then(setBrands)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const brand = staticValues.brand_name
    if (!brand) { setCategories([]); return }
    fetch(`/api/import/brand-categories?brand=${encodeURIComponent(brand)}`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {})
  }, [staticValues.brand_name])

  // Keep catInput in sync when brand changes (reset)
  const prevBrand = useMemo(() => staticValues.brand_name, [staticValues.brand_name])
  useEffect(() => {
    setCatInput(staticValues.category ?? "")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevBrand])

  const filteredCats = catInput
    ? categories.filter(c => c.toLowerCase().includes(catInput.toLowerCase()))
    : categories

  function setStatic(key: string, value: string) {
    onChange({ ...staticValues, [key]: value })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--primary)", background: "var(--primary-light)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--primary)", background: "var(--primary-light)" }}>
        <Pin className="size-3.5" style={{ color: "var(--primary)" }} />
        <p className="text-[12px] font-semibold" style={{ color: "var(--primary)" }}>
          Fixed Values — applied to every row
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4">
        {/* Brand selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1"
            style={{ color: "var(--foreground-muted)" }}>
            Brand
            <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <div className="relative">
            <select
              value={staticValues.brand_name ?? ""}
              onChange={e => {
                setStatic("brand_name", e.target.value)
                // reset category when brand changes
                onChange({ ...staticValues, brand_name: e.target.value, category: "" })
                setCatInput("")
              }}
              className="w-full appearance-none rounded-lg pl-3 pr-7 py-2 text-[13px] font-medium outline-none"
              style={{
                background: "var(--surface)",
                border: `1.5px solid ${staticValues.brand_name ? "var(--primary)" : "var(--border-strong)"}`,
                color: staticValues.brand_name ? "var(--foreground)" : "var(--foreground-muted)",
              }}
            >
              <option value="">Select brand…</option>
              {brands.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]"
              style={{ color: "var(--foreground-muted)" }}>▾</span>
          </div>
        </div>

        {/* Category selector with autocomplete */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--foreground-muted)" }}>
            Type / Category
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder={staticValues.brand_name ? "e.g. IP Phones, Routers…" : "Select a brand first"}
              disabled={!staticValues.brand_name}
              value={catInput}
              onChange={e => {
                setCatInput(e.target.value)
                setStatic("category", e.target.value)
                setShowCatSuggestions(true)
              }}
              onFocus={() => setShowCatSuggestions(true)}
              onBlur={() => setTimeout(() => setShowCatSuggestions(false), 150)}
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{
                background: staticValues.brand_name ? "var(--surface)" : "var(--muted)",
                border: `1.5px solid ${catInput ? "var(--primary)" : "var(--border)"}`,
                color: "var(--foreground)",
              }}
            />
            {showCatSuggestions && filteredCats.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {filteredCats.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--muted)]"
                    style={{ color: "var(--foreground)" }}
                    onMouseDown={() => {
                      setCatInput(c)
                      setStatic("category", c)
                      setShowCatSuggestions(false)
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main mapping step ────────────────────────────────────────────────────────

export function StepMapping({ config, onChange }: Props) {
  const isBrandProducts = config.targetObjectKey === "BRAND_PRODUCTS"

  // Fields that are handled as static values — exclude from column mapping
  const staticFieldKeys = isBrandProducts ? BRAND_PRODUCTS_STATIC_FIELDS : []

  // Target fields available for column mapping (exclude static ones)
  const mappableTargetFields = config.targetFields.filter(
    f => !staticFieldKeys.includes(f.key),
  )

  // Only map the columns the user kept in step 2
  const activeCols = config.columns.filter(c => config.selectedColumns.includes(c.key))

  // Init mappings when entering step (only for non-static fields)
  useEffect(() => {
    if (config.mappings.length === 0 && activeCols.length > 0) {
      const initial: ColumnMapping[] = activeCols.map(col => ({
        excelColumn: col.key,
        targetField: autoMatchField(col.key, mappableTargetFields),
      }))
      onChange({ mappings: initial })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function autoMap() {
    const mapped: ColumnMapping[] = activeCols.map(col => ({
      excelColumn: col.key,
      targetField: autoMatchField(col.key, mappableTargetFields),
    }))
    onChange({ mappings: mapped })
  }

  function setMapping(excelColumn: string, targetField: string) {
    onChange({
      mappings: config.mappings.map(m =>
        m.excelColumn === excelColumn ? { ...m, targetField } : m,
      ),
    })
  }

  const stats = useMemo(() => {
    const mapped = config.mappings.filter(m => m.targetField).length
    const required = mappableTargetFields.filter(f => f.required)
    const missingRequired = required.filter(
      f => !config.mappings.some(m => m.targetField === f.key),
    )
    // For BRAND_PRODUCTS brand_name is required but comes from staticValues
    const missingStaticBrand = isBrandProducts && !config.staticValues?.brand_name
    return { mapped, total: config.mappings.length, missingRequired, missingStaticBrand }
  }, [config.mappings, config.staticValues, mappableTargetFields, isBrandProducts])

  const colInfoMap = useMemo(
    () => Object.fromEntries(activeCols.map(c => [c.key, c])),
    [activeCols],
  )

  const pct = stats.total > 0 ? Math.round((stats.mapped / stats.total) * 100) : 0

  const usedFields = new Map<string, number>()
  config.mappings.forEach(m => {
    if (m.targetField) usedFields.set(m.targetField, (usedFields.get(m.targetField) ?? 0) + 1)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Map Columns
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            Tell the wizard which Excel column goes into which field
          </p>
        </div>
        <Btn variant="secondary" size="sm" onClick={autoMap}>
          <Wand2 className="size-3.5" />
          Auto-map
        </Btn>
      </div>

      {/* Fixed values panel for BRAND_PRODUCTS */}
      {isBrandProducts && (
        <BrandProductsFixedPanel
          staticValues={config.staticValues ?? {}}
          onChange={vals => onChange({ staticValues: vals })}
        />
      )}

      {/* Available target fields hint */}
      {mappableTargetFields.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
            Fields you can map:
          </span>
          {mappableTargetFields.map(f => (
            <span key={f.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{
                background: f.required ? "var(--primary-light)" : "var(--muted)",
                color: f.required ? "var(--primary)" : "var(--foreground-muted)",
                border: `1px solid ${f.required ? "var(--primary)" : "var(--border)"}`,
              }}>
              {f.label}{f.required && <span style={{ color: "var(--danger)" }}>*</span>}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "var(--foreground-muted)" }}>
            <strong style={{ color: "var(--foreground)" }}>{stats.mapped}</strong> of {stats.total} columns mapped
          </span>
          <span style={{ color: pct === 100 ? "var(--success-fg)" : "var(--foreground-muted)" }}>
            {pct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "var(--success)" : "var(--primary)",
            }}
          />
        </div>
      </div>

      {/* Missing required warning */}
      {(stats.missingRequired.length > 0 || stats.missingStaticBrand) && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px]"
          style={{ background: "var(--warning-light)", color: "var(--warning-fg)" }}>
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            {stats.missingStaticBrand && (
              <span>Select a <strong>Brand</strong> above. </span>
            )}
            {stats.missingRequired.length > 0 && (
              <span>
                Required fields not mapped:{" "}
                {stats.missingRequired.map(f => (
                  <strong key={f.key} className="font-semibold">{f.label}</strong>
                )).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ", ", el], [])}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Mapping rows */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{
            gridTemplateColumns: "1fr 32px 1fr 20px",
            background: "var(--muted)",
            borderBottom: "1px solid var(--border)",
            color: "var(--foreground-muted)",
          }}>
          <span>Excel Column</span>
          <span />
          <span>Target Field</span>
          <span />
        </div>

        <div className="divide-y" style={{ ["--tw-divide-opacity" as string]: 1 }}>
          {config.mappings.map((m, idx) => {
            const isDuplicate = m.targetField && (usedFields.get(m.targetField) ?? 0) > 1
            const targetF = config.targetFields.find(f => f.key === m.targetField)
            const isMapped = !!m.targetField

            return (
              <div
                key={m.excelColumn}
                className="grid items-center px-4 py-3 gap-3 transition-colors"
                style={{
                  gridTemplateColumns: "1fr 32px 1fr 20px",
                  background: idx % 2 === 0 ? "var(--surface)" : "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {/* Excel column */}
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {m.excelColumn}
                  </p>
                  {colInfoMap[m.excelColumn]?.samples && colInfoMap[m.excelColumn].samples.length > 0 && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--foreground-subtle)" }}>
                      e.g. {colInfoMap[m.excelColumn].samples.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className="size-4 shrink-0 mx-auto"
                  style={{ color: isMapped ? "var(--primary)" : "var(--border-strong)" }} />

                {/* Target field dropdown — only shows mappable (non-static) fields */}
                <div className="min-w-0">
                  <div className="relative">
                    <select
                      value={m.targetField}
                      onChange={e => setMapping(m.excelColumn, e.target.value)}
                      className="w-full appearance-none rounded-lg pl-2.5 pr-7 py-1.5 text-[12px] font-medium outline-none transition-colors cursor-pointer"
                      style={{
                        background: isMapped ? "var(--primary-light)" : "var(--muted)",
                        border: `1px solid ${isDuplicate ? "var(--warning)" : isMapped ? "var(--primary)" : "var(--border)"}`,
                        color: isMapped ? "var(--primary)" : "var(--foreground-muted)",
                      }}
                    >
                      <option value="">— skip —</option>
                      {mappableTargetFields.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? " *" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px]"
                      style={{ color: "var(--foreground-muted)" }}>▾</span>
                  </div>
                  {targetF?.description && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--foreground-subtle)" }}>
                      {targetF.description}
                    </p>
                  )}
                </div>

                {/* Status dot */}
                <div className="flex items-center justify-center">
                  {isMapped ? (
                    <span className="size-4 rounded-full flex items-center justify-center"
                      style={{ background: isDuplicate ? "var(--warning-light)" : "var(--success-light)" }}>
                      <Check className="size-2.5" strokeWidth={3}
                        style={{ color: isDuplicate ? "var(--warning)" : "var(--success-fg)" }} />
                    </span>
                  ) : (
                    <span className="size-4 rounded-full"
                      style={{ background: "var(--border)" }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
        Fields marked with <strong>*</strong> are required. Unmapped columns are ignored during import.
      </p>
    </div>
  )
}
