"use client"

import { useState } from "react"
import { Save, RefreshCw, Code2, ChevronDown, ChevronUp } from "lucide-react"

interface Field {
  id: string
  name: string
  label: string | null
  dataType: string
  isPrimaryKey: boolean
}

interface Props {
  bindingId: string
  entityId: string
  bindingName: string
  objectName: string
  outboundMethod: string | null
  payloadTemplate: unknown
  fields: Field[]
  onSaved?: () => void
}

export function PayloadTemplateEditor({
  bindingId, entityId, bindingName, objectName,
  outboundMethod: initialMethod, payloadTemplate: initialTemplate,
  fields, onSaved,
}: Props) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState(initialMethod ?? "setData")
  const [template, setTemplate] = useState(
    initialTemplate ? JSON.stringify(initialTemplate, null, 2) : ""
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function insertPlaceholder(fieldName: string) {
    setTemplate((prev) => prev + `{{${fieldName}}}`)
  }

  function validateJson(text: string): boolean {
    if (!text.trim()) return true
    try { JSON.parse(text); return true } catch { return false }
  }

  async function save() {
    if (!validateJson(template)) {
      setError("Invalid JSON — check the template syntax")
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/entities/${entityId}/bindings/${bindingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outboundMethod: method || null,
          payloadTemplate: template.trim() ? JSON.parse(template) : null,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  function buildDefaultTemplate() {
    const obj: Record<string, string> = {}
    for (const f of fields) obj[f.name] = `{{${f.name}}}`
    const wrapper = {
      OBJECT: objectName,
      KEY: "",
      DATA: { [objectName]: [obj] },
    }
    setTemplate(JSON.stringify(wrapper, null, 2))
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--muted)]/20"
        style={{ background: "var(--card)" }}
      >
        <div className="flex items-center gap-2.5">
          <Code2 className="size-3.5" style={{ color: "#6366f1" }} />
          <div>
            <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
              {bindingName || objectName}
            </p>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              {initialTemplate ? "Template configured" : "No template — using field mappings"} · {method || "setData"}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="size-4" style={{ color: "var(--muted-foreground)" }} />
               : <ChevronDown className="size-4" style={{ color: "var(--muted-foreground)" }} />}
      </button>

      {open && (
        <div className="p-4 space-y-4" style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
          {/* Method */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
              style={{ color: "var(--muted-foreground)" }}>Method</label>
            <input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="setData"
              className="flex-1 text-[12px] px-3 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--input)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>

          {/* Fields reference */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--muted-foreground)" }}>Available fields — click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => insertPlaceholder(f.name)}
                  title={f.label ?? f.name}
                  className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors hover:bg-indigo-500/20"
                  style={{
                    background: "var(--muted)",
                    color: f.isPrimaryKey ? "#6366f1" : "var(--muted-foreground)",
                    border: "1px solid var(--border)",
                  }}>
                  {`{{${f.name}}}`}{f.isPrimaryKey ? " 🔑" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Template textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}>Payload template (JSON)</p>
              <button
                onClick={buildDefaultTemplate}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded hover:bg-[var(--muted)]"
                style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                <RefreshCw className="size-2.5" />
                Auto-build
              </button>
            </div>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              spellCheck={false}
              rows={14}
              placeholder={`{\n  "OBJECT": "${objectName}",\n  "KEY": "",\n  "DATA": { "${objectName}": [{ "field": "{{canonical_field}}" }] }\n}`}
              className="w-full text-[11px] font-mono px-3 py-2.5 rounded-lg outline-none resize-y"
              style={{
                background: "var(--input)",
                border: `1px solid ${error ? "#dc2626" : "var(--border)"}`,
                color: "var(--foreground)",
                lineHeight: "1.6",
              }}
            />
            {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
            {!template.trim() && (
              <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                Leave empty to use field-mapping mode instead of a template.
              </p>
            )}
          </div>

          {/* Save */}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: saved ? "#16a34a" : "#6366f1", color: "#fff" }}>
            <Save className="size-3.5" />
            {saving ? "Saving…" : saved ? "Saved!" : "Save template"}
          </button>
        </div>
      )}
    </div>
  )
}
