import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10)
  const snapshotId = url.searchParams.get("snapshotId") ?? undefined

  const changes = await db.xmlFeedChange.findMany({
    where: {
      snapshot: { feedId: id },
      ...(snapshotId && { snapshotId }),
    },
    orderBy: { detectedAt: "desc" },
    take: limit,
    include: {
      snapshot: { select: { fetchedAt: true } },
    },
  })

  return NextResponse.json(changes)
}
