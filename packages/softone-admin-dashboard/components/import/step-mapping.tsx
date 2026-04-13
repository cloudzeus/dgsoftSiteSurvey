"use client"

import { useEffect, useMemo } from "react"
import { Wand2, ArrowRight, Check, AlertCircle } from "lucide-react"
import { autoMatchField } from "@/lib/import-targets"
import { Btn } from "@/components/ui/btn"
import type { ImportConfig, ColumnMapping } from "./types"

type Props = {
  config: ImportConfig
  onChange: (patch: Partial<ImportConfig>) => void
}

export function StepMapping({ config, onChange }: Props) {
  // Only map the columns the user kept in step 2
  const activeCols = config.columns.filter(c => config.selectedColumns.includes(c.key))

  // Init mappings when entering step
  useEffect(() => {
    if (config.mappings.length === 0 && activeCols.length > 0) {
      const initial: ColumnMapping[] = activeCols.map(col => ({
        excelColumn: col.key,
        targetField: autoMatchField(col.key, config.targetFields),
      }))
      onChange({ mappings: initial })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function autoMap() {
    const mapped: ColumnMapping[] = activeCols.map(col => ({
      excelColumn: col.key,
      targetField: autoMatchField(col.key, config.targetFields),
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
    const required = config.targetFields.filter(f => f.required)
    const missingRequired = required.filter(
      f => !config.mappings.some(m => m.targetField === f.key),
    )
    return { mapped, total: config.mappings.length, missingRequired }
  }, [config.mappings, config.targetFields])

  // Derive which column info to show per mapping row
  const colInfoMap = useMemo(
    () => Object.fromEntries(activeCols.map(c => [c.key, c])),
    [activeCols],
  )

  const pct = stats.total > 0 ? Math.round((stats.mapped / stats.total) * 100) : 0

  // Build a set of already-mapped target fields to show duplicates
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
            Match each Excel column to a field in <strong>{config.connectionName}</strong> → <strong>{config.targetObjectKey}</strong>
          </p>
        </div>
        <Btn variant="secondary" size="sm" onClick={autoMap}>
          <Wand2 className="size-3.5" />
          Auto-map
        </Btn>
      </div>

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
      {stats.missingRequired.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px]"
          style={{ background: "var(--warning-light)", color: "var(--warning-fg)" }}>
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Required fields not mapped:{" "}
            {stats.missingRequired.map(f => (
              <strong key={f.key} className="font-semibold">{f.label}</strong>
            )).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ", ", el], [])}
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

                {/* Target field dropdown */}
                <div className="relative min-w-0">
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
                    <option value="">— skip this column —</option>
                    {config.targetFields.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}{f.required ? " *" : ""} ({f.key})
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px]"
                    style={{ color: "var(--foreground-muted)" }}>▾</span>
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
