import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bunnyDelete } from "@/lib/bunny"
import { assertApiAccess } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

// DELETE /api/backups/[id]
export async function DELETE(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params

  const backup = await db.databaseBackup.findUnique({ where: { id } })
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (backup.bunnyUrl) await bunnyDelete(backup.bunnyUrl)

  await db.databaseBackup.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
