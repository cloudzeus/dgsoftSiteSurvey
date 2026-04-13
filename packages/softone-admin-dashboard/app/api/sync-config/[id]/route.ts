import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { SyncConfigInputSchema } from "@softone/sync"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await assertApiAccess(_req)
  const { id } = await params
  const config = await db.syncConfig.findUnique({
    where: { id },
    include: { fieldMappings: true },
  })
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(config)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await assertApiAccess(req)
  const { id } = await params
  const body = await req.json()
  const parsed = SyncConfigInputSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { fieldMappings, ...configData } = parsed.data

  const config = await db.syncConfig.update({
    where: { id },
    // Filter out undefined values — Prisma with exactOptionalPropertyTypes requires no undefined keys
    data: Object.fromEntries(Object.entries(configData).filter(([, v]) => v !== undefined)),
    include: { fieldMappings: true },
  })

  return NextResponse.json(config)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await assertApiAccess(_req)
  const { id } = await params
  await db.syncConfig.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
