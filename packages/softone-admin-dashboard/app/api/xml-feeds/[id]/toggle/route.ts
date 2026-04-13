import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params

  const feed = await db.xmlFeed.findUnique({ where: { id }, select: { isActive: true } })
  if (!feed) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await db.xmlFeed.update({
    where: { id },
    data: { isActive: !feed.isActive },
    select: { id: true, isActive: true },
  })

  return NextResponse.json(updated)
}
