import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { bunnyUpload, bunnyDelete } from "@/lib/bunny"
import { auth } from "@/lib/auth"
import { toWebP } from "@/lib/image"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB before conversion

// POST /api/users/[id]/avatar — upload avatar; ADMIN or the user themselves
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertApiAccess(req)
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const currentUser = session.user as { id?: string; role?: string }
  const isSelf  = currentUser.id === id
  const isAdmin = currentUser.role === "ADMIN"

  if (!isSelf && !isAdmin) return new Response("Forbidden", { status: 403 })

  const formData = await req.formData()
  const file = formData.get("avatar")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be JPEG, PNG, WebP, or GIF" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 5 MB" }, { status: 400 })
  }

  // Fetch existing image to clean up old one
  const existing = await db.user.findUnique({ where: { id }, select: { image: true } })

  const raw = Buffer.from(await file.arrayBuffer())
  const { buffer, contentType, ext } = await toWebP(raw, file.type)
  const path = `avatars/${id}.${ext}`

  const cdnUrl = await bunnyUpload(path, buffer, contentType)

  // Delete old avatar if it was a different file (e.g. changed extension)
  if (existing?.image && existing.image !== cdnUrl) {
    await bunnyDelete(existing.image)
  }

  const user = await db.user.update({
    where: { id },
    data: { image: cdnUrl },
    select: { id: true, image: true },
  })

  return NextResponse.json(user)
}

// DELETE /api/users/[id]/avatar — remove avatar
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertApiAccess(_req)
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const currentUser = session.user as { id?: string; role?: string }
  const isSelf  = currentUser.id === id
  const isAdmin = currentUser.role === "ADMIN"

  if (!isSelf && !isAdmin) return new Response("Forbidden", { status: 403 })

  const existing = await db.user.findUnique({ where: { id }, select: { image: true } })
  if (existing?.image) await bunnyDelete(existing.image)

  await db.user.update({ where: { id }, data: { image: null } })

  return new Response(null, { status: 204 })
}
