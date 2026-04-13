import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  const filters = await db.xmlFeedFilter.findMany({
    where: { feedId: id },
    orderBy: { id: "asc" },
  })
  return NextResponse.json(filters)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const body = await req.json()

  const { type, field, operator, value, label } = body as {
    type: string; field: string; operator?: string; value?: string; label?: string
  }

  if (!type || !field) {
    return NextResponse.json({ error: "type and field are required" }, { status: 400 })
  }
  if (type !== "EXCLUDE_FIELD" && type !== "EXCLUDE_RECORD") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }
  if (type === "EXCLUDE_RECORD" && !operator) {
    return NextResponse.json({ error: "operator is required for EXCLUDE_RECORD" }, { status: 400 })
  }

  const filter = await db.xmlFeedFilter.create({
    data: {
      feedId: id,
      type,
      field,
      operator: operator ?? null,
      value: value ?? null,
      label: label ?? null,
    },
  })
  return NextResponse.json(filter)
}
