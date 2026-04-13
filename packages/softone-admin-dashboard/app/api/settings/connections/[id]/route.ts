import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { z } from "zod"

const UpdateSchema = z.object({
  label:     z.string().min(1).optional(),
  baseUrl:   z.string().url().optional(),
  username:  z.string().min(1).optional(),
  password:  z.string().optional(), // empty = keep existing
  appId:     z.string().min(1).optional(),
  company:   z.string().optional(),
  branch:    z.string().optional(),
  module:    z.string().optional(),
  refId:     z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive:  z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  const conn = await db.softoneConnection.findUnique({ where: { id } })
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { password: _, ...safe } = conn
  return NextResponse.json(safe)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { password, isDefault, ...rest } = parsed.data

  // If setting as default, clear others first
  if (isDefault) {
    await db.softoneConnection.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
  }

  const updateData: Record<string, unknown> = { ...rest, ...(isDefault !== undefined ? { isDefault } : {}) }
  // Only update password if a non-empty value was provided
  if (password && password.trim().length > 0) {
    updateData.password = password
  }

  const conn = await db.softoneConnection.update({ where: { id }, data: updateData })
  const { password: _, ...safe } = conn
  return NextResponse.json(safe)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  await db.softoneConnection.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
