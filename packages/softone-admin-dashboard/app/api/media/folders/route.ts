import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

// POST /api/media/folders  →  { name, parentId? }
export async function POST(req: Request) {
  await assertApiAccess(req)
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })

  const body = await req.json()
  const name = (body.name ?? "").trim()
  const parentId = body.parentId ?? null

  if (!name) {
    return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
  }

  if (parentId) {
    const parent = await db.mediaFolder.findUnique({ where: { id: parentId } })
    if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 })
  }

  // Prevent duplicate names within the same parent
  const existing = await db.mediaFolder.findFirst({
    where: { name, parentId },
  })
  if (existing) {
    return NextResponse.json({ error: "A folder with that name already exists here" }, { status: 409 })
  }

  const folder = await db.mediaFolder.create({
    data: { name, parentId },
    include: { _count: { select: { files: true, children: true } } },
  })

  return NextResponse.json(folder, { status: 201 })
}
