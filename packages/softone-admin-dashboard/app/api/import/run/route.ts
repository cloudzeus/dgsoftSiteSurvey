import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import ExcelJS from "exceljs"
import type { ColumnMapping } from "@/components/import/types"

type RunRequest = {
  jobName: string
  connectionId: string | null
  connectionType: string
  targetObject: string
  sheetName: string
  headerRow: number
  mappings: ColumnMapping[]
  skipErrors: boolean
}

type RowError = { row: number; error: string }

// ─── Executors per connection type ────────────────────────────────────────────

async function executeLocalDb(rowData: Record<string, string>, targetObject: string) {
  if (targetObject === "BRAND_PRODUCTS") {
    const brandName = rowData["brand_name"]?.trim()
    const modelName = rowData["model_name"]?.trim()
    if (!brandName) throw new Error("brand_name is required")
    if (!modelName) throw new Error("model_name is required")

    const brand = await db.brand.findUnique({ where: { name: brandName } })
    if (!brand) throw new Error(`Brand not found: "${brandName}". Add it in Master Options → Brands first.`)

    await db.brandProduct.upsert({
      where: { brandId_modelName: { brandId: brand.id, modelName } },
      update: {
        description: rowData["description"] || null,
        category:    rowData["category"] || null,
      },
      create: {
        brandId:     brand.id,
        modelName,
        description: rowData["description"] || null,
        category:    rowData["category"] || null,
      },
    })
  } else if (targetObject === "IOT_PRODUCTS") {
    const modelName    = rowData["model_name"]?.trim()
    const categoryName = rowData["category_name"]?.trim()
    if (!modelName)    throw new Error("model_name is required")
    if (!categoryName) throw new Error("category_name is required")

    let cat = await db.iotCategory.findUnique({ where: { name: categoryName } })
    if (!cat) cat = await db.iotCategory.create({ data: { name: categoryName } })

    const VALID_TECHS = ["LORAWAN", "AI_VISION", "WIFI_HALOW", "FIVE_G"]
    const techRaw = (rowData["technology"] ?? "").trim().toUpperCase()
    const technology = VALID_TECHS.includes(techRaw) ? (techRaw as any) : "LORAWAN"

    await db.iotProduct.upsert({
      where: { modelName },
      update: {
        description: rowData["description"] || null,
        technology,
        categoryId: cat.id,
      },
      create: {
        modelName,
        description: rowData["description"] || null,
        technology,
        categoryId: cat.id,
      },
    })
  } else {
    throw new Error(`Unknown LOCAL_DB target: "${targetObject}"`)
  }
}

async function executeSoftone(rowData: Record<string, string>, objectKey: string) {
  // Lazy import to avoid loading in non-Softone contexts
  const { s1 } = await import("@/lib/s1")
  const result = await s1<any>("setData", {
    OBJECT: objectKey,
    DATA: { [objectKey]: [rowData] },
  })
  if (!result.success) throw new Error(result.error ?? "Softone setData failed")
  return result
}

