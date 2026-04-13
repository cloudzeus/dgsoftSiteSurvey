import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  const table = await db.mappingTable.findUnique({
    where: { id },
    include: {
      entries: { orderBy: { sourceValue: "asc" } },
      sourceConnection: { select: { id: true, name: true, type: true } },
      targetConnection: { select: { id: true, name: true, type: true } },
    },
  })
  if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(table)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const { description, sourceConnectionId, targetConnectionId } = await req.json()
  const updated = await db.mappingTable.update({
    where: { id },
    data: {
      ...(description !== undefined && { description }),
      ...(sourceConnectionId !== undefined && { sourceConnectionId: sourceConnectionId || null }),
      ...(targetConnectionId !== undefined && { targetConnectionId: targetConnectionId || null }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  await db.mappingTable.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
