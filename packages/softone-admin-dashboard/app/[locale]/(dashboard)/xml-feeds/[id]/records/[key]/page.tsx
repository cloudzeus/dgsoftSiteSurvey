import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { XmlFeedRecordDetailClient } from "@/components/xml-feeds/xml-feed-record-detail-client"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params
  const feed = await db.xmlFeed.findUnique({ where: { id }, select: { name: true } })
  return { title: feed ? `${decodeURIComponent(key)} — ${feed.name}` : "Record" }
}

export default async function XmlFeedRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string; key: string }>
}) {
  const { id, key } = await params
  const recordKey = decodeURIComponent(key)

  const [feed, mapping, feedFields] = await Promise.all([
    db.xmlFeed.findUnique({ where: { id }, select: { id: true, name: true } }),
    db.xmlFeedEntityMapping.findUnique({
      where: { feedId: id },
      include: { entity: { select: { id: true, name: true } }, fieldMaps: true },
    }),
    db.xmlFeedField.findMany({
      where: { feedId: id },
      select: { path: true, label: true, dataType: true, sampleValue: true },
    }),
  ])
  if (!feed) notFound()

  // Get the latest version of this record from XmlFeedRecord rows
  const row = await db.xmlFeedRecord.findFirst({
    where: { feedId: id, recordKey },
    orderBy: { createdAt: "desc" },
    include: { snapshot: { select: { fetchedAt: true } } },
  })

  // Fallback: old snapshots stored data as parsedData blob
  if (!row) {
    const snapshot = await db.xmlFeedSnapshot.findFirst({
      where: { feedId: id, status: "SUCCESS" },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true, parsedData: true },
    })
    if (!snapshot?.parsedData) notFound()
    const allRecords: Record<string, unknown>[] = JSON.parse(snapshot.parsedData)
    const record = allRecords.find((r) => String(r._key) === recordKey)
    if (!record) notFound()
    return (
      <XmlFeedRecordDetailClient
        feed={feed as any}
        mapping={mapping as any}
        record={record as any}
        feedFields={feedFields as any}
        snapshotFetchedAt={snapshot.fetchedAt.toISOString()}
      />
    )
  }

  const record = { _key: row.recordKey, ...(row.data as Record<string, unknown>) }

  return (
    <XmlFeedRecordDetailClient
      feed={feed as any}
      mapping={mapping as any}
      record={record as any}
      feedFields={feedFields as any}
      snapshotFetchedAt={row.snapshot.fetchedAt.toISOString()}
    />
  )
}
