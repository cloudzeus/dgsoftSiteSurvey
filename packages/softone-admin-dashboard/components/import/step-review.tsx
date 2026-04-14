"use client"

import { useState } from "react"
import {
  FileSpreadsheet, Layers, ArrowRight, Play, CheckCircle2,
  XCircle, AlertTriangle, ChevronDown, ChevronUp, Loader2,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import type { ImportConfig } from "./types"

type RowError = { row: number; error: string }

type RunResult = {
  jobId: string
  totalRows: number
  succeededRows: number
  failedRows: number
  status: string
  errors: RowError[]
}

type Props = {
  config: ImportConfig
  onChange: (patch: Partial<ImportConfig>) => void
}

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function StepReview({ config, onChange }: Props) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState("")
  const [showErrors, setShowErrors] = useState(false)

  const mappedCount = config.mappings.filter(m => m.targetField).length

  async function runImport() {
    if (!config.file) return
    setRunning(true); setError(""); setResult(null)

    const fd = new FormData()
    fd.append("file", config.file)
    fd.append("config", JSON.stringify({
      jobName: config.jobName || `Import ${config.fileName} → ${config.targetObjectKey}`,
      connectionId: config.connectionId,
      connectionType: config.connectionType,
      targetObject: config.targetObjectKey,
      sheetName: config.selectedSheet,
      headerRow: config.headerRow,
      mappings: config.mappings,
      staticValues: config.staticValues ?? {},
      categoryMarkers: config.categoryMarkers ?? [],
      skipErrors: config.skipErrors,
    }))

    try {
      const res = await fetch("/api/import/run", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Import failed"); return }
      setResult(data)
    } catch {
      setError("Import failed. Please try again.")
    } finally {
      setRunning(false)
    }
  }

  if (result) {
    const allGood = result.failedRows === 0
    const allFailed = result.succeededRows === 0

    return (
      <div className="space-y-5">
        {/* Result header */}
        <div className="flex items-start gap-4 p-5 rounded-2xl"
          style={{
            background: allFailed ? "var(--danger-light)" : allGood ? "var(--success-light)" : "var(--warning-light)",
            border: `1.5px solid ${allFailed ? "#fca5a5" : allGood ? "#bbf7d0" : "#fcd34d"}`,
          }}>
          {allGood
            ? <CheckCircle2 className="size-8 shrink-0 mt-0.5" style={{ color: "var(--success-fg)" }} />
            : allFailed
            ? <XCircle className="size-8 shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
            : <AlertTriangle className="size-8 shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
          }
          <div>
            <p className="text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
              {allGood ? "Import completed successfully"
                : allFailed ? "Import failed"
                : "Import completed with errors"}
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--foreground-muted)" }}>
              Job ID: <code className="font-mono text-[11px]">{result.jobId}</code>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Rows",  value: result.totalRows,     color: "var(--foreground)" },
            { label: "Succeeded",   value: result.succeededRows, color: "var(--success-fg)" },
            { label: "Failed",      value: result.failedRows,    color: result.failedRows > 0 ? "var(--danger)" : "var(--foreground-muted)" },
          ].map(s => (
            <div key={s.label} className="text-center p-4 rounded-xl"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
              <p className="text-[24px] font-bold tabular-nums" style={{ color: s.color }}>
                {s.value.toLocaleString()}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Error log */}
        {result.errors.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--danger-light)" }}>
            <button
              onClick={() => setShowErrors(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold"
              style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}
            >
              <span className="flex items-center gap-2">
                <XCircle className="size-3.5" />
                {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
                {result.failedRows > result.errors.length && ` (showing first ${result.errors.length})`}
              </span>
              {showErrors ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            {showErrors && (
              <div className="max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex gap-3 px-4 py-2 text-[11px]"
                    style={{ borderTop: "1px solid var(--danger-light)", background: i % 2 === 0 ? "white" : "#fef2f2" }}>
                    <span className="font-mono font-semibold shrink-0" style={{ color: "var(--foreground-muted)" }}>
                      Row {e.row}
                    </span>
                    <span style={{ color: "var(--danger-fg)" }}>{e.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Review &amp; Import
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          Confirm the details below, then click Start Import
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-xl"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
          <FileSpreadsheet className="size-8 shrink-0" style={{ color: "var(--primary)" }} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5"
              style={{ color: "var(--foreground-muted)" }}>Source</p>
            <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {config.fileName}
            </p>
            <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
              {config.selectedSheet} · {config.totalRows.toLocaleString()} rows · {formatBytes(config.fileSize)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-xl"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
          <Layers className="size-8 shrink-0" style={{ color: "var(--primary)" }} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5"
              style={{ color: "var(--foreground-muted)" }}>Target</p>
            <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {config.connectionName}
            </p>
            <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
              {config.targetObjectKey} · {mappedCount} field{mappedCount !== 1 ? "s" : ""} mapped
            </p>
          </div>
        </div>
      </div>

      {/* Category markers summary */}
      {config.categoryMarkers && config.categoryMarkers.filter(m => m.category).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--foreground-muted)" }}>
            Category Markers ({config.categoryMarkers.length})
          </p>
          <div className="rounded-xl overflow-hidden" style={{ border: "1.5px solid rgb(107,33,168)" }}>
            {[...config.categoryMarkers].sort((a, b) => a.rowNum - b.rowNum).map((m, i) => (
              <div key={m.rowNum}
                className="flex items-center gap-3 px-3 py-2 text-[12px]"
                style={{
                  background: i % 2 === 0 ? "rgba(107,33,168,0.05)" : "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                }}>
                <span className="font-mono text-[10px] shrink-0" style={{ color: "rgb(107,33,168)" }}>Row {m.rowNum}</span>
                <span className="flex-1" style={{ color: "var(--foreground-muted)" }}>→</span>
                <span className="font-semibold" style={{ color: "rgb(107,33,168)" }}>{m.category || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixed values summary */}
      {config.staticValues && Object.keys(config.staticValues).filter(k => config.staticValues[k]).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--foreground-muted)" }}>
            Fixed Values (applied to every row)
          </p>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--primary)" }}>
            {Object.entries(config.staticValues).filter(([, v]) => v).map(([key, val], i) => (
              <div key={key}
                className="flex items-center gap-2 px-3 py-2 text-[12px]"
                style={{
                  background: i % 2 === 0 ? "var(--primary-light)" : "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                }}>
                <span className="flex-1 font-medium capitalize" style={{ color: "var(--foreground-muted)" }}>
                  {key.replace(/_/g, " ")}
                </span>
                <span className="font-semibold" style={{ color: "var(--primary)" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapping summary table */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
          style={{ color: "var(--foreground-muted)" }}>
          Column Mappings ({mappedCount} of {config.mappings.length} active)
        </p>
        <div className="rounded-xl overflow-hidden max-h-48 overflow-y-auto"
          style={{ border: "1px solid var(--border)" }}>
          {config.mappings.filter(m => m.targetField).map((m, i) => {
            const targetF = config.targetFields.find(f => f.key === m.targetField)
            return (
              <div key={m.excelColumn}
                className="flex items-center gap-2 px-3 py-2 text-[12px]"
                style={{
                  background: i % 2 === 0 ? "var(--surface)" : "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}>
                <span className="flex-1 truncate font-medium" style={{ color: "var(--foreground)" }}>
                  {m.excelColumn}
                </span>
                <ArrowRight className="size-3 shrink-0" style={{ color: "var(--foreground-subtle)" }} />
                <span className="flex-1 truncate text-right" style={{ color: "var(--primary)" }}>
                  {targetF?.label ?? m.targetField}
                  {targetF?.required && <span className="ml-0.5 opacity-60">*</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3 p-4 rounded-xl" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
          Import Options
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.skipErrors}
            onChange={e => onChange({ skipErrors: e.target.checked })}
            className="mt-0.5"
          />
          <div>
            <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
              Continue on error
            </p>
            <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
              Skip rows that fail and continue importing the rest
            </p>
          </div>
        </label>

        <div className="space-y-1">
          <label className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>
            Job name <span style={{ color: "var(--foreground-muted)" }}>(optional)</span>
          </label>
          <input
            className="input-field w-full text-[12px]"
            placeholder={`Import ${config.fileName} → ${config.targetObjectKey}`}
            value={config.jobName}
            onChange={e => onChange({ jobName: e.target.value })}
            maxLength={80}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
          style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Run button */}
      <Btn
        variant="primary"
        size="lg"
        fullWidth
        loading={running}
        onClick={runImport}
      >
        {!running && <Play className="size-4" />}
        {running ? "Importing…" : `Start Import — ${config.totalRows.toLocaleString()} rows`}
      </Btn>
    </div>
  )
}
