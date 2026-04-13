import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { auth } from "@/lib/auth"

const USER_SELECT = {
  id: true, name: true, email: true, role: true,
  image: true, jobPosition: true,
  phone: true, mobile: true,
  address: true, city: true, zip: true,
  createdAt: true, updatedAt: true,
} as const

// PATCH /api/users/[id] — update profile fields (ADMIN only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertApiAccess(req)

  const { id } = await params
  const body = await req.json()
  const { name, role, password, jobPosition, phone, mobile, address, city, zip } = body

  const validRoles = ["ADMIN", "OPERATOR", "VIEWER"]
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (name        !== undefined) data.name        = name        || null
  if (role        !== undefined) data.role        = role
  if (password                 ) data.password    = await bcrypt.hash(password, 12)
  if (jobPosition !== undefined) data.jobPosition = jobPosition || null
  if (phone       !== undefined) data.phone       = phone       || null
  if (mobile      !== undefined) data.mobile      = mobile      || null
  if (address     !== undefined) data.address     = address     || null
  if (city        !== undefined) data.city        = city        || null
  if (zip         !== undefined) data.zip         = zip         || null

  const user = await db.user.update({ where: { id }, data, select: USER_SELECT })

  return NextResponse.json(user)
}

// DELETE /api/users/[id] — delete user (ADMIN only, cannot self-delete)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertApiAccess(_req)

  const session = await auth()
  const { id } = await params

  if (session?.user && (session.user as { id?: string }).id === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
  }

  await db.user.delete({ where: { id } })

  return new Response(null, { status: 204 })
}
