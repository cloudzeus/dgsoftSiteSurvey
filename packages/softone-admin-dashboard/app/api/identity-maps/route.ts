import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request) {
  await assertApiAccess(req)
  const { searchParams } = new URL(req.url)
  const sourceConnectionId = searchParams.get("sourceConnectionId") || undefined
  const targetConnectionId = searchParams.get("targetConnectionId") || undefined
  const entityId = searchParams.get("entityId") || undefined
  const q = searchParams.get("q") || undefined
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const pageSize = Math.min(200, Math.max(10, Number(searchParams.get("pageSize") ?? 50)))

  const where = {
    ...(sourceConnectionId && { sourceConnectionId }),
    ...(targetConnectionId && { targetConnectionId }),
    ...(entityId && { entityId }),
    ...(q && {
      OR: [
        { sourceValue: { contains: q } },
        { targetValue: { contains: q } },
        { notes:       { contains: q } },
      ],
    }),
  }

  const [records, total] = await Promise.all([
    db.recordIdentityMap.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sourceConnection: { select: { id: true, name: true, type: true } },
        targetConnection: { select: { id: true, name: true, type: true } },
        entity:           { select: { id: true, name: true, slug: true } },
      },
    }),
    db.recordIdentityMap.count({ where }),
  ])

  return NextResponse.json({ records, total, page, pageSize })
}

export async function POST(req: Request) {
  await assertApiAccess(req)
  const body = await req.json()
  const { sourceConnectionId, targetConnectionId, sourceField, targetField, sourceValue, targetValue, entityId, notes } = body

  if (!sourceConnectionId || !targetConnectionId || !sourceField || !targetField || !sourceValue || !targetValue)
    return NextResponse.json({ error: "sourceConnectionId, targetConnectionId, sourceField, targetField, sourceValue, targetValue required" }, { status: 400 })

  const map = await db.recordIdentityMap.upsert({
    where: {
      sourceConnectionId_targetConnectionId_sourceField_sourceValue: {
        sourceConnectionId, targetConnectionId, sourceField, sourceValue,
      },
    },
    create: { sourceConnectionId, targetConnectionId, sourceField, targetField, sourceValue, targetValue, entityId: entityId || null, notes: notes || null },
    update: { targetValue, targetField, notes: notes || null, entityId: entityId || null },
    include: {
      sourceConnection: { select: { id: true, name: true, type: true } },
      targetConnection: { select: { id: true, name: true, type: true } },
    },
  })
  return NextResponse.json(map, { status: 201 })
}
