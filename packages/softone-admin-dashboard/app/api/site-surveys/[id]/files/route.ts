import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bunnyUpload } from "@/lib/bunny"
import path from "path"

type Params = { params: Promise<{ id: string }> }

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const url     = new URL(req.url)
  const section = url.searchParams.get("section") || null

  try {
    type FileRow = {
      id: number; customerId: number; surveyId: number
      section: string | null; type: string | null
      name: string; cdnUrl: string; bunnyPath: string
      mimeType: string; size: number; uploadedBy: string | null; createdAt: Date
    }

    let files: FileRow[]
    if (section) {
      files = await db.$queryRaw<FileRow[]>`
        SELECT id, customerId, surveyId, section, type, name, cdnUrl, bunnyPath, mimeType, size, uploadedBy, createdAt
        FROM File
        WHERE surveyId = ${surveyId} AND section = ${section}
        ORDER BY createdAt DESC
      `
    } else {
      files = await db.$queryRaw<FileRow[]>`
        SELECT id, customerId, surveyId, section, type, name, cdnUrl, bunnyPath, mimeType, size, uploadedBy, createdAt
        FROM File
        WHERE surveyId = ${surveyId}
        ORDER BY createdAt DESC
      `
    }
    return NextResponse.json(files)
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
    // Resolve customerId from the survey
    const [survey] = await db.$queryRaw<{ customerId: number }[]>`
      SELECT customerId FROM SiteSurvey WHERE id = ${surveyId}
    `
    if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

    const formData = await req.formData()
    const file    = formData.get("file")    as File   | null
    const name    = (formData.get("name")    as string | null)?.trim() || null
    const type    = (formData.get("type")    as string | null)?.trim() || null
    const section = (formData.get("section") as string | null)?.trim() || null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 })

    const ext       = path.extname(file.name) || ""
    const slug      = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    const bunnyPath = `survey-files/${survey.customerId}/${surveyId}/${slug}`
    const buffer    = Buffer.from(await file.arrayBuffer())
    const cdnUrl    = await bunnyUpload(bunnyPath, buffer, file.type || "application/octet-stream")
    const fileName  = name || file.name || slug

    await db.$executeRaw`
      INSERT INTO File (customerId, surveyId, section, type, name, cdnUrl, bunnyPath, mimeType, size, uploadedBy, createdAt)
      VALUES (${survey.customerId}, ${surveyId}, ${section}, ${type}, ${fileName}, ${cdnUrl}, ${bunnyPath},
              ${file.type || "application/octet-stream"}, ${file.size}, NULL, NOW())
    `

    const [row] = await db.$queryRaw<object[]>`
      SELECT id, customerId, surveyId, section, type, name, cdnUrl, bunnyPath, mimeType, size, uploadedBy, createdAt
      FROM File WHERE id = LAST_INSERT_ID()
    `

    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
