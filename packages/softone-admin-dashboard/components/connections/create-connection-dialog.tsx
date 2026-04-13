"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Loader2, CheckCircle2, XCircle, Plus, Trash2, ChevronDown } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"

// ─── Type registry ────────────────────────────────────────────────────────────
// Type is just a label. The credential keys are templates — user fills the values.
// Integration logic lives in code, not here.

export const CONNECTION_TYPES: {
  value: string
  label: string
  group: string
  keys: { key: string; secret?: boolean; hint?: string }[]
}[] = [
  {
    value: "SOFTONE", label: "Softone ERP", group: "ERP / eCommerce",
    keys: [
      { key: "baseUrl",   hint: "https://kolleris.oncloud.gr  (/s1services added automatically)" },
      { key: "appId",     hint: "e.g. 2000" },
      { key: "username" },
      { key: "password",  secret: true },
      { key: "company",         hint: "optional" },
      { key: "branch",          hint: "optional" },
      { key: "module",          hint: "optional" },
      { key: "refId",           hint: "optional" },
      { key: "sessionTtlHours", hint: "hours session stays valid, default 8" },
    ],
  },
  {
    value: "SHOPIFY", label: "Shopify", group: "ERP / eCommerce",
    keys: [
      { key: "shopDomain",    hint: "mystore.myshopify.com" },
      { key: "accessToken",   secret: true },
      { key: "webhookSecret", secret: true, hint: "optional" },
    ],
  },
  {
    value: "MAGENTO", label: "Magento", group: "ERP / eCommerce",
    keys: [
      { key: "baseUrl",            hint: "https://store.example.com" },
      { key: "accessToken",        secret: true },
      { key: "adminStoreView",     hint: "all" },
      { key: "brandAttributeCode", hint: "manufacturer" },
    ],
  },
  {
    value: "WOOCOMMERCE", label: "WooCommerce", group: "ERP / eCommerce",
    keys: [
      { key: "baseUrl",        hint: "https://store.example.com" },
      { key: "consumerKey" },
      { key: "consumerSecret", secret: true },
    ],
  },
  {
    value: "OPENAI", label: "OpenAI", group: "AI",
    keys: [
      { key: "apiKey",       secret: true },
      { key: "model",        hint: "gpt-4o" },
      { key: "organization", hint: "optional" },
      { key: "baseUrl",      hint: "optional override" },
    ],
  },
  {
    value: "DEEPSEEK", label: "DeepSeek", group: "AI",
    keys: [
      { key: "apiKey",  secret: true },
      { key: "model",   hint: "deepseek-chat" },
      { key: "baseUrl", hint: "https://api.deepseek.com" },
    ],
  },
  {
    value: "MAILGUN", label: "Mailgun", group: "Communication",
    keys: [
      { key: "apiKey",    secret: true },
      { key: "domain",    hint: "mail.example.com" },
      { key: "endpoint",  hint: "https://api.eu.mailgun.net" },
      { key: "fromEmail", hint: "optional" },
      { key: "fromName",  hint: "optional" },
    ],
  },
  {
    value: "BUNNY_CDN", label: "Bunny CDN", group: "Storage / CDN",
    keys: [
      { key: "accessKey",      secret: true },
      { key: "storageZone" },
      { key: "storageApiHost", hint: "storage.bunnycdn.com" },
      { key: "cdnHostname",    hint: "myzone.b-cdn.net" },
    ],
  },
  {
    value: "GEOCODE_MAPS", label: "Geocode Maps", group: "Storage / CDN",
    keys: [
      { key: "apiKey", secret: true, hint: "from geocode.maps.co" },
    ],
  },
  {
    value: "BRAVE_SEARCH", label: "Brave Search", group: "Search",
    keys: [
      { key: "apiKey", secret: true, hint: "from api.search.brave.com" },
    ],
  },
  {
    value: "AEEDE_VAT", label: "AEEDE VAT Info", group: "Greek Gov / AADE",
    keys: [],
  },
  {
    value: "MILESIGHT", label: "Milesight IoT", group: "IoT / Sensors",
    keys: [
      { key: "serverAddress", hint: "https://eu-openapi.milesight.com" },
      { key: "clientId",      hint: "UUID from Developer Console" },
      { key: "clientSecret",  secret: true },
    ],
  },
  {
    value: "VIVA_PAYMENTS", label: "Viva Payments", group: "Payments",
    keys: [
      { key: "merchantId",  hint: "Merchant ID from Viva dashboard" },
      { key: "apiKey",      secret: true, hint: "API key from Viva dashboard" },
      { key: "environment", hint: "production or demo" },
    ],
  },
  {
    value: "YUBOTO_SMS", label: "Yuboto SMS", group: "Communication",
    keys: [
      { key: "apiKey", secret: true, hint: "Base64 API key from Yuboto Developers > API Key" },
      { key: "sender",               hint: "Sender name (max 11 chars) or phone number" },
    ],
  },
  {
    value: "SYNOLOGY", label: "Synology DSM", group: "Storage / CDN",
    keys: [
      { key: "baseUrl",  hint: "https://192.168.1.100:5001" },
      { key: "account" },
      { key: "password", secret: true },
      { key: "session",  hint: "optional session name, e.g. FileStation" },
    ],
  },
]

