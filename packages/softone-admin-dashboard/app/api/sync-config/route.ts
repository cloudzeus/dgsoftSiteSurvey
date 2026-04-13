import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { SyncConfigInputSchema } from "@softone/sync"

// Derive the local MySQL table name from a Softone table name
function toLocalTableName(softoneName: string): string {
  return `softone_${softoneName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
}

// Map Softone dataType → MySQL column definition
function toMysqlColDef(
  localColumnName: string,
  dataType: string,
  isPrimaryKey: boolean,
  nullable: boolean
): string {
  // Sanitize column name — strip anything that isn't alphanumeric or _
  const col = `\`${localColumnName.replace(/[^a-zA-Z0-9_]/g, "_")}\``

  let type: string
  switch (dataType) {
    case "numeric":  type = "DECIMAL(18,6)"; break
    case "datetime": type = "DATETIME"; break
    case "logical":  type = "TINYINT(1) DEFAULT 0"; break
    default:         type = isPrimaryKey ? "VARCHAR(191)" : "TEXT"
  }

  const nullability = isPrimaryKey || !nullable ? "NOT NULL" : "NULL"
  return `${col} ${type} ${nullability}`
}

export async function GET(req: Request) {
  await assertApiAccess(req)
  const configs = await db.syncConfig.findMany({
    orderBy: { createdAt: "desc" },
    include: { fieldMappings: true, _count: { select: { syncJobs: true } } },
  })
  return NextResponse.json(configs)
}

export async function POST(req: Request) {
  await assertApiAccess(req)

  const body = await req.json()
  const parsed = SyncConfigInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { fieldMappings, ...configData } = parsed.data

  // Save sync config + field mappings
  // Map undefined → null for optional Prisma string fields (exactOptionalPropertyTypes)
  const mappingsToCreate = fieldMappings.map((m) => ({
    ...m,
    transformation: m.transformation ?? null,
    relatedConfigId: m.relatedConfigId ?? null,
    relatedLabelField: m.relatedLabelField ?? null,
    relatedValueField: m.relatedValueField ?? null,
  }))

  const config = await db.syncConfig.create({
    data: {
      ...configData,
      fieldMappings: { create: mappingsToCreate },
    },
    include: { fieldMappings: true },
  })

  // ── Reference configs: no table needed ───────────────────────────────────
  if (configData.usageType === "REFERENCE") {
    return NextResponse.json({ ...config }, { status: 201 })
  }

  // ── Persistent: create the target MySQL table ─────────────────────────────
  const localTableName = toLocalTableName(configData.tableName)

  const syncable = config.fieldMappings.filter((f) => f.isSyncable)
  const sorted = [
    ...syncable.filter((f) => f.isPrimaryKey),
    ...syncable.filter((f) => !f.isPrimaryKey),
  ]

  const colDefs = sorted.map((f) =>
    toMysqlColDef(f.localColumnName, f.dataType, f.isPrimaryKey, !f.isPrimaryKey)
  )

  colDefs.push("`_synced_at` DATETIME NULL")
  colDefs.push("`_sync_config_id` VARCHAR(191) NULL")

  const pkField = sorted.find((f) => f.isPrimaryKey)
  const pkConstraint = pkField
    ? `, PRIMARY KEY (\`${pkField.localColumnName.replace(/[^a-zA-Z0-9_]/g, "_")}\`)`
    : ""

  const createSql = `CREATE TABLE IF NOT EXISTS \`${localTableName}\` (${colDefs.join(", ")}${pkConstraint})`

  let tableWarning: string | undefined
  try {
    await db.$executeRawUnsafe(createSql)
  } catch (err: any) {
    tableWarning = err.message
  }

  return NextResponse.json(
    { ...config, localTableName, tableWarning },
    { status: 201 }
  )
}
