import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; filterId: string }> },
) {
  await assertApiAccess(_req)
  const { id, filterId } = await params
  await db.xmlFeedFilter.deleteMany({ where: { id: filterId, feedId: id } })
  return NextResponse.json({ ok: true })
}
