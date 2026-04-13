import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  await assertApiAccess(_req)
  const { id } = await params
  const connection = await db.connection.findUnique({
    where: { id },
    include: {
      bindings: { include: { entity: { select: { id: true, name: true } } } },
      _count: { select: { bindings: true, webhooks: true } },
    },
  })
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(connection)
}

export async function PATCH(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const body = await req.json()

  let credentialsUpdate: Record<string, any> | undefined
  if (body.credentials !== undefined) {
    // Merge with existing — never wipe a key that wasn't re-entered (empty = keep existing)
    const existing = await db.connection.findUnique({ where: { id }, select: { credentials: true } })
    const existingCreds = (existing?.credentials as Record<string, any>) ?? {}
    const merged: Record<string, any> = { ...existingCreds }
    for (const [k, v] of Object.entries(body.credentials as Record<string, any>)) {
      const str = String(v ?? "").trim()
      if (str !== "") merged[k] = v
    }
    credentialsUpdate = merged
  }

  const updated = await db.connection.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.baseUrl !== undefined && { baseUrl: body.baseUrl }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(credentialsUpdate !== undefined && { credentials: credentialsUpdate }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params) {
  await assertApiAccess(_req)
  const { id } = await params
  await db.connection.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
