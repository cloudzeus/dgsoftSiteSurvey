import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"

// GET all entries for a table
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  const entries = await db.mappingEntry.findMany({
    where: { tableId: id },
    orderBy: { sourceValue: "asc" },
  })
  return NextResponse.json(entries)
}

// POST — upsert a single entry
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id: tableId } = await params
  const { sourceValue, targetValue, label } = await req.json()

  if (!sourceValue || !targetValue)
    return NextResponse.json({ error: "sourceValue and targetValue required" }, { status: 400 })

  const entry = await db.mappingEntry.upsert({
    where: { tableId_sourceValue: { tableId, sourceValue } },
    create: { tableId, sourceValue, targetValue, label: label || null },
    update: { targetValue, label: label || null },
  })
  return NextResponse.json(entry, { status: 201 })
}

// PUT — bulk replace all entries for a table
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id: tableId } = await params
  const entries: Array<{ sourceValue: string; targetValue: string; label?: string }> = await req.json()

  await db.$transaction([
    db.mappingEntry.deleteMany({ where: { tableId } }),
    db.mappingEntry.createMany({
      data: entries
        .filter((e) => e.sourceValue && e.targetValue)
        .map((e) => ({ tableId, sourceValue: e.sourceValue, targetValue: e.targetValue, label: e.label || null })),
    }),
  ])

  const saved = await db.mappingEntry.findMany({ where: { tableId }, orderBy: { sourceValue: "asc" } })
  return NextResponse.json(saved)
}
