"use client"

import { useState } from "react"
import { Zap, Loader2, CheckCircle2 } from "lucide-react"

export function ProcessButton({ entityId }: { entityId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [result, setResult] = useState<string | null>(null)

  async function trigger() {
    setState("loading")
    setResult(null)
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setResult(`${data.processed} records processed`)
      setState("done")
      setTimeout(() => setState("idle"), 4000)
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Failed")
      setState("error")
      setTimeout(() => setState("idle"), 4000)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={trigger}
        disabled={state === "loading"}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-60"
        style={{
          background: state === "done" ? "#16a34a" : state === "error" ? "#dc2626" : "#6366f1",
          color: "#fff",
        }}
      >
        {state === "loading" ? <Loader2 className="size-3.5 animate-spin" />
         : state === "done" ? <CheckCircle2 className="size-3.5" />
         : <Zap className="size-3.5" />}
        {state === "loading" ? "Processing…" : state === "done" ? "Done!" : state === "error" ? "Error" : "Process now"}
      </button>
      {result && (
        <p className="text-[11px]" style={{ color: state === "error" ? "#dc2626" : "#16a34a" }}>{result}</p>
      )}
    </div>
  )
}
