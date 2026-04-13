import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { assertApiAccess } from "@/lib/permissions"
import { fetchXml, parseXmlFeed, diffSnapshots, type ParsedRecord } from "@/lib/xml-feed-parser"
import { applyFilters, type FeedFilter } from "@/lib/xml-feed-filters"

// ─── SSE helper ───────────────────────────────────────────────────────────────

export type FetchEvent =
  | { step: "connecting";  status: "running";  message: string }
  | { step: "downloading"; status: "running" | "done"; message: string; bytes?: number }
  | { step: "parsing";     status: "running" | "done"; message: string; records?: number; rootTag?: string }
  | { step: "fields";      status: "running" | "done"; message: string; count?: number }
  | { step: "comparing";   status: "running" | "done" | "skipped"; message: string; added?: number; removed?: number; modified?: number; newFields?: number }
  | { step: "saving";      status: "running" | "done"; message: string }
  | { step: "done";        records: number; fields: number; changes: number; snapshotId: string }
  | { step: "error";       message: string }

function encode(event: FetchEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

const BATCH = 500 // rows per createMany call

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params

  const feed = await db.xmlFeed.findUnique({ where: { id } })
  if (!feed) {
    return new Response(`data: ${JSON.stringify({ step: "error", message: "Feed not found" })}\n\n`, {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    })
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const enc    = new TextEncoder()

  function send(event: FetchEvent) {
    writer.write(enc.encode(encode(event))).catch(() => {})
  }

  ;(async () => {
    try {
      // ── Step 1: Download ──────────────────────────────────────────────────
      send({ step: "connecting", status: "running", message: `Connecting to ${feed.url}` })

      let rawXml = ""
      let xmlBytes = 0
      try {
        send({ step: "downloading", status: "running", message: "Downloading XML…" })
        rawXml   = await fetchXml(feed.url)
        xmlBytes = new TextEncoder().encode(rawXml).length
        send({ step: "downloading", status: "done", message: `Downloaded ${(xmlBytes / 1024).toFixed(1)} KB`, bytes: xmlBytes })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ step: "error", message: `Download failed: ${msg}` })
        await db.xmlFeedSnapshot.create({ data: { feedId: id, status: "ERROR", errorMessage: msg, recordCount: 0 } })
        return
      }

      // ── Step 2: Parse ─────────────────────────────────────────────────────
      send({ step: "parsing", status: "running", message: "Parsing XML structure…" })
      let parseResult: ReturnType<typeof parseXmlFeed>
      try {
        parseResult = parseXmlFeed(rawXml)
        send({
          step: "parsing", status: "done",
          message: `Found ${parseResult.records.length} records in <${parseResult.rootTag}>`,
          records: parseResult.records.length,
          rootTag: parseResult.rootTag,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ step: "error", message: `Parse failed: ${msg}` })
        await db.xmlFeedSnapshot.create({ data: { feedId: id, status: "ERROR", errorMessage: msg, recordCount: 0 } })
        return
      }

      // ── Step 3: Apply filters ─────────────────────────────────────────────
      const dbFilters = await db.xmlFeedFilter.findMany({ where: { feedId: id } })
      let finalRecords = parseResult.records

      if (dbFilters.length > 0) {
        const result = applyFilters(parseResult.records, dbFilters as FeedFilter[])
        finalRecords = result.records
        const parts: string[] = []
        if (result.excludedRecords > 0)       parts.push(`${result.excludedRecords} records excluded`)
        if (result.excludedFields.length > 0) parts.push(`${result.excludedFields.length} fields stripped`)
        if (parts.length > 0) {
          send({ step: "fields", status: "running", message: `Filters applied — ${parts.join(", ")}` })
        }
      }

      // ── Step 4: Field detection ───────────────────────────────────────────
      send({ step: "fields", status: "running", message: "Detecting field schema…" })
      await new Promise((r) => setTimeout(r, 0))
      send({ step: "fields", status: "done", message: `${parseResult.fields.length} unique fields detected`, count: parseResult.fields.length })

      // ── Step 5: Save ──────────────────────────────────────────────────────
      send({ step: "saving", status: "running", message: "Saving to database…" })

      // Create snapshot header
      const snapshot = await db.xmlFeedSnapshot.create({
        data: { feedId: id, status: "SUCCESS", recordCount: finalRecords.length },
      })

      // Batch-insert records as individual rows (500 per call)
      const rowData = finalRecords.map(({ _key, ...rest }) => ({
        feedId: id,
        snapshotId: snapshot.id,
        recordKey: _key,
        data: rest as Prisma.InputJsonValue,
      }))
      for (let i = 0; i < rowData.length; i += BATCH) {
        await db.xmlFeedRecord.createMany({ data: rowData.slice(i, i + BATCH) })
      }

      // Refresh field schema
      await db.xmlFeedField.deleteMany({ where: { feedId: id } })
      if (parseResult.fields.length > 0) {
        await db.xmlFeedField.createMany({
          data: parseResult.fields.map((f) => ({
            feedId: id, path: f.path, label: f.label, dataType: f.dataType,
            isAttribute: f.isAttribute, frequency: f.frequency, sampleValue: f.sampleValue ?? null,
          })),
        })
      }

      // ── Step 5: Diff ──────────────────────────────────────────────────────
      const prevSnapshot = await db.xmlFeedSnapshot.findFirst({
        where: { feedId: id, status: "SUCCESS", id: { not: snapshot.id } },
        orderBy: { fetchedAt: "desc" },
        select: { id: true, parsedData: true },
      })

      let totalChanges = 0

      if (!prevSnapshot) {
        send({ step: "comparing", status: "skipped", message: "First snapshot — nothing to compare" })
      } else {
        send({ step: "comparing", status: "running", message: "Comparing with previous snapshot…" })

        // Read prev records from rows (new path) or legacy blob fallback
        let prevRecords: ParsedRecord[]
        const prevRows = await db.xmlFeedRecord.findMany({
          where: { snapshotId: prevSnapshot.id },
          select: { recordKey: true, data: true },
        })
        if (prevRows.length > 0) {
          prevRecords = prevRows.map((r) => ({
            _key: r.recordKey,
            ...(r.data as Record<string, unknown>),
          }))
        } else if (prevSnapshot.parsedData) {
          prevRecords = JSON.parse(prevSnapshot.parsedData)
        } else {
          prevRecords = []
        }

        const diff = diffSnapshots(prevRecords, finalRecords)

        const changeRows: {
          snapshotId: string; previousSnapshotId: string; changeType: string
          recordKey?: string; fieldPath?: string; oldValue?: string; newValue?: string
        }[] = []

        for (const r of diff.added)
          changeRows.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "RECORD_ADDED", recordKey: r._key })
        for (const r of diff.removed)
          changeRows.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "RECORD_REMOVED", recordKey: r._key })
        for (const m of diff.modified)
          changeRows.push({
            snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id,
            changeType: "FIELD_MODIFIED", recordKey: m.key, fieldPath: m.fieldPath,
            ...(m.oldValue != null && { oldValue: String(m.oldValue).slice(0, 1000) }),
            ...(m.newValue != null && { newValue: String(m.newValue).slice(0, 1000) }),
          })
        for (const f of diff.newFields)
          changeRows.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "NEW_FIELD", fieldPath: f })
        for (const f of diff.removedFields)
          changeRows.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "REMOVED_FIELD", fieldPath: f })

        if (changeRows.length > 0) await db.xmlFeedChange.createMany({ data: changeRows })
        totalChanges = changeRows.length

        send({
          step: "comparing", status: "done",
          message: totalChanges === 0
            ? "No changes detected"
            : `${diff.added.length} added, ${diff.removed.length} removed, ${diff.modified.length} modified`,
          added: diff.added.length, removed: diff.removed.length,
          modified: diff.modified.length, newFields: diff.newFields.length,
        })
      }

      await db.xmlFeed.update({ where: { id }, data: { lastFetchedAt: new Date() } })
      send({ step: "saving", status: "done", message: "All data saved successfully" })
      send({ step: "done", records: finalRecords.length, fields: parseResult.fields.length, changes: totalChanges, snapshotId: snapshot.id })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      send({ step: "error", message: msg })
    } finally {
      writer.close().catch(() => {})
    }
  })()

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
