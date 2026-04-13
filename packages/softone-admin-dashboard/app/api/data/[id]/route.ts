import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getActiveSoftoneClient } from "@/lib/active-connection"

function toSqlTable(tableName: string) {
  return `softone_${tableName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
}

// Validate a column name comes from the known field set
function safeCol(col: string, known: Set<string>): string | null {
  return known.has(col) ? col : null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await assertApiAccess(req)
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, Number(searchParams.get("page")     ?? "1"))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")))
    const sortBy   = searchParams.get("sortBy")  ?? null
    const sortDir  = searchParams.get("sortDir") === "desc" ? "DESC" : "ASC"
    const search   = (searchParams.get("search") ?? "").trim()

    const config = await db.syncConfig.findUnique({
      where: { id },
      include: { fieldMappings: { where: { isSyncable: true } } },
    })

    if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 })

    // ── REFERENCE: fetch live from Softone ────────────────────────────────
    // 1. getBrowserInfo + getBrowserData → paged keys (position 0 = "TABLE;KEYVALUE")
    // 2. selectorFields per key → named fields
    if (config.usageType === "REFERENCE") {
      const client = await getActiveSoftoneClient()

      const resultFields = config.fieldMappings.map((f) => f.softoneFieldName).join(",")

      const charFields = config.fieldMappings
        .filter((f) => f.dataType === "character")
        .map((f) => f.softoneFieldName)
      const filter = search && charFields.length > 0
        ? charFields.map((f) => `${f} LIKE '%${search.replace(/'/g, "''")}%'`).join(" OR ")
        : undefined

      // Step 1: get paged keys
      const browserInfo = await client.call<any>("getBrowserInfo", {
        OBJECT: config.objectName,
        ...(filter ? { FILTERS: filter } : {}),
      })
      if (!browserInfo.success) {
        throw new Error(`getBrowserInfo failed: ${browserInfo.error ?? JSON.stringify(browserInfo)}`)
      }

      const browserData = await client.call<any>("getBrowserData", {
        reqID:      browserInfo.reqID,
        startindex: (page - 1) * pageSize,
        pagesize:   pageSize,
      })

      const rawRows: any[] = browserData.rows ?? []

      // Extract KEYVALUE from position 0 ("TABLENAME;KEYVALUE")
      const keyValues = rawRows.map((row) => {
        const ref = Array.isArray(row) ? row[0] : Object.values(row as object)[0]
        const str = String(ref ?? "")
        return str.includes(";") ? str.split(";")[1] : str
      }).filter(Boolean)

      // Step 2: selectorFields per key → named fields, skip empty rows
      const rawRecords = await Promise.all(
        keyValues.map(async (keyValue) => {
          const res = await client.call<any>("selectorFields", {
            TABLENAME:    config.objectName,
            KEYNAME:      config.tableName,
            KEYVALUE:     keyValue,
            RESULTFIELDS: resultFields,
          })
          return (res.rows ?? [])[0] ?? null
        })
      )
      const hasIsActive = config.fieldMappings.some(
        (f) => f.softoneFieldName.toUpperCase() === "ISACTIVE"
      )

      const records = rawRecords.filter((r) => {
        if (r === null || Object.keys(r).length === 0) return false
        if (!Object.values(r).some((v) => v !== null && v !== "" && v !== undefined)) return false
        if (hasIsActive) {
          const isActiveKey = Object.keys(r).find((k) => k.toUpperCase() === "ISACTIVE")
          if (isActiveKey !== undefined) {
            const val = r[isActiveKey]
            if (val !== 1 && val !== "1" && val !== true) return false
          }
        }
        return true
      })

      const columns = config.fieldMappings.map((f) => ({
        key:          f.softoneFieldName,
        label:        f.localColumnName,
        dataType:     f.dataType,
        isPrimaryKey: f.isPrimaryKey,
        isCustom:     f.isCustom,
      }))

      return NextResponse.json({
        records,
        total: browserInfo.totalcount ?? rawRows.length,
        page,
        pageSize,
        columns,
        isLive: true,
      })
    }

    // ── PERSISTENT: query local MySQL table ────────────────────────────────
    const sqlTable = toSqlTable(config.tableName)
    const knownCols = new Set([
      ...config.fieldMappings.map((f) => f.localColumnName),
      "_synced_at",
    ])

    const orderCol  = safeCol(sortBy ?? "_synced_at", knownCols) ?? "_synced_at"
    const charCols  = config.fieldMappings
      .filter((f) => f.dataType === "character")
      .map((f) => f.localColumnName)

    // Build WHERE clause for search
    const whereSQL  = search && charCols.length > 0
      ? `WHERE ${charCols.map((c) => `\`${c}\` LIKE ?`).join(" OR ")}`
      : ""
    const searchArgs = search && charCols.length > 0
      ? charCols.map(() => `%${search}%`)
      : []

    const offset = (page - 1) * pageSize

    const [records, countRows] = await Promise.all([
      db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM \`${sqlTable}\` ${whereSQL} ORDER BY \`${orderCol}\` ${sortDir} LIMIT ? OFFSET ?`,
        ...searchArgs, pageSize, offset
      ),
      db.$queryRawUnsafe<{ total: bigint }[]>(
        `SELECT COUNT(*) AS total FROM \`${sqlTable}\` ${whereSQL}`,
        ...searchArgs
      ),
    ])

    const total = Number(countRows[0]?.total ?? 0)

    return NextResponse.json({
      records,
      total,
      page,
      pageSize,
      columns: config.fieldMappings.map((f) => ({
        key:        f.localColumnName,
        label:      f.softoneFieldName,
        dataType:   f.dataType,
        isPrimaryKey: f.isPrimaryKey,
        isCustom:   f.isCustom,
      })),
    })
  } catch (err: any) {
    // Table might not exist yet (sync never ran)
    if (err?.message?.includes("doesn't exist") || err?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ records: [], total: 0, page: 1, pageSize: 25, columns: [], tableNotFound: true })
    }
    console.error("[/api/data]", err)
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 })
  }
}
