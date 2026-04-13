"use client"

import { useState, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Trash2, RefreshCw, ChevronDown, ChevronRight, Terminal, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn } from "@/components/ui/btn"
import type { S1LogEntry } from "@/lib/s1-log"

function DirectionBadge({ dir }: { dir: "→" | "←" }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-bold shrink-0"
      style={{
        background: dir === "→" ? "#6366f115" : "#10b98115",
        color: dir === "→" ? "#818cf8" : "#34d399",
        border: `1px solid ${dir === "→" ? "#6366f130" : "#10b98130"}`,
      }}
    >
      {dir}
    </span>
  )
}

function StatusDot({ ok }: { ok?: boolean }) {
  if (ok === undefined) return null
  return (
    <span className={cn("size-1.5 rounded-full shrink-0", ok ? "bg-emerald-400" : "bg-red-400")} />
  )
}

function EntryRow({ entry, selected, onSelect }: { entry: S1LogEntry; selected: boolean; onSelect: () => void }) {
  const time = entry.ts instanceof Date ? entry.ts : new Date(entry.ts)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors",
        selected ? "bg-indigo-500/10" : "hover:bg-[var(--muted)]"
      )}
    >
      <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: "var(--muted-foreground)", minWidth: 60 }}>
        {time.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <DirectionBadge dir={entry.direction} />
      <span className="font-mono font-semibold truncate flex-1" style={{ color: selected ? "#818cf8" : "var(--foreground)" }}>
        {entry.service}
      </span>
      {entry.durationMs !== undefined && (
        <span className="text-[10px] shrink-0" style={{ color: "var(--muted-foreground)" }}>{entry.durationMs}ms</span>
      )}
      <StatusDot ok={entry.ok} />
    </button>
  )
}

export function S1Inspector() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<S1LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<S1LogEntry | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/s1/log")
      if (res.ok) setEntries(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  async function clearLog() {
    await fetch("/api/s1/log", { method: "DELETE" })
    setEntries([])
    setSelected(null)
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/s1/test", { method: "POST" })
      setTestResult(await res.json())
      await fetchLog()
    } finally {
      setTesting(false)
    }
  }

  function onOpen(v: boolean) {
    setOpen(v)
    if (v) fetchLog()
    else { setSelected(null); setTestResult(null) }
  }

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function renderJson(data: unknown, depth = 0): React.ReactNode {
    if (data === null || data === undefined) return <span style={{ color: "var(--muted-foreground)" }}>null</span>
    if (typeof data === "boolean") return <span style={{ color: "#f59e0b" }}>{String(data)}</span>
    if (typeof data === "number") return <span style={{ color: "#34d399" }}>{data}</span>
    if (typeof data === "string") return <span style={{ color: "#fb923c" }}>"{data.length > 120 ? data.slice(0, 120) + "…" : data}"</span>
    if (Array.isArray(data)) {
      if (data.length === 0) return <span style={{ color: "var(--muted-foreground)" }}>[]</span>
      const key = `arr-${depth}`
      const isOpen = expanded.has(key)
      return (
        <span>
          <button type="button" onClick={() => toggleExpand(key)} className="inline-flex items-center gap-0.5 hover:underline" style={{ color: "#818cf8" }}>
            {isOpen ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
            [{data.length}]
          </button>
          {isOpen && (
            <div className="ml-3 border-l pl-2" style={{ borderColor: "var(--border)" }}>
              {data.slice(0, 20).map((item, i) => (
                <div key={i}>{renderJson(item, depth + 1)}</div>
              ))}
              {data.length > 20 && <div style={{ color: "var(--muted-foreground)" }}>…{data.length - 20} more</div>}
            </div>
          )}
        </span>
      )
    }
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) return <span style={{ color: "var(--muted-foreground)" }}>{"{}"}</span>
    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-1.5 items-start">
            <span className="shrink-0" style={{ color: "#818cf8" }}>{k}:</span>
            <span>{renderJson(v, depth + 1)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
          style={{
            background: "var(--muted)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)",
          }}
        >
          <Terminal className="size-3" />
          S1 Inspector
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full rounded-2xl border shadow-2xl animate-in fade-in zoom-in-95 duration-150 focus:outline-none flex flex-col"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            maxWidth: "min(900px, 96vw)",
            height: "min(640px, 90vh)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Terminal className="size-4" style={{ color: "#818cf8" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Softone API Inspector</span>
              <span className="text-[11px] rounded px-1.5 py-0.5" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                {entries.length} entries
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Btn variant="ghost" size="sm" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="size-3 animate-spin" /> : "Test connection"}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={fetchLog} disabled={loading}>
                {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={clearLog}>
                <Trash2 className="size-3" />
              </Btn>
              <Dialog.Close className="size-7 rounded-lg flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </div>

          {/* Test result banner */}
          {testResult && (
            <div
              className="px-4 py-2 text-[11px] font-semibold shrink-0 border-b"
              style={{
                background: testResult.ok ? "#10b98115" : "#ef444415",
                color: testResult.ok ? "#34d399" : "#f87171",
                borderColor: "var(--border)",
              }}
            >
              {testResult.ok ? "Connection successful" : `Failed: ${testResult.error}`}
            </div>
          )}

          {/* Body — split pane */}
          <div className="flex flex-1 min-h-0">
            {/* Left: entry list */}
            <div className="w-72 border-r flex flex-col min-h-0 shrink-0" style={{ borderColor: "var(--border)" }}>
              <div className="flex-1 overflow-y-auto">
                {entries.length === 0 ? (
                  <div className="p-4 text-center text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    No calls logged yet.<br />Click "Test connection" to start.
                  </div>
                ) : (
                  entries.map(e => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      selected={selected?.id === e.id}
                      onSelect={() => setSelected(e)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right: detail pane */}
            <div className="flex-1 overflow-y-auto p-4 min-w-0">
              {!selected ? (
                <div className="h-full flex items-center justify-center text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  Select an entry to inspect
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <DirectionBadge dir={selected.direction} />
                    <span className="font-mono font-bold text-[13px]" style={{ color: "var(--foreground)" }}>{selected.service}</span>
                    {selected.durationMs !== undefined && (
                      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{selected.durationMs}ms</span>
                    )}
                    {selected.ok !== undefined && (
                      <span className={cn("text-[11px] font-semibold", selected.ok ? "text-emerald-400" : "text-red-400")}>
                        {selected.ok ? "success" : "failed"}
                      </span>
                    )}
                    <span className="text-[10px] ml-auto" style={{ color: "var(--muted-foreground)" }}>
                      {new Date(selected.ts).toLocaleString()}
                    </span>
                  </div>

                  {/* Payload */}
                  <div
                    className="rounded-xl p-3 text-[11px] font-mono overflow-x-auto leading-relaxed"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    {renderJson(selected.payload)}
                  </div>

                  {/* Raw JSON toggle */}
                  <details>
                    <summary className="text-[10px] cursor-pointer select-none" style={{ color: "var(--muted-foreground)" }}>
                      Raw JSON
                    </summary>
                    <pre className="mt-2 rounded-xl p-3 text-[10px] overflow-x-auto max-h-64 leading-relaxed"
                      style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
