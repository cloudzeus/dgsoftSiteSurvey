import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { checkRole } from "@/lib/permissions"
import { XmlFeedDetailClient } from "@/components/xml-feeds/xml-feed-detail-client"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const feed = await db.xmlFeed.findUnique({ where: { id }, select: { name: true } })
  return { title: feed ? `${feed.name} — XML Feed` : "XML Feed" }
}

export default async function XmlFeedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [feed, isOperator] = await Promise.all([
    db.xmlFeed.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { frequency: "desc" } },
        _count: { select: { snapshots: true } },
      },
    }),
    checkRole("OPERATOR"),
  ])

  if (!feed) notFound()

  const snapshots = await db.xmlFeedSnapshot.findMany({
    where: { feedId: id },
    orderBy: { fetchedAt: "desc" },
    take: 20,
    include: { _count: { select: { changes: true } } },
  })

  const recentChanges = await db.xmlFeedChange.findMany({
    where: { snapshot: { feedId: id } },
    orderBy: { detectedAt: "desc" },
    take: 100,
    include: { snapshot: { select: { fetchedAt: true } } },
  })

  // Strip parsedData
  const snapshotsSafe = snapshots.map(({ parsedData: _omit, ...s }) => s)

  return (
    <XmlFeedDetailClient
      feed={feed as any}
      snapshots={snapshotsSafe as any}
      changes={recentChanges as any}
      canEdit={isOperator}
    />
  )
}
