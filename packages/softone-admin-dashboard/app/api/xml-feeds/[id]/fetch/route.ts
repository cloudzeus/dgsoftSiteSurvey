import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { fetchXml, parseXmlFeed, diffSnapshots, type ParsedRecord } from "@/lib/xml-feed-parser"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params

  const feed = await db.xmlFeed.findUnique({ where: { id } })
  if (!feed) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Fetch & parse
  let parseResult: Awaited<ReturnType<typeof parseXmlFeed>> | null = null
  let errorMessage: string | null = null

  try {
    const xml = await fetchXml(feed.url)
    parseResult = parseXmlFeed(xml)
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  // Save snapshot
  const snapshot = await db.xmlFeedSnapshot.create({
    data: {
      feedId: id,
      status: errorMessage ? "ERROR" : "SUCCESS",
      errorMessage,
      recordCount: parseResult?.records.length ?? 0,
      parsedData: parseResult ? JSON.stringify(parseResult.records) : "[]",
    },
  })

  if (parseResult) {
    // Refresh fields
    await db.xmlFeedField.deleteMany({ where: { feedId: id } })
    if (parseResult.fields.length > 0) {
      await db.xmlFeedField.createMany({
        data: parseResult.fields.map((f) => ({
          feedId: id,
          path: f.path,
          label: f.label,
          dataType: f.dataType,
          isAttribute: f.isAttribute,
          frequency: f.frequency,
          sampleValue: f.sampleValue ?? null,
        })),
      })
    }

    // Diff against previous snapshot
    const prevSnapshot = await db.xmlFeedSnapshot.findFirst({
      where: { feedId: id, status: "SUCCESS", id: { not: snapshot.id } },
      orderBy: { fetchedAt: "desc" },
    })

    if (prevSnapshot) {
      const prevRecords: ParsedRecord[] = JSON.parse(prevSnapshot.parsedData ?? "[]")
      const diff = diffSnapshots(prevRecords, parseResult.records)
      const changes: {
        snapshotId: string
        previousSnapshotId: string
        changeType: string
        recordKey?: string
        fieldPath?: string
        oldValue?: string
        newValue?: string
      }[] = []

      for (const r of diff.added) {
        changes.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "RECORD_ADDED", recordKey: r._key })
      }
      for (const r of diff.removed) {
        changes.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "RECORD_REMOVED", recordKey: r._key })
      }
      for (const m of diff.modified) {
        const oldVal = m.oldValue != null ? String(m.oldValue).slice(0, 1000) : null
        const newVal = m.newValue != null ? String(m.newValue).slice(0, 1000) : null
        changes.push({
          snapshotId: snapshot.id,
          previousSnapshotId: prevSnapshot.id,
          changeType: "FIELD_MODIFIED",
          recordKey: m.key,
          fieldPath: m.fieldPath,
          ...(oldVal != null && { oldValue: oldVal }),
          ...(newVal != null && { newValue: newVal }),
        })
      }
      for (const f of diff.newFields) {
        changes.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "NEW_FIELD", fieldPath: f })
      }
      for (const f of diff.removedFields) {
        changes.push({ snapshotId: snapshot.id, previousSnapshotId: prevSnapshot.id, changeType: "REMOVED_FIELD", fieldPath: f })
      }

      if (changes.length > 0) {
        await db.xmlFeedChange.createMany({ data: changes })
      }
    }

    // Update lastFetchedAt
    await db.xmlFeed.update({ where: { id }, data: { lastFetchedAt: new Date() } })
  }

  return NextResponse.json({
    snapshotId: snapshot.id,
    status: snapshot.status,
    recordCount: snapshot.recordCount,
    errorMessage: snapshot.errorMessage,
    fields: parseResult?.fields.length ?? 0,
  })
}
