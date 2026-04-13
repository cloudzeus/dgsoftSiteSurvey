import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  const feed = await db.xmlFeed.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { frequency: "desc" } },
      _count: { select: { snapshots: true } },
    },
  })
  if (!feed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(feed)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const body = await req.json()
  const { name, url, description, schedule, isActive } = body

  const feed = await db.xmlFeed.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(description !== undefined && { description }),
      ...(schedule !== undefined && { schedule }),
      ...(isActive !== undefined && { isActive }),
    },
  })
  return NextResponse.json(feed)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  await db.xmlFeed.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
