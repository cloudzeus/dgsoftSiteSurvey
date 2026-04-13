import { assertApiAccess } from "@/lib/permissions"
// Fields endpoint: return field definitions for a specific table
import { NextResponse } from "next/server"
import { getActiveSoftoneClient } from "@/lib/active-connection"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  await assertApiAccess(req)
  const { searchParams } = new URL(req.url)
  const objectName = searchParams.get("object")
  const tableName = searchParams.get("table")

  if (!objectName || !tableName) {
    return NextResponse.json(
      { error: "object and table params required" },
      { status: 400 }
    )
  }

  // Check schema cache (skip if previously cached empty)
  const cached = await db.softoneTableSchema.findUnique({ where: { objectName_tableName: { objectName, tableName } } })
  if (cached && cached.expiresAt > new Date()) {
    const parsedFields = JSON.parse(cached.fields) as unknown[]
    if (parsedFields.length > 0) {
      return NextResponse.json({ objectName, tableName, fields: parsedFields, primaryKey: cached.primaryKey })
    }
    await db.softoneTableSchema.delete({ where: { objectName_tableName: { objectName, tableName } } }).catch(() => {})
  }

  const client = await getActiveSoftoneClient()
  const fields = await client.getTableFields(objectName, tableName)
  const primaryKey = fields.find((f) => f.primaryKey)?.name ?? ""

  if (fields.length > 0) {
    await db.softoneTableSchema.upsert({
      where: { objectName_tableName: { objectName, tableName } },
      create: {
        objectName,
        tableName,
        fields: JSON.stringify(fields),
        primaryKey,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {
        fields: JSON.stringify(fields),
        primaryKey,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
  }

  return NextResponse.json({ objectName, tableName, fields, primaryKey })
}
