"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { CredentialEditor, CONNECTION_TYPES } from "./create-connection-dialog"

const MASKED = "••••••••"

type Pair = { key: string; value: string; secret: boolean }

// Normalize legacy key names to current canonical names
const KEY_ALIASES: Record<string, string> = {
  serialNo: "baseUrl",
}

function credsToPairs(credentials: Record<string, any>): Pair[] {
  const pairs: Pair[] = []
  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === "object") continue // skip nested (e.g. storeViews array)
    pairs.push({
      key: KEY_ALIASES[key] ?? key,
      value: value === MASKED ? "" : String(value ?? ""),
      secret: value === MASKED,
    })
  }
  return pairs.length > 0 ? pairs : [{ key: "", value: "", secret: false }]
}

function pairsToObj(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key, value } of pairs) if (key.trim() && value.trim()) out[key.trim()] = value
  return out
}

export function EditConnectionDialog({
  connection,
  open,
  onClose,
}: {
  connection: { id: string; name: string; type: string; credentials: Record<string, any> }
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(connection.name)
  const [pairs, setPairs] = useState<Pair[]>(() => credsToPairs(connection.credentials))
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; raw?: unknown } | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  const typeLabel = CONNECTION_TYPES.find((t) => t.value === connection.type)?.label ?? connection.type
  const hasMasked = Object.values(connection.credentials).some((v) => v === MASKED)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      // Test against the saved connection, merging any edited values on the server
      // (server keeps stored secrets for fields left blank in the form)
      const testRes = await fetch(`/api/connections/${connection.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: pairsToObj(pairs) }),
      })
      const result = await testRes.json()
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: String(err) })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, credentials: pairsToObj(pairs) }),
      })
      router.refresh()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 focus:outline-none overflow-y-auto max-h-[90vh]"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                Edit connection
              </Dialog.Title>
              <Dialog.Description className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {typeLabel}
                {hasMasked && " · Sensitive fields cleared — re-enter to update"}
              </Dialog.Description>
            </div>
            <Dialog.Close className="size-7 rounded-lg flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                Connection name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>

            {/* Credentials */}
            <div>
              <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                Credentials
              </label>
              <CredentialEditor pairs={pairs} onChange={setPairs} />
            </div>

            {/* Test result */}
            {testResult && (
              <div className={cn("rounded-xl px-3 py-2.5 space-y-2 text-[12px]", testResult.ok ? "bg-emerald-500/10" : "bg-red-500/10")}>
                <div className="flex items-center gap-2">
                  {testResult.ok
                    ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    : <XCircle className="size-4 text-red-500 shrink-0" />}
                  <span style={{ color: testResult.ok ? "#16a34a" : "#dc2626" }}>
                    {testResult.ok ? "Connection successful" : testResult.error}
                  </span>
                  {testResult.raw !== undefined && (
                    <button
                      type="button"
                      onClick={() => setShowRaw((v) => !v)}
                      className="ml-auto text-[10px] font-semibold underline underline-offset-2"
                      style={{ color: testResult.ok ? "#16a34a" : "#dc2626" }}
                    >
                      {showRaw ? "Hide" : "View response"}
                    </button>
                  )}
                </div>
                {showRaw && testResult.raw !== undefined && (
                  <pre className="rounded-lg p-2.5 text-[10px] overflow-x-auto max-h-48 leading-relaxed"
                    style={{ background: "var(--background)", color: "var(--foreground)" }}>
                    {JSON.stringify(testResult.raw, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Btn variant="ghost" size="md" onClick={onClose}>Cancel</Btn>
              <div className="flex gap-2">
                <Btn variant="secondary" size="md" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="size-3.5 animate-spin" /> : "Test"}
                </Btn>
                <Btn variant="primary" size="md" onClick={handleSave} disabled={saving || !name.trim()}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                </Btn>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
