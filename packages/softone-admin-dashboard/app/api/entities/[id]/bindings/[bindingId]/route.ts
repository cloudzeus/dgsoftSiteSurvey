import { assertApiAccess } from "@/lib/permissions"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; bindingId: string }> },
) {
  await assertApiAccess(req)
  const { id: entityId, bindingId } = await params
  const body = await req.json()

  // Only allow patching safe fields
  const { payloadTemplate, outboundMethod, name, isActive, filterClause } = body

  const binding = await db.systemBinding.findFirst({
    where: { id: bindingId, entityId },
  })
  if (!binding) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await db.systemBinding.update({
    where: { id: bindingId },
    data: {
      ...(payloadTemplate !== undefined && { payloadTemplate }),
      ...(outboundMethod !== undefined && { outboundMethod }),
      ...(name !== undefined && { name }),
      ...(isActive !== undefined && { isActive }),
      ...(filterClause !== undefined && { filterClause }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; bindingId: string }> },
) {
  await assertApiAccess(_req)
  const { id: entityId, bindingId } = await params

  const binding = await db.systemBinding.findFirst({
    where: { id: bindingId, entityId },
  })
  if (!binding) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.systemBinding.delete({ where: { id: bindingId } })
  return NextResponse.json({ ok: true })
}
