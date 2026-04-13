import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request) {
  await assertApiAccess(req)
  const tables = await db.mappingTable.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { entries: true } },
      sourceConnection: { select: { id: true, name: true, type: true } },
      targetConnection: { select: { id: true, name: true, type: true } },
    },
  })
  return NextResponse.json(tables)
}

export async function POST(req: Request) {
  await assertApiAccess(req)
  const { name, description, sourceConnectionId, targetConnectionId } = await req.json()
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })

  const table = await db.mappingTable.create({
    data: {
      name: name.trim().toLowerCase().replace(/\s+/g, "_"),
      description: description || null,
      sourceConnectionId: sourceConnectionId || null,
      targetConnectionId: targetConnectionId || null,
    },
    include: {
      _count: { select: { entries: true } },
      sourceConnection: { select: { id: true, name: true, type: true } },
      targetConnection: { select: { id: true, name: true, type: true } },
    },
  })
  return NextResponse.json(table, { status: 201 })
}
