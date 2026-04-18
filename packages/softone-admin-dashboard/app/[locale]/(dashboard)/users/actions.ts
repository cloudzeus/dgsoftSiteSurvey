"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import { auth } from "@/lib/auth"

const USER_SELECT = {
  id: true, name: true, email: true, role: true,
  image: true, jobPosition: true,
  phone: true, mobile: true,
  address: true, city: true, zip: true,
  createdAt: true, updatedAt: true,
} as const

type UserRow = {
  id: string; name: string | null; email: string; role: string
  image: string | null; jobPosition: string | null
  phone: string | null; mobile: string | null
  address: string | null; city: string | null; zip: string | null
  createdAt: Date; updatedAt: Date
}

type ActionResult = { user?: UserRow; error?: string; success?: boolean; deleted?: number }

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createUser(data: {
  name: string; email: string; password: string; role: string
}): Promise<ActionResult> {
  try {
    await requireResourceAction("users", "add")
  } catch {
    return { error: "Unauthorized" }
  }

  if (!data.email)    return { error: "Email is required" }
  if (!data.password) return { error: "Password is required" }

  const existing = await db.user.findUnique({ where: { email: data.email } })
  if (existing) return { error: "A user with that email already exists" }

  const hash = await bcrypt.hash(data.password, 12)
  const user = await db.user.create({
    data: {
      name: data.name || null,
      email: data.email,
      password: hash,
      role: data.role || "VIEWER",
    },
    select: USER_SELECT,
  })

  revalidatePath("/users")
  return { user }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateUser(id: string, data: {
  name?: string; role?: string; password?: string
  jobPosition?: string; phone?: string; mobile?: string
  address?: string; city?: string; zip?: string
}): Promise<ActionResult> {
  try {
    await requireResourceAction("users", "edit")
  } catch {
    return { error: "Unauthorized" }
  }

  const record: Record<string, unknown> = {}
  if (data.name        !== undefined) record.name        = data.name        || null
  if (data.role        !== undefined) record.role        = data.role
  if (data.password                 ) record.password    = await bcrypt.hash(data.password, 12)
  if (data.jobPosition !== undefined) record.jobPosition = data.jobPosition || null
  if (data.phone       !== undefined) record.phone       = data.phone       || null
  if (data.mobile      !== undefined) record.mobile      = data.mobile      || null
  if (data.address     !== undefined) record.address     = data.address     || null
  if (data.city        !== undefined) record.city        = data.city        || null
  if (data.zip         !== undefined) record.zip         = data.zip         || null

  const user = await db.user.update({ where: { id }, data: record, select: USER_SELECT })

  revalidatePath("/users")
  return { user }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteUser(id: string): Promise<ActionResult> {
  try {
    await requireResourceAction("users", "delete")
  } catch {
    return { error: "Unauthorized" }
  }

  const session = await auth()
  const me = session?.user as { id?: string } | undefined
  if (me?.id === id) return { error: "You cannot delete your own account" }

  await db.user.delete({ where: { id } })
  revalidatePath("/users")
  return { success: true }
}

// ─── Bulk delete ──────────────────────────────────────────────────────────────

export async function deleteUsers(ids: string[]): Promise<ActionResult> {
  try {
    await requireResourceAction("users", "delete")
  } catch {
    return { error: "Unauthorized" }
  }

  const session = await auth()
  const me = session?.user as { id?: string } | undefined
  const safeIds = ids.filter(id => id !== me?.id)

  await db.user.deleteMany({ where: { id: { in: safeIds } } })
  revalidatePath("/users")
  return { deleted: safeIds.length }
}