async function executeRest(
  rowData: Record<string, string>,
  connection: { baseUrl?: string | null; credentials: unknown },
  objectKey: string,
  method = "POST",
) {
  const creds = connection.credentials as Record<string, string>
  const baseUrl = (connection.baseUrl ?? creds.baseUrl ?? "").replace(/\/$/, "")
  if (!baseUrl) throw new Error("Connection has no base URL")

  const headers: Record<string, string> = { "Content-Type": "application/json" }

  // Attach auth headers based on available creds
  if (creds.apiKey)           headers["X-Api-Key"] = creds.apiKey
  if (creds.accessToken)      headers["Authorization"] = `Bearer ${creds.accessToken}`
  if (creds.basicAuth)        headers["Authorization"] = `Basic ${creds.basicAuth}`

  const res = await fetch(`${baseUrl}/${objectKey}`, {
    method,
    headers,
    body: JSON.stringify(rowData),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json().catch(() => null)
}

async function executeShopify(
  rowData: Record<string, string>,
  creds: Record<string, string>,
  objectKey: string,
) {
  const storeDomain = (creds.storeDomain ?? creds.shopDomain ?? "").replace(/\/$/, "")
  const accessToken = creds.accessToken ?? creds.apiKey ?? ""
  if (!storeDomain) throw new Error("Shopify: missing storeDomain credential")

  const singular = objectKey.endsWith("s") ? objectKey.slice(0, -1) : objectKey
  const res = await fetch(
    `https://${storeDomain}/admin/api/2024-01/${objectKey}.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ [singular]: rowData }),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Shopify ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ─── Row transformer ─────────────────────────────────────────────────────────

function transformRow(
  rawRow: Record<string, string>,
  mappings: ColumnMapping[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of mappings) {
    if (!m.targetField || !m.excelColumn) continue
    out[m.targetField] = rawRow[m.excelColumn] ?? ""
  }
  return out
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  await assertApiAccess(req)
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get("file")
    const configRaw = formData.get("config")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (typeof configRaw !== "string") {
      return NextResponse.json({ error: "No config provided" }, { status: 400 })
    }

    const config: RunRequest = JSON.parse(configRaw)

    // Load connection if provided (not needed for LOCAL_DB)
    let connection: { baseUrl?: string | null; credentials: unknown; type: string } | null = null
    if (config.connectionId && config.connectionType !== "LOCAL_DB") {
      connection = await db.connection.findUnique({
        where: { id: config.connectionId },
        select: { baseUrl: true, credentials: true, type: true },
      })
      if (!connection) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 })
      }
    }

    // Parse the Excel file
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())

    const ws = workbook.getWorksheet(config.sheetName)
    if (!ws) {
      return NextResponse.json({ error: `Sheet "${config.sheetName}" not found` }, { status: 400 })
    }

    // Read headers from the specified row
    const headerRow = ws.getRow(config.headerRow)
    const headers: string[] = []
    headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      headers[colNum - 1] = String(cell.value ?? `Column ${colNum}`).trim()
    })

    // Collect all data rows
    const dataRows: Record<string, string>[] = []
    ws.eachRow((row, rowNum) => {
      if (rowNum <= config.headerRow) return
      const rowData: Record<string, string> = {}
      headers.forEach((header, i) => {
        rowData[header] = String(row.getCell(i + 1).value ?? "").trim()
      })
      dataRows.push(rowData)
    })

    const totalRows = dataRows.length
    let succeededRows = 0
    let failedRows = 0
    const errorLog: RowError[] = []

    // Create ImportJob record
    const job = await db.importJob.create({
      data: {
        name: config.jobName,
        fileName: file.name,
        connectionId: config.connectionType === "LOCAL_DB" ? null : config.connectionId,
        connectionType: config.connectionType,
        targetObject: config.targetObject,
        sheetName: config.sheetName,
        headerRow: config.headerRow,
        columnMappings: config.mappings as object[],
        status: "RUNNING",
        totalRows,
      },
    })

    // Process rows
    for (let i = 0; i < dataRows.length; i++) {
      const rawRow = dataRows[i]
      const transformedRow = transformRow(rawRow, config.mappings)
      const dataRowNum = config.headerRow + i + 1

      try {
        const ct = config.connectionType
        const creds = (connection?.credentials ?? {}) as Record<string, string>

        if (ct === "LOCAL_DB") {
          await executeLocalDb(transformedRow, config.targetObject)
        } else if (ct === "SOFTONE") {
          await executeSoftone(transformedRow, config.targetObject)
        } else if (ct === "SHOPIFY") {
          await executeShopify(transformedRow, creds, config.targetObject)
        } else if (["WOOCOMMERCE", "MAGENTO", "CUSTOM_REST"].includes(ct)) {
          await executeRest(transformedRow, connection!, config.targetObject)
        }
        succeededRows++
      } catch (err) {
        failedRows++
        errorLog.push({ row: dataRowNum, error: (err as Error).message })
        if (!config.skipErrors) break
      }
    }

    const finalStatus = failedRows === 0 ? "DONE"
      : succeededRows === 0 ? "FAILED"
      : "DONE"

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        processedRows: succeededRows + failedRows,
        succeededRows,
        failedRows,
        errorLog: errorLog.length ? JSON.stringify(errorLog) : null,
      },
    })

    return NextResponse.json({
      jobId: job.id,
      totalRows,
      succeededRows,
      failedRows,
      status: finalStatus,
      errors: errorLog.slice(0, 50), // return first 50 errors
    })
  } catch (err) {
    console.error("[POST /api/import/run]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Import failed" },
      { status: 500 },
    )
  }
}