export type KnownConnectionType = typeof CONNECTION_TYPES[number]["value"]

const GROUPS = Array.from(
  CONNECTION_TYPES.reduce((m, t) => {
    if (!m.has(t.group)) m.set(t.group, [])
    m.get(t.group)!.push(t)
    return m
  }, new Map<string, typeof CONNECTION_TYPES>())
)

const SENSITIVE_KEYS = new Set(["password", "secret", "token", "apikey", "accesskey", "accesstoken",
  "consumersecret", "bearertoken", "webhooksecret", "privatekey"])

function isSecret(key: string) {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[_-]/g, ""))
}

// ─── Credential key-value editor ──────────────────────────────────────────────

type Pair = { key: string; value: string; secret: boolean }

function pairsToObj(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key, value } of pairs) if (key.trim() && value.trim()) out[key.trim()] = value
  return out
}

export function CredentialEditor({
  pairs,
  onChange,
}: {
  pairs: Pair[]
  onChange: (pairs: Pair[]) => void
}) {
  function update(i: number, field: keyof Pair, val: string | boolean) {
    const next = pairs.map((p, idx) => idx === i ? { ...p, [field]: val } : p)
    // Auto-detect secret on key change
    if (field === "key" && typeof val === "string") {
      next[i].secret = isSecret(val)
    }
    onChange(next)
  }

  const inputCls = "rounded-lg border px-2.5 py-1.5 text-[12px] w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
  const inputStyle = { borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-0.5 mb-0.5">
        {["Key", "Value"].map((h) => (
          <p key={h} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</p>
        ))}
        <span /><span />
      </div>

      {pairs.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
          <input
            value={p.key}
            placeholder="KEY"
            onChange={(e) => update(i, "key", e.target.value)}
            className={cn(inputCls, "font-mono")}
            style={inputStyle}
          />
          <input
            value={p.value}
            placeholder={p.secret ? "••••••••" : "value"}
            type={p.secret ? "password" : "text"}
            onChange={(e) => update(i, "value", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
          {/* Secret toggle */}
          <button
            type="button"
            title={p.secret ? "Plain text" : "Mark as secret"}
            onClick={() => update(i, "secret", !p.secret)}
            className="size-7 flex items-center justify-center rounded-lg text-[11px] transition-colors"
            style={{
              background: p.secret ? "#6366f115" : "var(--muted)",
              color: p.secret ? "#818cf8" : "var(--muted-foreground)",
              border: p.secret ? "1px solid #6366f130" : "1px solid transparent",
            }}
          >
            {p.secret ? "🔒" : "👁"}
          </button>
          {/* Remove row */}
          <button
            type="button"
            onClick={() => onChange(pairs.filter((_, idx) => idx !== i))}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...pairs, { key: "", value: "", secret: false }])}
        className="flex items-center gap-1 text-[11px] font-semibold hover:underline mt-1"
        style={{ color: "#6366f1" }}
      >
        <Plus className="size-3" /> Add field
      </button>
    </div>
  )
}

// ─── Create dialog ────────────────────────────────────────────────────────────

