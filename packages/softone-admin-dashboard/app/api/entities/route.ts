import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import crypto from "crypto"

export async function GET(req: Request) {
  await assertApiAccess(req)
  const entities = await db.pipelineEntity.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { records: true, bindings: true, jobs: true } },
      bindings: {
        include: { connection: { select: { id: true, name: true, type: true } } },
      },
    },
  })
  return NextResponse.json(entities)
}

type BindingInput = {
  connectionId?: string
  name?: string | null
  direction?: string
  objectName?: string
  tableName?: string | null
  resourcePath?: string | null
  filterClause?: string | null
  fieldMappings?: { canonicalField?: string; externalField?: string; transformation?: string | null }[]
}

export async function POST(req: Request) {
  await assertApiAccess(req)
  const body = await req.json()

  const { name, slug, description, showInMenu, menuLabel, menuIcon, fields, bindings } = body

  if (!name || !slug) return NextResponse.json({ error: "name and slug required" }, { status: 400 })
  if (!fields?.length) return NextResponse.json({ error: "at least one field required" }, { status: 400 })
  if (!bindings?.length) return NextResponse.json({ error: "at least one binding required" }, { status: 400 })

  const bindingList = bindings as BindingInput[]
  for (const b of bindingList) {
    const cid = String(b.connectionId ?? "").trim()
    const obj = String(b.objectName ?? "").trim()
    if (!cid || !obj) {
      return NextResponse.json(
        { error: "Each binding needs a non-empty connectionId and objectName" },
        { status: 400 },
      )
    }
    if (!b.direction) {
      return NextResponse.json({ error: "Each binding needs a direction" }, { status: 400 })
    }
  }

  const connectionIds = [...new Set(bindingList.map((b) => String(b.connectionId!).trim()))]
  const existingConnections = await db.connection.findMany({
    where: { id: { in: connectionIds } },
    select: { id: true },
  })
  if (existingConnections.length !== connectionIds.length) {
    const found = new Set(existingConnections.map((c) => c.id))
    const missing = connectionIds.filter((id) => !found.has(id))
    return NextResponse.json(
      { error: "Unknown or invalid connectionId(s)", missingConnectionIds: missing },
      { status: 400 },
    )
  }

  const result = await db.$transaction(async (tx) => {
    const entity = await tx.pipelineEntity.create({
      data: {
        name,
        slug,
        description: description || null,
        showInMenu: showInMenu ?? false,
        menuLabel: menuLabel || null,
        menuIcon: menuIcon || "Database",
        fields: { create: fields },
      },
      include: { fields: true },
    })

    for (const b of bindingList) {
      const binding = await tx.systemBinding.create({
        data: {
          entityId: entity.id,
          connectionId: String(b.connectionId).trim(),
          name: b.name || null,
          direction: b.direction!,
          objectName: String(b.objectName).trim(),
          tableName: b.tableName || null,
          resourcePath: b.resourcePath || null,
          filterClause: b.filterClause || null,
          fieldMaps: {
            create: (b.fieldMappings ?? [])
              .map((m) => ({
                canonicalFieldId: entity.fields.find((f) => f.name === m.canonicalField)?.id ?? "",
                externalField: m.externalField ?? "",
                transformation: m.transformation || null,
              }))
              .filter((m) => m.canonicalFieldId && m.externalField),
          },
        },
      })

      if (b.direction === "INBOUND" || b.direction === "BOTH") {
        const secret = crypto.randomBytes(24).toString("hex")
        await tx.webhookEndpoint.create({
          data: {
            bindingId: binding.id,
            connectionId: String(b.connectionId).trim(),
            secret,
            description: `${name} ← ${b.objectName}`,
          },
        })
      }
    }

    return tx.pipelineEntity.findUnique({
      where: { id: entity.id },
      include: {
        fields: true,
        bindings: {
          include: { connection: true, fieldMaps: true, webhooks: true },
        },
      },
    })
  })

  return NextResponse.json(result, { status: 201 })
}
