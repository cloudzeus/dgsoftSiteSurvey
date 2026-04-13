import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { getActiveSoftoneClient } from "@/lib/active-connection"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  await assertApiAccess(req)
  const { searchParams } = new URL(req.url)
  const objectName = searchParams.get("object")

  try {
    const client = await getActiveSoftoneClient()

    if (!objectName) {
      // Returns [{name, type, caption}] — caption is the Greek display name
      const objects = await client.getObjects()
      return NextResponse.json({ objects })
    }

    // Check metadata cache first (skip if tables was empty — never cache failures)
    const cached = await db.softoneMetadata.findUnique({ where: { objectName } })
    if (cached && cached.expiresAt > new Date()) {
      const parsed = JSON.parse(cached.metadata) as { tables?: string[] }
      if (parsed.tables && parsed.tables.length > 0) {
        return NextResponse.json(parsed)
      }
      // cached empty result — delete and re-fetch
      await db.softoneMetadata.delete({ where: { objectName } }).catch(() => {})
    }

    const tables = await client.getObjectTables(objectName)
    console.log(`[discover] getObjectTables(${objectName}) → ${tables.length} tables:`, tables)

    const metadata = { objectName, tables }

    // Only cache if we actually got tables back
    if (tables.length > 0) {
      await db.softoneMetadata.upsert({
        where: { objectName },
        create: {
          objectName,
          metadata: JSON.stringify(metadata),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        update: {
          metadata: JSON.stringify(metadata),
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    }

    return NextResponse.json(metadata)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
