import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bunnyUpload } from "@/lib/bunny"
import path from "path"

type Params = { params: Promise<{ id: string }> }

const MAX_BYTES = 50 * 1024 * 1024

const VALID_SECTIONS = ["SOFTWARE", "WEB_ECOMMERCE", "IOT_AI", "HARDWARE_NETWORK", "COMPLIANCE"]

type RequirementRow = {
  id: number; surveyId: number; section: string; source: string; title: string
  description: string | null
  fileUrl: string | null; filePath: string | null; fileName: string | null
  fileMimeType: string | null; fileSize: number | null
  createdAt: Date; updatedAt: Date
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const url    = new URL(req.url)
  const source = url.searchParams.get("source") // optional filter: CUSTOMER | COMPANY

  try {
    const rows = source
      ? await db.$queryRaw<RequirementRow[]>`
          SELECT id, surveyId, section, source, title, description,
                 fileUrl, filePath, fileName, fileMimeType, fileSize,
                 createdAt, updatedAt
          FROM ClientRequirement
          WHERE surveyId = ${surveyId} AND source = ${source}
          ORDER BY section ASC, createdAt ASC
        `
      : await db.$queryRaw<RequirementRow[]>`
          SELECT id, surveyId, section, source, title, description,
                 fileUrl, filePath, fileName, fileMimeType, fileSize,
                 createdAt, updatedAt
          FROM ClientRequirement
          WHERE surveyId = ${surveyId}
          ORDER BY section ASC, createdAt ASC
        `
    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const [survey] = await db.$queryRaw<{ customerId: number }[]>`
      SELECT customerId FROM SiteSurvey WHERE id = ${surveyId}
    `
    if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

    const formData    = await req.formData()
    const section     = (formData.get("section")     as string | null)?.trim() ?? ""
    const title       = (formData.get("title")       as string | null)?.trim() ?? ""
    const description = (formData.get("description") as string | null)?.trim() || null
    const source      = (formData.get("source")      as string | null)?.trim() || "CUSTOMER"
    const file        = formData.get("file") as File | null

    if (!title)                              return NextResponse.json({ error: "title is required" }, { status: 400 })
    if (!VALID_SECTIONS.includes(section))   return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    if (!["CUSTOMER", "COMPANY"].includes(source)) return NextResponse.json({ error: "Invalid source" }, { status: 400 })

    let fileUrl: string | null      = null
    let filePath: string | null     = null
    let fileName: string | null     = null
    let fileMimeType: string | null = null
    let fileSize: number | null     = null

    if (file && file.size > 0) {
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 })
      const ext    = path.extname(file.name) || ""
      const slug   = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
      filePath     = `requirement-files/${survey.customerId}/${surveyId}/${slug}`
      const buffer = Buffer.from(await file.arrayBuffer())
      fileUrl      = await bunnyUpload(filePath, buffer, file.type || "application/octet-stream")
      fileName     = file.name || slug
      fileMimeType = file.type || "application/octet-stream"
      fileSize     = file.size
    }

    await db.$executeRaw`
      INSERT INTO ClientRequirement
        (surveyId, section, source, title, description, fileUrl, filePath, fileName, fileMimeType, fileSize, createdAt, updatedAt)
      VALUES
        (${surveyId}, ${section}, ${source}, ${title}, ${description},
         ${fileUrl}, ${filePath}, ${fileName}, ${fileMimeType}, ${fileSize},
         NOW(), NOW())
    `

    const [row] = await db.$queryRaw<RequirementRow[]>`
      SELECT id, surveyId, section, source, title, description,
             fileUrl, filePath, fileName, fileMimeType, fileSize,
             createdAt, updatedAt
      FROM ClientRequirement WHERE id = LAST_INSERT_ID()
    `

    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
