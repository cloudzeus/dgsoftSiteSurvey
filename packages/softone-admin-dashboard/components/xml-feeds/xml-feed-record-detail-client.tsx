"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft, ExternalLink, Hash, Calendar, ToggleLeft,
  ImageOff, ChevronDown, ChevronUp, Copy, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Feed     { id: string; name: string }
interface FieldMap   { xmlFieldPath: string; canonicalField: string }
interface MappingObj {
  entity: { id: string; name: string }
  fieldMaps: FieldMap[]
  keyFieldPath: string | null
}
type Mapping = MappingObj | null
interface FeedField  { path: string; label: string; dataType: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IMAGE_URL_RE      = /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i
const IMAGE_FIELD_HINTS = /image|img|photo|picture|thumbnail|thumb|banner|cover|icon|logo/i

function looksLikeImage(path: string, value: unknown): boolean {
  if (typeof value !== "string" || !value.startsWith("http")) return false
  return IMAGE_URL_RE.test(value) || IMAGE_FIELD_HINTS.test(path)
}

function looksLikeUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\//.test(value)
}

function inferDataType(value: unknown): "image" | "url" | "number" | "boolean" | "date" | "text" | "empty" {
  if (value == null || value === "") return "empty"
  if (looksLikeImage("", value)) return "image"
  if (looksLikeUrl(value)) return "url"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date"
    if (!isNaN(Number(value)) && value.trim() !== "") return "number"
  }
  return "text"
}

// ─── FieldValue renderer ─────────────────────────────────────────────────────

