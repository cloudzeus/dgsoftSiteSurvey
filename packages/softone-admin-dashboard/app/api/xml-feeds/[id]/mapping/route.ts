import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

// GET — return existing mapping (with field maps) for this feed
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params

  const mapping = await db.xmlFeedEntityMapping.findUnique({
    where: { feedId: id },
    include: {
      entity: { select: { id: true, name: true, slug: true } },
      fieldMaps: true,
    },
  })

  return NextResponse.json(mapping ?? null)
}

// POST — upsert mapping + field maps
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params

  const body = await req.json() as {
    entityId: string
    keyFieldPath: string | null
    fieldMaps: { xmlFieldPath: string; canonicalField: string; transformation?: string }[]
  }

  const { entityId, keyFieldPath, fieldMaps } = body
  if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 })

  // Upsert the entity mapping
  const mapping = await db.xmlFeedEntityMapping.upsert({
    where: { feedId: id },
    create: { feedId: id, entityId, keyFieldPath: keyFieldPath ?? null },
    update: { entityId, keyFieldPath: keyFieldPath ?? null },
  })

  // Replace all field maps
  await db.xmlFeedFieldMap.deleteMany({ where: { mappingId: mapping.id } })

  if (fieldMaps.length > 0) {
    await db.xmlFeedFieldMap.createMany({
      data: fieldMaps
        .filter((f) => f.xmlFieldPath && f.canonicalField)
        .map((f) => ({
          mappingId: mapping.id,
          xmlFieldPath: f.xmlFieldPath,
          canonicalField: f.canonicalField,
          ...(f.transformation ? { transformation: f.transformation } : {}),
        })),
    })
  }

  // Ensure canonical PipelineFields exist for mapped fields
  for (const fm of fieldMaps) {
    if (!fm.canonicalField) continue
    await db.pipelineField.upsert({
      where: { entityId_name: { entityId, name: fm.canonicalField } },
      create: {
        entityId,
        name: fm.canonicalField,
        label: fm.canonicalField.replace(/_/g, " "),
        dataType: "character",
        sortOrder: 0,
      },
      update: {},
    })
  }

  return NextResponse.json({ ok: true, mappingId: mapping.id })
}
