"use client"

import { useEffect, useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  Loader2, CheckCircle2, XCircle, SkipForward,
  Wifi, Download, Code2, Layers, GitCompare, Database,
  AlertTriangle, X, FileText, Hash, ArrowRight,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import type { FetchEvent } from "@/app/api/xml-feeds/[id]/fetch/stream/route"

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepKey = "connecting" | "downloading" | "parsing" | "fields" | "comparing" | "saving"
type StepStatus = "pending" | "running" | "done" | "skipped" | "error"

interface StepState {
  status: StepStatus
  message: string
  detail?: string
}

const STEP_DEFS: { key: StepKey; label: string; icon: React.ElementType }[] = [
  { key: "connecting",  label: "Connecting",       icon: Wifi       },
  { key: "downloading", label: "Downloading XML",   icon: Download   },
  { key: "parsing",     label: "Parsing structure", icon: Code2      },
  { key: "fields",      label: "Detecting fields",  icon: Layers     },
  { key: "comparing",   label: "Comparing changes", icon: GitCompare },
  { key: "saving",      label: "Saving to database",icon: Database   },
]

function initialSteps(): Record<StepKey, StepState> {
  return {
    connecting:  { status: "pending", message: "" },
    downloading: { status: "pending", message: "" },
    parsing:     { status: "pending", message: "" },
    fields:      { status: "pending", message: "" },
    comparing:   { status: "pending", message: "" },
    saving:      { status: "pending", message: "" },
  }
}

// ─── Step row ─────────────────────────────────────────────────────────────────

function StepRow({ def, state }: { def: typeof STEP_DEFS[number]; state: StepState }) {
  const Icon = def.icon

  const statusIcon = {
    pending: <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: "var(--border)" }} />,
    running: <Loader2 className="size-4 animate-spin flex-shrink-0" style={{ color: "#818cf8" }} />,
    done:    <CheckCircle2 className="size-4 flex-shrink-0 text-emerald-400" />,
    skipped: <SkipForward  className="size-4 flex-shrink-0"  style={{ color: "var(--muted-foreground)" }} />,
    error:   <XCircle      className="size-4 flex-shrink-0 text-red-400" />,
  }[state.status]

  return (
    <div className={cn(
      "flex items-start gap-3 px-4 py-3 rounded-lg transition-colors",
      state.status === "running" && "bg-indigo-500/5",
      state.status === "error"   && "bg-red-500/5",
    )}>
      {/* Step icon */}
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 mt-0.5",
        state.status === "pending" && "opacity-30",
      )}
        style={{ background: "var(--muted)" }}>
        <Icon className="size-4" style={{
          color: state.status === "done"    ? "#34d399"
               : state.status === "running" ? "#818cf8"
               : state.status === "error"   ? "#f87171"
               : "var(--muted-foreground)",
        }} />
      </div>

      {/* Label + message */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium",
            state.status === "pending" && "opacity-40",
          )}
            style={{ color: "var(--foreground)" }}>
            {def.label}
          </span>
          {statusIcon}
        </div>
        {state.message && (
          <p className={cn(
            "text-xs mt-0.5 truncate",
            state.status === "error"   ? "text-red-400"
            : state.status === "done"  ? "text-emerald-400/80"
            : "var(--muted-foreground)",
          )}
            style={state.status !== "error" && state.status !== "done"
              ? { color: "var(--muted-foreground)" } : undefined}>
            {state.message}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Result summary ───────────────────────────────────────────────────────────

interface DoneResult { records: number; fields: number; changes: number; snapshotId: string }

function ResultSummary({ result }: { result: DoneResult }) {
  return (
    <div className="mx-4 mb-4 rounded-xl border p-4"
      style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: "var(--muted-foreground)" }}>Summary</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Records",  value: result.records,  icon: FileText,    color: "#818cf8" },
          { label: "Fields",   value: result.fields,   icon: Hash,        color: "#34d399" },
          { label: "Changes",  value: result.changes,  icon: ArrowRight,  color: result.changes > 0 ? "#f59e0b" : "var(--muted-foreground)" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg p-3 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <Icon className="size-4 mx-auto mb-1" style={{ color }} />
            <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean
  feedId:  string
  feedName: string
  onClose: () => void
  onDone?: () => void   // called after successful completion to refresh parent
}

export function XmlFeedFetchModal({ open, feedId, feedName, onClose, onDone }: Props) {
  const [steps,    setSteps]    = useState<Record<StepKey, StepState>>(initialSteps())
  const [result,   setResult]   = useState<DoneResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [running,  setRunning]  = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Start stream whenever modal opens
  useEffect(() => {
    if (!open) return
    // Reset
    setSteps(initialSteps())
    setResult(null)
    setError(null)
    setRunning(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    ;(async () => {
      try {
        const res = await fetch(`/api/xml-feeds/${feedId}/fetch/stream`, {
          method: "POST",
          signal: ctrl.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let   buffer  = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Parse complete SSE lines
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            try {
              const event: FetchEvent = JSON.parse(line.slice(6))
              handleEvent(event)
            } catch { /* skip malformed */ }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setError((err as Error).message)
      } finally {
        setRunning(false)
      }
    })()

    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feedId])

  function handleEvent(event: FetchEvent) {
    if (event.step === "done") {
      setResult({ records: event.records, fields: event.fields, changes: event.changes, snapshotId: event.snapshotId })
      return
    }
    if (event.step === "error") {
      setError(event.message)
      // Mark the currently running step as errored
      setSteps((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next) as StepKey[]) {
          if (next[key].status === "running") next[key] = { ...next[key], status: "error", message: event.message }
        }
        return next
      })
      return
    }

    // Normal step event
    const key = event.step as StepKey
    setSteps((prev) => ({
      ...prev,
      [key]: {
        status:  event.status,
        message: event.message,
      },
    }))
  }

  function handleClose() {
    abortRef.current?.abort()
    if (result) onDone?.()
    onClose()
  }

  const finished = !!result || !!error

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
          onInteractOutside={(e) => { if (running) e.preventDefault() }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
            style={{ borderColor: "var(--border)" }}>
            <div>
              <Dialog.Title className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {running ? "Fetching feed…" : result ? "Fetch complete" : "Fetch failed"}
              </Dialog.Title>
              <p className="text-xs mt-0.5 truncate max-w-[300px]"
                style={{ color: "var(--muted-foreground)" }}>{feedName}</p>
            </div>
            {finished && (
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-md" style={{ color: "var(--muted-foreground)" }}>
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            )}
          </div>

          {/* Steps */}
          <div className="py-2 px-1">
            {STEP_DEFS.map((def) => (
              <StepRow key={def.key} def={def} state={steps[def.key]} />
            ))}
          </div>

          {/* Error banner */}
          {error && !result && (
            <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-400">
              <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Result summary */}
          {result && <ResultSummary result={result} />}

          {/* Footer */}
          <div className="px-5 py-3.5 border-t flex-shrink-0 flex items-center justify-between"
            style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-1.5">
              {running && (
                <>
                  <Loader2 className="size-3.5 animate-spin" style={{ color: "#818cf8" }} />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Please wait…</span>
                </>
              )}
              {result && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Completed successfully
                </span>
              )}
              {error && !result && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <XCircle className="size-3.5" /> Fetch failed
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {running && (
                <Btn variant="ghost" size="sm"
                  onClick={() => { abortRef.current?.abort(); onClose() }}>
                  Cancel
                </Btn>
              )}
              {finished && (
                <Btn size="sm" onClick={handleClose}>
                  {result ? "Done" : "Close"}
                </Btn>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
