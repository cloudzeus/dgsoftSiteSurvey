import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

const PAGE_SIZE = 100

const IMAGE_FIELD_HINTS = /image|img|photo|picture|thumbnail|thumb|banner|cover|src|icon|logo/i
const IMAGE_URL_RE      = /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i

function extractImageUrls(path: string, value: unknown): string[] {
  if (Array.isArray(value)) {
    const urls = value.filter((v): v is string => typeof v === "string" && v.startsWith("http"))
    if (IMAGE_FIELD_HINTS.test(path) && urls.length > 0) return urls
    return urls.filter((u) => IMAGE_URL_RE.test(u))
  }
  if (typeof value !== "string" || !value.startsWith("http")) return []
  if (IMAGE_URL_RE.test(value)) return [value]
  if (IMAGE_FIELD_HINTS.test(path)) return [value]
  return []
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const url    = new URL(req.url)
  const cursor = url.searchParams.get("cursor") ?? undefined
  const snapshotId = url.searchParams.get("snapshotId") ?? undefined

  // Resolve snapshot
  const snapshot = snapshotId
    ? await db.xmlFeedSnapshot.findUnique({
        where: { id: snapshotId },
        select: { id: true, fetchedAt: true, recordCount: true },
      })
    : await db.xmlFeedSnapshot.findFirst({
        where: { feedId: id, status: "SUCCESS" },
        orderBy: { fetchedAt: "desc" },
        select: { id: true, fetchedAt: true, recordCount: true },
      })

  if (!snapshot) return NextResponse.json({ records: [], schema: [], hasMore: false, nextCursor: null, snapshot: null })

  // Field schema — the full ordered list of paths across the entire feed
  const feedFields = await db.xmlFeedField.findMany({
    where: { feedId: id },
    orderBy: { frequency: "desc" },
    select: { path: true, label: true },
  })

  // Mapping config
  const mapping = await db.xmlFeedEntityMapping.findUnique({
    where: { feedId: id },
    include: { fieldMaps: { select: { xmlFieldPath: true, canonicalField: true } } },
  })
  const pathToLabel = new Map<string, string>()
  if (mapping) {
    for (const fm of mapping.fieldMaps) pathToLabel.set(fm.xmlFieldPath, fm.canonicalField)
  }

  // Field exclusion filters — applied at query time so they take effect immediately
  const excludedFields = new Set(
    (await db.xmlFeedFilter.findMany({
      where: { feedId: id, type: "EXCLUDE_FIELD" },
      select: { field: true },
    })).map((f) => f.field),
  )

  // Build ordered column schema — skip excluded fields.
  // For the unmapped case, sort paths so indexed sub-fields are grouped
  // (serial format: images.image.1.url, images.image.2.url, etc.)
  const rawPaths = mapping
    ? mapping.fieldMaps.map((fm) => fm.xmlFieldPath)
    : feedFields.map((f) => f.path).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))

  const schemaPaths = rawPaths.filter((p) => !excludedFields.has(p))

  const labelFor = (path: string) =>
    pathToLabel.get(path) ?? feedFields.find((f) => f.path === path)?.label ?? path

  // Paginated record rows
  const rows = await db.xmlFeedRecord.findMany({
    where: { snapshotId: snapshot.id },
    orderBy: { id: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, recordKey: true, data: true },
  })

  const hasMore   = rows.length > PAGE_SIZE
  const page      = rows.slice(0, PAGE_SIZE)
  const nextCursor = hasMore ? page[page.length - 1].id : null

  // Map rows → client records using the schema
  const records = page.map((row) => {
    const raw = row.data as Record<string, unknown>
    const fields = schemaPaths.map((path) => {
      const value     = raw[path]
      const imageUrls = extractImageUrls(path, value)
      return {
        label: labelFor(path),
        path,
        value,
        isImage:    imageUrls.length > 0,
        imageUrls,
      }
    })
    return { _key: row.recordKey, fields }
  })

  return NextResponse.json({
    records,
    hasMore,
    nextCursor,
    snapshot: { id: snapshot.id, fetchedAt: snapshot.fetchedAt, recordCount: snapshot.recordCount },
    schema: schemaPaths.map((p) => ({ path: p, label: labelFor(p) })),
  })
}