function FieldValueDisplay({ path, value }: { path: string; value: unknown }) {
  const [imgErr, setImgErr] = useState(false)
  const [copied, setCopied] = useState(false)
  const type = looksLikeImage(path, value) ? "image" : inferDataType(value)

  function copy(str: string) {
    navigator.clipboard.writeText(str).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (type === "empty") {
    return <span className="text-sm italic" style={{ color: "var(--muted-foreground)" }}>—</span>
  }

  if (type === "image") {
    const src = String(value)
    return imgErr ? (
      <div className="rounded-lg flex items-center justify-center h-32 w-full"
        style={{ background: "var(--muted)" }}>
        <ImageOff className="size-5" style={{ color: "var(--muted-foreground)" }} />
      </div>
    ) : (
      <a href={src} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" onError={() => setImgErr(true)}
          className="rounded-lg max-h-64 max-w-full object-contain"
          style={{ border: "1px solid var(--border)" }} />
      </a>
    )
  }

  if (type === "url") {
    const str = String(value)
    return (
      <div className="flex items-center gap-2 group">
        <a href={str} target="_blank" rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:underline break-all flex items-center gap-1">
          <span className="line-clamp-2">{str}</span>
          <ExternalLink className="size-3 flex-shrink-0" />
        </a>
        <button onClick={() => copy(str)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded"
          style={{ color: "var(--muted-foreground)" }}>
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
        </button>
      </div>
    )
  }

  if (type === "boolean") {
    const bool = value === true || value === "true" || value === "1"
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        bool ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
      )}>
        <ToggleLeft className="size-3" />
        {bool ? "true" : "false"}
      </span>
    )
  }

  if (type === "date") {
    return (
      <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--foreground)" }}>
        <Calendar className="size-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
        {String(value)}
      </span>
    )
  }

  if (type === "number") {
    return (
      <span className="flex items-center gap-1 text-sm font-mono" style={{ color: "var(--foreground)" }}>
        <Hash className="size-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
        {String(value)}
      </span>
    )
  }

  // text
  const str    = String(value)
  const isLong = str.length > 200
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words"
      style={{ color: "var(--foreground)" }}>
      {isLong ? `${str.slice(0, 200)}…` : str}
    </p>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: "var(--muted)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted-foreground)" }}>{title}</span>
        {open
          ? <ChevronUp className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
          : <ChevronDown className="size-3.5" style={{ color: "var(--muted-foreground)" }} />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function XmlFeedRecordDetailClient({
  feed,
  mapping,
  record,
  feedFields,
  snapshotFetchedAt,
}: {
  feed: Feed
  mapping: Mapping
  record: Record<string, unknown>
  feedFields: FeedField[]
  snapshotFetchedAt: string
}) {
  const [rawOpen, setRawOpen] = useState(false)

  const pathToLabel = new Map<string, string>()
  if (mapping) {
    for (const fm of mapping.fieldMaps) pathToLabel.set(fm.xmlFieldPath, fm.canonicalField)
  }
  const fieldMetaMap = new Map(feedFields.map((f) => [f.path, f]))

  // Partition fields into categories for layout
  const allPaths = Object.keys(record).filter((k) => k !== "_key")

  const images   = allPaths.filter((p) => looksLikeImage(p, record[p]))
  const urlPaths = allPaths.filter((p) => !images.includes(p) && looksLikeUrl(record[p]))
  const dataPaths = allPaths.filter((p) => !images.includes(p) && !urlPaths.includes(p))

  // Hero image — first image field
  const heroPath = images[0]

  // Title field
  const titlePath = dataPaths.find((p) => {
    const label = pathToLabel.get(p) ?? fieldMetaMap.get(p)?.label ?? p
    return /name|title|label|subject|heading/i.test(label)
  })

  function labelFor(path: string) {
    return pathToLabel.get(path) ?? fieldMetaMap.get(path)?.label ?? path
  }

  function renderField(path: string) {
    return (
      <div key={path}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
          style={{ color: "var(--muted-foreground)" }}>
          {labelFor(path)}
        </p>
        <FieldValueDisplay path={path} value={record[path]} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto">

      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/xml-feeds/${feed.id}/records`}
            className="flex items-center gap-1 text-xs hover:underline"
            style={{ color: "var(--muted-foreground)" }}>
            <ArrowLeft className="size-3.5" /> Records
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
              {titlePath ? String(record[titlePath] ?? record._key) : String(record._key)}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {mapping && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Entity: <span className="font-medium" style={{ color: "var(--foreground)" }}>
                    {mapping.entity.name}
                  </span>
                </span>
              )}
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Snapshot: {format(new Date(snapshotFetchedAt), "dd MMM yyyy HH:mm")}
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                key: {String(record._key)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 space-y-5">

        {/* Hero image */}
        {heroPath && (
          <div className="rounded-xl overflow-hidden border"
            style={{ borderColor: "var(--border)", maxHeight: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={String(record[heroPath])} alt=""
              className="w-full object-cover max-h-[400px]" />
          </div>
        )}

        {/* Two-column layout for data fields */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Main data fields (2/3) */}
          <div className="lg:col-span-2 space-y-5">
            {dataPaths.length > 0 && (
              <Section title="Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {dataPaths.map((p) => renderField(p))}
                </div>
              </Section>
            )}

            {/* URLs */}
            {urlPaths.length > 0 && (
              <Section title="Links">
                <div className="space-y-3">
                  {urlPaths.map((p) => renderField(p))}
                </div>
              </Section>
            )}
          </div>

          {/* Side column — additional images */}
          {images.length > 1 && (
            <div className="space-y-5">
              <Section title="Images">
                <div className="space-y-3">
                  {images.slice(1).map((p) => (
                    <div key={p}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                        style={{ color: "var(--muted-foreground)" }}>
                        {labelFor(p)}
                      </p>
                      <FieldValueDisplay path={p} value={record[p]} />
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>

        {/* Raw data collapsible */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setRawOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            style={{ background: "var(--muted)" }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}>Raw XML data</span>
            {rawOpen
              ? <ChevronUp className="size-3.5"  style={{ color: "var(--muted-foreground)" }} />
              : <ChevronDown className="size-3.5" style={{ color: "var(--muted-foreground)" }} />}
          </button>
          {rawOpen && (
            <pre className="p-4 text-xs overflow-auto max-h-96 leading-relaxed"
              style={{ color: "var(--muted-foreground)", background: "var(--card)" }}>
              {JSON.stringify(record, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
