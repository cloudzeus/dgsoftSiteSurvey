import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getConnector } from "@/lib/connectors"

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const object = searchParams.get("object")
  const table  = searchParams.get("table")
  const bust   = searchParams.get("bust") === "1"

  const connection = await db.connection.findUnique({ where: { id } })
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const cacheKey = table ? `fields:${object}:${table}` : object ? `tables:${object}` : "objects"

  // Try cache first (skip if bust=1)
  if (!bust) {
    const cached = await db.metadataCache.findUnique({
      where: { connectionId_cacheKey: { connectionId: id, cacheKey } },
    })
    if (cached && cached.expiresAt > new Date()) {
      const cachedData = cached.data as any
      // Don't serve a cached empty fields result — let it re-fetch
      const isEmptyFields = table && Array.isArray(cachedData?.fields) && cachedData.fields.length === 0
      if (!isEmptyFields) return NextResponse.json(cached.data)
    }
  }

  // Fetch from connector
  const connector = getConnector(connection)
  let data: unknown

  try {
    if (table && object) {
      console.log(`[discover] getTableFields OBJECT=${object} TABLE=${table}`)
      data = await connector.discoverFields(object, table)
      console.log(`[discover] getTableFields result →`, JSON.stringify(data))
    } else if (object && connector.discoverTables) {
      const tables = await connector.discoverTables(object)
      data = { tables }
    } else {
      const objects = await connector.discoverObjects()
      data = { objects }
    }
  } catch (err) {
    console.error(`[discover] error for ${cacheKey}:`, err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), fields: [], tables: [], objects: [] }, { status: 200 })
  }

  // Only cache non-empty field results
  const shouldCache = !(table && Array.isArray((data as any)?.fields) && (data as any).fields.length === 0)
  if (shouldCache) {
    await db.metadataCache.upsert({
      where: { connectionId_cacheKey: { connectionId: id, cacheKey } },
      create: { connectionId: id, cacheKey, data: data as any, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
      update: { data: data as any, cachedAt: new Date(), expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
    })
  }

  return NextResponse.json(data)
}
