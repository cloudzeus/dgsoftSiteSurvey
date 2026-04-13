import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const { targetValue, targetField, notes } = await req.json()
  const updated = await db.recordIdentityMap.update({
    where: { id },
    data: {
      ...(targetValue !== undefined && { targetValue }),
      ...(targetField !== undefined && { targetField }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  await db.recordIdentityMap.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
