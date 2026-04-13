import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10)

  const snapshots = await db.xmlFeedSnapshot.findMany({
    where: { feedId: id },
    orderBy: { fetchedAt: "desc" },
    take: limit,
    include: {
      _count: { select: { changes: true } },
    },
    // Omit parsedData to keep response small
  })

  // Strip parsedData from response
  const result = snapshots.map(({ parsedData: _omit, ...s }) => s)
  return NextResponse.json(result)
}
