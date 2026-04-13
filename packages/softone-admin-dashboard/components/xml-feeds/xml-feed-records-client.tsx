"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow, format } from "date-fns"
import {
  ArrowLeft, Search, X, ImageOff, ExternalLink,
  GitMerge, AlertTriangle, LayoutGrid, List, Table2, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Feed { id: string; name: string; url: string; lastFetchedAt: string | null }

interface MappingObj {
  entityId: string
  entity: { id: string; name: string }
  fieldMaps: { xmlFieldPath: string; canonicalField: string }[]
  keyFieldPath: string | null
}
type Mapping = MappingObj | null

interface SnapshotMeta {
  id: string
  fetchedAt: string
  recordCount: number
}
type Snapshot = SnapshotMeta | null

interface FieldValue {
  label: string
  path: string
  value: unknown
  isImage: boolean
  imageUrls: string[]
}

interface MappedRecord {
  _key: string
  fields: FieldValue[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IMAGE_URL_RE      = /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i
const IMAGE_FIELD_HINTS = /image|img|photo|picture|thumbnail|thumb|banner|cover|icon|logo/i

function looksLikeUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\//.test(value)
}

function isPlainText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && !looksLikeUrl(value)
}

function isImageUrl(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("http") && IMAGE_URL_RE.test(value)
}

// ─── Image avatars ────────────────────────────────────────────────────────────

function ImageAvatars({ urls, size = 32 }: { urls: string[]; size?: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {urls.slice(0, 4).map((url, i) => <ImgAvatar key={i} src={url} size={size} />)}
      {urls.length > 4 && (
        <span className="text-[10px] px-1 rounded"
          style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
          +{urls.length - 4}
        </span>
      )}
    </div>
  )
}

function ImgAvatar({ src, size }: { src: string; size: number }) {
  const [err, setErr] = useState(false)
  if (err) return (
    <div className="rounded flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: "var(--muted)", border: "1px solid var(--border)" }}>
      <ImageOff className="size-3" style={{ color: "var(--muted-foreground)" }} />
    </div>
  )
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" onError={() => setErr(true)} className="rounded object-cover flex-shrink-0"
    style={{ width: size, height: size, border: "1px solid var(--border)" }} />
}

// ─── Grid card ───────────────────────────────────────────────────────────────

function RecordCard({ record, feedId }: { record: MappedRecord; feedId: string }) {
  const imageField = record.fields.find((f) => f.isImage)
  const titleField = record.fields.find((f) =>
    /name|title|label|subject|heading/i.test(f.label) && !f.isImage && isPlainText(f.value)
  ) ?? record.fields.find((f) => !f.isImage && isPlainText(f.value))
  const descField = record.fields.find((f) =>
    /desc|body|text|summary|content|about/i.test(f.label) &&
    !f.isImage && f !== titleField && isPlainText(f.value) && String(f.value).length > 10
  )
  const priceField = record.fields.find((f) => /price|cost|amount|value/i.test(f.label) && !f.isImage)
  const extraFields = record.fields
    .filter((f) => f !== imageField && f !== titleField && f !== descField && f !== priceField && !f.isImage && isPlainText(f.value))
    .slice(0, 3)
  const heroUrl = imageField?.imageUrls[0]

  return (
    <Link href={`/xml-feeds/${feedId}/records/${encodeURIComponent(record._key)}`}
      className="rounded-xl border overflow-hidden flex flex-col transition-all hover:shadow-md"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      {heroUrl ? (
        <div className="w-full aspect-video overflow-hidden relative" style={{ background: "var(--muted)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroUrl} alt="" className="w-full h-full object-cover" />
          {imageField && imageField.imageUrls.length > 1 && (
            <span className="absolute bottom-1 right-1 text-[10px] rounded px-1.5 py-0.5 font-medium"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
              +{imageField.imageUrls.length - 1}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video flex items-center justify-center" style={{ background: "var(--muted)" }}>
          <ImageOff className="size-6" style={{ color: "var(--muted-foreground)", opacity: 0.3 }} />
        </div>
      )}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="font-medium text-sm line-clamp-2 leading-snug" style={{ color: "var(--foreground)" }}>
          {titleField ? String(titleField.value ?? "—") : record._key}
        </p>
        {priceField && priceField.value != null && (
          <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{String(priceField.value)}</p>
        )}
        {descField && descField.value != null && (
          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {String(descField.value)}
          </p>
        )}
        {extraFields.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            {extraFields.map((f) => f.value != null ? (
              <span key={f.path} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                <span className="opacity-60">{f.label}:</span>
                <span className="font-medium truncate max-w-[80px]">{String(f.value)}</span>
              </span>
            ) : null)}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Data table ───────────────────────────────────────────────────────────────

function RecordsTable({ records, feedId }: { records: MappedRecord[]; feedId: string }) {
  const router = useRouter()
  const columns = useMemo(() => records[0]?.fields ?? [], [records])
  if (records.length === 0) return null

  return (
    <div className="overflow-auto flex-1">
      <table className="min-w-full border-collapse text-sm" style={{ tableLayout: "auto" }}>
        <thead style={{ background: "var(--muted)" }} className="sticky top-0 z-10">
          <tr>
            {/* # — serial row number */}
            <th className="text-center text-[11px] font-semibold uppercase tracking-wide px-2 py-2.5 whitespace-nowrap sticky left-0 z-20 select-none"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)", borderRight: "1px solid var(--border)", minWidth: 40 }}>
              #
            </th>
            {columns.map((col) => (
              <th key={col.path} className="text-left text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 whitespace-nowrap"
                style={{ color: "var(--muted-foreground)" }}
                title={col.path}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, rowIdx) => (
            <tr key={r._key} className="border-b cursor-pointer transition-colors hover:bg-[var(--muted)]"
              style={{ borderColor: "var(--border)" }}
              onClick={() => router.push(`/xml-feeds/${feedId}/records/${encodeURIComponent(r._key)}`)}>
              {/* Serial number — sticky left */}
              <td className="px-2 py-2 text-center text-xs font-mono tabular-nums sticky left-0 select-none"
                style={{ color: "var(--muted-foreground)", background: "var(--card)", borderRight: "1px solid var(--border)", opacity: 0.45, minWidth: 40 }}>
                {rowIdx + 1}
              </td>
              {r.fields.map((f) => (
                <td key={f.path} className="px-3 py-2 align-middle">
                  {f.isImage || isImageUrl(f.value) ? (
                    <ImageAvatars urls={f.isImage ? f.imageUrls : [String(f.value)]} size={36} />
                  ) : f.value == null || f.value === "" ? (
                    <span style={{ color: "var(--muted-foreground)", opacity: 0.3 }}>—</span>
                  ) : Array.isArray(f.value) ? (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                      {(f.value as unknown[]).length} items
                    </span>
                  ) : looksLikeUrl(f.value) ? (
                    <a href={String(f.value)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:underline text-xs"
                      onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="size-3 flex-shrink-0" />
                      <span className="truncate max-w-[140px]">{String(f.value)}</span>
                    </a>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--foreground)", maxWidth: 200, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {String(f.value).slice(0, 120)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── List row ─────────────────────────────────────────────────────────────────

function RecordRow({ record, feedId }: { record: MappedRecord; feedId: string }) {
  const imageField = record.fields.find((f) => f.isImage)
  const titleField = record.fields.find((f) =>
    /name|title|label|subject/i.test(f.label) && !f.isImage && isPlainText(f.value)
  ) ?? record.fields.find((f) => !f.isImage && isPlainText(f.value))
  const visibleFields = record.fields
    .filter((f) => !f.isImage && f !== titleField && isPlainText(f.value))
    .slice(0, 5)

  return (
    <Link href={`/xml-feeds/${feedId}/records/${encodeURIComponent(record._key)}`}
      className="flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-[var(--muted)]"
      style={{ borderColor: "var(--border)" }}>
      {imageField
        ? <ImageAvatars urls={imageField.imageUrls} size={44} />
        : (
          <div className="w-11 h-11 rounded flex-shrink-0 flex items-center justify-center"
            style={{ background: "var(--muted)" }}>
            <ImageOff className="size-4" style={{ color: "var(--muted-foreground)", opacity: 0.3 }} />
          </div>
        )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" style={{ color: "var(--foreground)" }}>
          {titleField ? String(titleField.value ?? "—") : record._key}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {visibleFields.map((f) => f.value != null && (
            <span key={f.path} className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span className="opacity-60">{f.label}: </span>
              <span className="font-medium">{String(f.value).slice(0, 60)}</span>
            </span>
          ))}
        </div>
      </div>
      <ExternalLink className="size-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
    </Link>
  )
}

// ─── Relative time (client-only to avoid hydration mismatch) ─────────────────

function RelativeTime({ date }: { date: string }) {
  const [label, setLabel] = useState<string>(() => format(new Date(date), "dd MMM yyyy HH:mm"))
  useEffect(() => {
    setLabel(formatDistanceToNow(new Date(date), { addSuffix: true }))
  }, [date])
  return <>{label}</>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function XmlFeedRecordsClient({
  feed,
  mapping,
  snapshot,
}: {
  feed: Feed
  mapping: Mapping
  snapshot: Snapshot
}) {
  const [search,      setSearch]      = useState("")
  const [viewMode,    setViewMode]    = useState<"grid" | "list" | "table">("table")
  const [records,     setRecords]     = useState<MappedRecord[]>([])
  const [status,      setStatus]      = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const [nextCursor,  setNextCursor]  = useState<string | null>(null)
  const [hasMore,     setHasMore]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  async function loadPage(cursor?: string) {
    const qs  = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
    const res = await fetch(`/api/xml-feeds/${feed.id}/records${qs}`)
    if (!res.ok) throw new Error(String(res.status))
    return res.json() as Promise<{ records: MappedRecord[]; hasMore: boolean; nextCursor: string | null }>
  }

  // Initial load — page renders immediately, records arrive async
  useEffect(() => {
    if (!snapshot) return
    setStatus("loading")
    loadPage()
      .then((data) => {
        setRecords(data.records ?? [])
        setHasMore(data.hasMore)
        setNextCursor(data.nextCursor)
        setStatus("loaded")
      })
      .catch(() => setStatus("error"))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.id, snapshot?.id])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await loadPage(nextCursor)
      setRecords((prev) => [...prev, ...(data.records ?? [])])
      setHasMore(data.hasMore)
      setNextCursor(data.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return records
    const q = search.toLowerCase()
    return records.filter((r) =>
      r._key.toLowerCase().includes(q) ||
      r.fields.some((f) => String(f.value ?? "").toLowerCase().includes(q))
    )
  }, [records, search])

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/xml-feeds/${feed.id}`} className="flex items-center gap-1 text-xs hover:underline"
            style={{ color: "var(--muted-foreground)" }}>
            <ArrowLeft className="size-3.5" /> {feed.name}
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Records</h1>
            <div className="flex items-center gap-3 mt-0.5">
              {mapping && (
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <GitMerge className="size-3" style={{ color: "#818cf8" }} />
                  Mapped to <span className="font-medium" style={{ color: "var(--foreground)" }}>{mapping.entity.name}</span>
                </span>
              )}
              {snapshot && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {snapshot.recordCount} records · fetched <RelativeTime date={snapshot.fetchedAt} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* No snapshot */}
      {!snapshot && (
        <div className="m-6 px-4 py-3 rounded-xl border flex items-start gap-3"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <AlertTriangle className="size-4 mt-0.5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>No data yet</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Go back to the feed and click "Fetch now" to load the first snapshot.
            </p>
          </div>
        </div>
      )}

      {/* No mapping notice */}
      {snapshot && !mapping && status === "loaded" && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl border flex items-start gap-3"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <GitMerge className="size-4 mt-0.5 flex-shrink-0" style={{ color: "#818cf8" }} />
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            No entity mapping configured — showing all raw fields.
          </p>
        </div>
      )}

      {snapshot && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0"
            style={{ borderColor: "var(--border)" }}>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
                style={{ color: "var(--muted-foreground)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records…"
                className="pl-8 pr-8 py-1.5 text-sm rounded-md border w-full bg-transparent outline-none focus:ring-1"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }} />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="size-3" style={{ color: "var(--muted-foreground)" }} />
                </button>
              )}
            </div>
            {status === "loaded" && (
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {search ? `${filtered.length} of ` : ""}{records.length}{hasMore ? `+` : ""} records
                {hasMore && !search && <span className="opacity-60"> · scroll for more</span>}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5"
              style={{ borderColor: "var(--border)" }}>
              {(["table", "grid", "list"] as const).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={cn("p-1.5 rounded", viewMode === mode && "bg-[var(--muted)]")}
                  style={{ color: "var(--muted-foreground)" }} title={`${mode} view`}>
                  {mode === "table" ? <Table2 className="size-3.5" />
                    : mode === "grid" ? <LayoutGrid className="size-3.5" />
                    : <List className="size-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto flex flex-col">
            {status === "loading" && (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 py-20">
                <Loader2 className="size-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading records…</p>
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center justify-center flex-1 py-20">
                <p className="text-sm text-red-400">Failed to load records. Try refreshing the page.</p>
              </div>
            )}
            {status === "loaded" && filtered.length === 0 && (
              <div className="text-center py-20 text-sm" style={{ color: "var(--muted-foreground)" }}>
                {search ? "No records match your search" : "No records found"}
              </div>
            )}
            {status === "loaded" && filtered.length > 0 && (
              <>
                {viewMode === "table" ? (
                  <RecordsTable records={filtered} feedId={feed.id} />
                ) : viewMode === "grid" ? (
                  <div className="p-4 grid gap-4"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                    {filtered.map((r) => <RecordCard key={r._key} record={r} feedId={feed.id} />)}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {filtered.map((r) => <RecordRow key={r._key} record={r} feedId={feed.id} />)}
                  </div>
                )}
                {/* Load more */}
                {hasMore && !search && (
                  <div className="flex justify-center py-6 flex-shrink-0">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                      {loadingMore
                        ? <><Loader2 className="size-3.5 animate-spin" /> Loading…</>
                        : <>Load more records</>}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
