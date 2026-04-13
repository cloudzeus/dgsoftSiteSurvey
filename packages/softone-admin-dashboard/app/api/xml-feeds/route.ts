import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request) {
  await assertApiAccess(req)
  const feeds = await db.xmlFeed.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { snapshots: true, fields: true } },
    },
  })
  return NextResponse.json(feeds)
}

export async function POST(req: Request) {
  await assertApiAccess(req)
  const body = await req.json()
  const { name, url, description, schedule } = body

  if (!name || !url) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 })
  }

  const feed = await db.xmlFeed.create({
    data: { name, url, description: description || null, schedule: schedule || "0 */6 * * *" },
  })
  return NextResponse.json(feed, { status: 201 })
}
