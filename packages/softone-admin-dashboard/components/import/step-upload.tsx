"use client"

import { useRef, useState, type DragEvent } from "react"
import { FileSpreadsheet, Upload, X, AlertTriangle } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import type { ImportConfig } from "./types"

type Props = {
  config: ImportConfig
  onChange: (patch: Partial<ImportConfig>) => void
}

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function StepUpload({ config, onChange }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !["xlsx", "xls", "xlsm"].includes(ext)) {
      setError("Please upload an Excel file (.xlsx or .xls)")
      return
    }
    setLoading(true); setError("")
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch("/api/import/parse", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to read file"); return }
      onChange({
        file,
        fileName: data.fileName,
        fileSize: data.fileSize,
        sheets: data.sheets,
        // Pre-select first sheet
        selectedSheet: data.sheets[0]?.name ?? "",
      })
    } catch {
      setError("Failed to read file. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const hasFile = !!config.fileName

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Upload Excel File
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          Supports .xlsx and .xls files up to 20 MB
        </p>
      </div>

      {!hasFile ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="relative flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all"
          style={{
            minHeight: 220,
            border: `2px dashed ${dragging ? "var(--primary)" : "var(--border-strong)"}`,
            background: dragging ? "var(--primary-light)" : "var(--muted)",
            padding: "40px 24px",
          }}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--primary-light)" }}>
                <FileSpreadsheet className="size-6 animate-pulse" style={{ color: "var(--primary)" }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                Reading file…
              </p>
            </div>
          ) : (
            <>
              <div className="size-14 rounded-2xl flex items-center justify-center"
                style={{ background: dragging ? "var(--primary)" : "var(--border)", transition: "background 150ms" }}>
                <Upload className="size-6" style={{ color: dragging ? "#fff" : "var(--foreground-muted)" }} />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {dragging ? "Drop to upload" : "Drop your Excel file here"}
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--foreground-muted)" }}>
                  or <span style={{ color: "var(--primary)", fontWeight: 600 }}>click to browse</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {[".xlsx", ".xls", ".xlsm"].map(ext => (
                  <span key={ext} className="text-[11px] font-mono px-2 py-0.5 rounded"
                    style={{ background: "var(--border)", color: "var(--foreground-muted)" }}>
                    {ext}
                  </span>
                ))}
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      ) : (
        /* File info card */
        <div className="rounded-2xl p-4 flex items-start gap-4"
          style={{ background: "var(--success-light)", border: "1.5px solid #bbf7d0" }}>
          <div className="size-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "white" }}>
            <FileSpreadsheet className="size-6" style={{ color: "var(--success-fg)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {config.fileName}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {formatBytes(config.fileSize)} · {config.sheets.length} sheet{config.sheets.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {config.sheets.map(s => (
                <span key={s.name} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "white", color: "var(--success-fg)", border: "1px solid #bbf7d0" }}>
                  {s.name} — {s.rowCount.toLocaleString()} rows
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              onChange({ file: null, fileName: "", fileSize: 0, sheets: [], selectedSheet: "" })
              if (inputRef.current) inputRef.current.value = ""
            }}
            className="p-1.5 rounded-lg shrink-0"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
          style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
