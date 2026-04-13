"use client"

import { useState, useRef, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, Upload, Loader2, CheckCircle2, XCircle, Paperclip, Trash2, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionOption = { value: string; label: string }

type SelectedFile = {
  id: string
  file: File
  name: string
  type: string
  section: string
}

type UploadStatus = "idle" | "uploading" | "done" | "error"

export type FileUploadDialogProps = {
  open: boolean
  onClose: () => void
  /** Endpoint to POST each file to */
  uploadUrl: string
  /** Dialog title */
  title?: string
  /** Dialog subtitle (e.g. customer name) */
  subtitle?: string | undefined
  /**
   * Fixed section applied to all uploads — no per-file selector shown.
   * Pass undefined to let users choose per file (requires `sections` prop).
   */
  section?: string | undefined
  /**
   * Available sections the user can pick per file.
   * Only used when `section` is not provided.
   */
  sections?: SectionOption[] | undefined
  /**
   * Suggested file types shown in the type picker.
   * Defaults to a sensible list.
   */
  typeOptions?: string[] | undefined
  /** Called after all files have been successfully uploaded */
  onUploaded?: (() => void) | undefined
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DEFAULT_TYPE_OPTIONS = [
  "Photo",
  "Document",
  "Diagram",
  "Report",
  "Certificate",
  "Manual",
  "Invoice",
  "Quote",
  "Other",
]

// ─── Type picker ──────────────────────────────────────────────────────────────

function TypePicker({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function select(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((p) => !p); setTimeout(() => inputRef.current?.focus(), 50) }}
        className={cn(
          "w-full flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[12px] outline-none transition-colors",
          "hover:border-indigo-500/40 focus:border-indigo-500/60",
          disabled && "opacity-50 cursor-not-allowed",
          !value && "text-[var(--muted-foreground)]/50",
        )}
      >
        <span>{value || "Select type…"}</span>
        <ChevronDown className="size-3 shrink-0 ml-1" style={{ color: "var(--muted-foreground)" }} />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Custom free-text input */}
          <div className="p-2 border-b border-[var(--border)]">
            <input
              ref={inputRef}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[12px] outline-none focus:border-indigo-500/60"
              placeholder="Type custom…"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) { select(custom.trim()); setCustom("") }
                if (e.key === "Escape") setOpen(false)
              }}
            />
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => select(o)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-[12px] hover:bg-indigo-500/8 transition-colors",
                  value === o ? "text-indigo-400 font-semibold" : "",
                )}
                style={{ color: value === o ? undefined : "var(--foreground)" }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section picker ───────────────────────────────────────────────────────────

function SectionPicker({
  value,
  onChange,
  sections,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  sections: SectionOption[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[12px] outline-none transition-colors appearance-none",
        "hover:border-indigo-500/40 focus:border-indigo-500/60",
        disabled && "opacity-50 cursor-not-allowed",
        !value && "text-[var(--muted-foreground)]/50",
      )}
      style={{ color: value ? "var(--foreground)" : undefined }}
    >
      <option value="">Select section…</option>
      {sections.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FileUploadDialog({
  open,
  onClose,
  uploadUrl,
  title = "Upload Files",
  subtitle,
  section: fixedSection,
  sections,
  typeOptions = DEFAULT_TYPE_OPTIONS,
  onUploaded,
}: FileUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [uploading, setUploading]         = useState(false)
  const [statuses, setStatuses]           = useState<Record<string, UploadStatus>>({})
  const [dragOver, setDragOver]           = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const showSectionPicker = !fixedSection && !!sections?.length

  const allDone  = selectedFiles.length > 0 && selectedFiles.every((f) => statuses[f.id] === "done")
  const hasError = selectedFiles.some((f) => statuses[f.id] === "error")

  function addFiles(rawFiles: FileList | File[]) {
    const incoming = Array.from(rawFiles).map((f) => ({
      id:      `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file:    f,
      name:    f.name.replace(/\.[^.]+$/, ""),
      type:    "",
      section: fixedSection ?? "",
    }))
    setSelectedFiles((prev) => [...prev, ...incoming])
  }

  function removeFile(id: string) {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id))
    setStatuses((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  function updateField(id: string, field: keyof Pick<SelectedFile, "name" | "type" | "section">, value: string) {
    setSelectedFiles((prev) => prev.map((f) => f.id === id ? { ...f, [field]: value } : f))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }, [fixedSection]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    if (uploading) return
    setSelectedFiles([])
    setStatuses({})
    onClose()
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || uploading) return
    setUploading(true)

    let anyUploaded = false

    for (const sf of selectedFiles) {
      if (statuses[sf.id] === "done") continue
      setStatuses((prev) => ({ ...prev, [sf.id]: "uploading" }))
      try {
        const fd = new FormData()
        fd.append("file",    sf.file)
        fd.append("name",    sf.name.trim() || sf.file.name)
        fd.append("type",    sf.type.trim())
        fd.append("section", sf.section.trim())

        const res = await fetch(uploadUrl, { method: "POST", body: fd })
        const ok  = res.ok
        setStatuses((prev) => ({ ...prev, [sf.id]: ok ? "done" : "error" }))
        if (ok) anyUploaded = true
      } catch {
        setStatuses((prev) => ({ ...prev, [sf.id]: "error" }))
      }
    }

    setUploading(false)
    if (anyUploaded) onUploaded?.()
  }

  const fieldCls =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-500/60 placeholder:text-[var(--muted-foreground)]/50 transition-colors"

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                  <Paperclip className="size-3.5 text-indigo-400" />
                </div>
                <div>
                  <Dialog.Title className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
                    {title}
                  </Dialog.Title>
                  {subtitle && (
                    <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={uploading}
                className="size-7 rounded-lg flex items-center justify-center hover:bg-[var(--muted)] transition-colors disabled:opacity-40"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "rounded-xl border-2 border-dashed px-6 py-8 flex flex-col items-center gap-2 cursor-pointer transition-colors select-none",
                  dragOver
                    ? "border-indigo-500/60 bg-indigo-500/8"
                    : "border-[var(--border)] hover:border-indigo-500/40 hover:bg-indigo-500/4",
                )}
              >
                <Upload className="size-6" style={{ color: "var(--muted-foreground)" }} />
                <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                  Drop files here or click to browse
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  Any file type · max 50 MB each
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
              </div>

              {/* Fixed section badge */}
              {fixedSection && selectedFiles.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                    Section:
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                    {fixedSection}
                  </span>
                </div>
              )}

              {/* File list */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                  </p>

                  {selectedFiles.map((sf) => {
                    const status = statuses[sf.id] ?? "idle"
                    const locked = status === "uploading" || status === "done"

                    return (
                      <div
                        key={sf.id}
                        className={cn(
                          "rounded-xl border border-[var(--border)] px-3 py-3 bg-[var(--muted)]/20 space-y-2",
                          status === "done"  && "border-emerald-500/30 bg-emerald-500/5",
                          status === "error" && "border-rose-500/30 bg-rose-500/5",
                        )}
                      >
                        {/* Top row: status icon + filename + remove */}
                        <div className="flex items-center gap-2">
                          <div className="shrink-0">
                            {status === "uploading" && <Loader2 className="size-4 animate-spin text-indigo-400" />}
                            {status === "done"      && <CheckCircle2 className="size-4 text-emerald-500" />}
                            {status === "error"     && <XCircle className="size-4 text-rose-500" />}
                            {status === "idle"      && <Paperclip className="size-4" style={{ color: "var(--muted-foreground)" }} />}
                          </div>
                          <p className="flex-1 text-[10px] font-mono truncate" style={{ color: "var(--muted-foreground)" }}>
                            {sf.file.name} · {formatBytes(sf.file.size)}
                          </p>
                          {!locked && (
                            <button
                              onClick={() => removeFile(sf.id)}
                              className="shrink-0 rounded-md p-1 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Name */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                            Name <span className="normal-case font-normal opacity-60">(required)</span>
                          </label>
                          <input
                            className={fieldCls}
                            value={sf.name}
                            onChange={(e) => updateField(sf.id, "name", e.target.value)}
                            placeholder="File display name"
                            disabled={locked}
                          />
                        </div>

                        {/* Type + Section (side by side if both shown) */}
                        <div className={cn("gap-3", showSectionPicker ? "grid grid-cols-2" : "")}>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                              Type <span className="normal-case font-normal opacity-60">(optional)</span>
                            </label>
                            <TypePicker
                              value={sf.type}
                              onChange={(v) => updateField(sf.id, "type", v)}
                              options={typeOptions}
                              disabled={locked}
                            />
                          </div>

                          {showSectionPicker && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                                Section <span className="normal-case font-normal opacity-60">(optional)</span>
                              </label>
                              <SectionPicker
                                value={sf.section}
                                onChange={(v) => updateField(sf.id, "section", v)}
                                sections={sections!}
                                disabled={locked}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--muted)]/10">
              {allDone && !hasError && (
                <span className="text-[11px] text-emerald-500 font-semibold mr-auto">
                  All files uploaded successfully!
                </span>
              )}
              {hasError && (
                <span className="text-[11px] text-rose-500 font-semibold mr-auto">
                  Some files failed — retry or remove them.
                </span>
              )}

              <button
                onClick={handleClose}
                disabled={uploading}
                className="rounded-lg px-3.5 py-1.5 text-[12px] font-semibold border border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors disabled:opacity-50"
                style={{ color: "var(--muted-foreground)" }}
              >
                {allDone && !hasError ? "Close" : "Cancel"}
              </button>

              {!(allDone && !hasError) && (
                <button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || uploading}
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  {uploading
                    ? "Uploading…"
                    : `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}` : ""}`}
                </button>
              )}
            </div>

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
