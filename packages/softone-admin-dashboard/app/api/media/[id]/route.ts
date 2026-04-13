import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { bunnyDelete } from "@/lib/bunny"

// DELETE /api/media/[id]  →  delete file from CDN + DB
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertApiAccess(_req)
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })

  const { id } = await params

  const file = await db.mediaFile.findUnique({ where: { id } })
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

  await bunnyDelete(file.cdnUrl)
  await db.mediaFile.delete({ where: { id } })

  return new Response(null, { status: 204 })
}
