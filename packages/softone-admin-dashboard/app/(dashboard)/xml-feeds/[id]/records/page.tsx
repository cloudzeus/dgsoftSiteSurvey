import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { XmlFeedRecordsClient } from "@/components/xml-feeds/xml-feed-records-client"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const feed = await db.xmlFeed.findUnique({ where: { id }, select: { name: true } })
  return { title: feed ? `${feed.name} — Records` : "Feed Records" }
}

export default async function XmlFeedRecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const feed = await db.xmlFeed.findUnique({
    where: { id },
    select: { id: true, name: true, url: true, lastFetchedAt: true },
  })
  if (!feed) notFound()

  // Only fetch metadata — no parsedData. The client loads records async via API.
  const latestSnapshot = await db.xmlFeedSnapshot.findFirst({
    where: { feedId: id, status: "SUCCESS" },
    orderBy: { fetchedAt: "desc" },
    select: { id: true, fetchedAt: true, recordCount: true },
  })

  const mapping = await db.xmlFeedEntityMapping.findUnique({
    where: { feedId: id },
    include: {
      entity: { select: { id: true, name: true } },
      fieldMaps: { select: { xmlFieldPath: true, canonicalField: true } },
    },
  })

  return (
    <XmlFeedRecordsClient
      feed={feed as any}
      mapping={mapping as any}
      snapshot={latestSnapshot as any}
    />
  )
}
