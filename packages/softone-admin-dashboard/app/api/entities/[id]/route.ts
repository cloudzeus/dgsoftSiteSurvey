import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  await assertApiAccess(_req)
  const { id } = await params
  const entity = await db.pipelineEntity.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      bindings: {
        include: {
          connection: { select: { id: true, name: true, type: true, lastTestOk: true } },
          fieldMaps: { include: { canonicalField: true } },
          webhooks: true,
        },
      },
      _count: { select: { records: true, jobs: true } },
    },
  })
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(entity)
}

export async function PATCH(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const body = await req.json()

  const updated = await db.pipelineEntity.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.showInMenu !== undefined && { showInMenu: body.showInMenu }),
      ...(body.menuLabel !== undefined && { menuLabel: body.menuLabel }),
      ...(body.menuIcon !== undefined && { menuIcon: body.menuIcon }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params) {
  await assertApiAccess(_req)
  const { id } = await params

  // Remove dependents that do not yet have DB-level ON DELETE CASCADE (or before `prisma db push`).
  await db.$transaction([
    db.xmlFeedEntityMapping.deleteMany({ where: { entityId: id } }),
    db.pipelineJob.deleteMany({ where: { entityId: id } }),
    db.processingLock.deleteMany({ where: { entityId: id } }),
    db.pipelineRecord.deleteMany({ where: { entityId: id } }),
    db.pipelineEntity.delete({ where: { id } }),
  ])

  return NextResponse.json({ ok: true })
}