export function CreateConnectionDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("")
  const [customType, setCustomType] = useState("")
  const [pairs, setPairs] = useState<Pair[]>([{ key: "", value: "", secret: false }])
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; raw?: unknown } | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  function reset() {
    setName(""); setType(""); setCustomType("")
    setPairs([{ key: "", value: "", secret: false }])
    setShowTypePicker(false); setTestResult(null); setShowRaw(false)
  }

  function handleClose(o: boolean) { setOpen(o); if (!o) reset() }

  // Pick a known type — pre-fill key names from template (no values)
  function selectType(t: typeof CONNECTION_TYPES[number]) {
    setType(t.value)
    setCustomType("")
    setPairs(t.keys.map(({ key, secret, hint }) => ({
      key,
      value: "",
      secret: secret ?? isSecret(key),
    })))
    setShowTypePicker(false)
  }

  const effectiveType = type || customType.trim().toUpperCase().replace(/\s+/g, "_") || "CUSTOM"
  const displayLabel = CONNECTION_TYPES.find((t) => t.value === type)?.label ?? (customType || "— choose type —")

  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      const credentials = pairsToObj(pairs)
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "__test__", type: effectiveType, credentials }),
      })
      const tmp = await res.json()
      const testRes = await fetch(`/api/connections/${tmp.id}/test`, { method: "POST" })
      const result = await testRes.json()
      setTestResult(result)
      await fetch(`/api/connections/${tmp.id}`, { method: "DELETE" })
    } catch (err) {
      setTestResult({ ok: false, error: String(err) })
    } finally { setTesting(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: effectiveType, credentials: pairsToObj(pairs) }),
      })
      router.refresh()
      setOpen(false)
      reset()
    } finally { setSaving(false) }
  }

  const selectedTypeDef = CONNECTION_TYPES.find((t) => t.value === type)
  const noCredentials = !!selectedTypeDef && selectedTypeDef.keys.length === 0
  const canSave = name.trim() && (type || customType.trim()) && (noCredentials || pairs.some((p) => p.key.trim()))

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 focus:outline-none overflow-y-auto max-h-[90vh]"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                Add connection
              </Dialog.Title>
              <Dialog.Description className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Name it, pick a type, store the credentials
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
                placeholder="e.g. Softone Production, Mailgun EU"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTypePicker((v) => !v)}
                  className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition-colors"
                  style={{ borderColor: "var(--input)", background: "var(--background)", color: type ? "var(--foreground)" : "var(--muted-foreground)" }}
                >
                  {displayLabel}
                  <ChevronDown className={cn("size-4 transition-transform", showTypePicker && "rotate-180")} style={{ color: "var(--muted-foreground)" }} />
                </button>

                {showTypePicker && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border shadow-xl overflow-hidden"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                    <div className="max-h-64 overflow-y-auto p-2 space-y-3">
                      {GROUPS.map(([group, items]) => (
                        <div key={group}>
                          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: "var(--muted-foreground)" }}>{group}</p>
                          {items.map((t) => (
                            <button key={t.value} type="button" onClick={() => selectType(t)}
                              className={cn("w-full text-left rounded-lg px-3 py-2 text-[12px] font-medium transition-colors hover:bg-[var(--muted)]", type === t.value && "bg-indigo-500/10")}
                              style={{ color: type === t.value ? "#818cf8" : "var(--foreground)" }}>
                              {t.label}
                              <span className="ml-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                                {t.keys.map((k) => k.key).join(", ")}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {/* Custom type */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: "var(--muted-foreground)" }}>Custom</p>
                        <div className="px-2">
                          <input
                            value={customType}
                            onChange={(e) => { setCustomType(e.target.value); setType("") }}
                            onFocus={() => setType("")}
                            placeholder="Type your own (e.g. STRIPE, SENDGRID)"
                            className="w-full rounded-lg border px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
                          />
                        </div>
                      </div>
                    </div>
                    {(type || customType.trim()) && (
                      <div className="border-t p-2" style={{ borderColor: "var(--border)" }}>
                        <button type="button" onClick={() => setShowTypePicker(false)}
                          className="w-full text-center text-[11px] font-semibold py-1 rounded-lg hover:bg-[var(--muted)] transition-colors"
                          style={{ color: "#818cf8" }}>
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {type && (
                <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                  Template keys pre-filled — add or remove as needed
                </p>
              )}
            </div>

            {/* Credential key-value pairs */}
            {noCredentials ? (
              <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                This connection type requires no credentials.
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                  Credentials
                </label>
                <CredentialEditor pairs={pairs} onChange={setPairs} />
              </div>
            )}

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
              <Dialog.Close asChild>
                <Btn variant="ghost" size="md">Cancel</Btn>
              </Dialog.Close>
              <div className="flex gap-2">
                <Btn variant="secondary" size="md" onClick={handleTest} disabled={testing || !canSave}>
                  {testing ? <Loader2 className="size-3.5 animate-spin" /> : "Test"}
                </Btn>
                <Btn variant="primary" size="md" onClick={handleSave} disabled={saving || !canSave}>
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
