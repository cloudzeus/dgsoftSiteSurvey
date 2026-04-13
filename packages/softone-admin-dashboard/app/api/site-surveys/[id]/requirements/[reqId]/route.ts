import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bunnyUpload, bunnyDelete } from "@/lib/bunny"
import path from "path"

type Params = { params: Promise<{ id: string; reqId: string }> }

const MAX_BYTES = 50 * 1024 * 1024
const VALID_SECTIONS = ["SOFTWARE", "WEB_ECOMMERCE", "IOT_AI", "HARDWARE_NETWORK", "COMPLIANCE"]

type RequirementRow = {
  id: number; surveyId: number; section: string; title: string
  description: string | null
  fileUrl: string | null; filePath: string | null; fileName: string | null
  fileMimeType: string | null; fileSize: number | null
  createdAt: Date; updatedAt: Date
}

export async function PATCH(req: Request, { params }: Params) {
  const { id, reqId } = await params
  const surveyId = parseInt(id, 10)
  const reqIdNum = parseInt(reqId, 10)
  if (isNaN(surveyId) || isNaN(reqIdNum))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const [existing] = await db.$queryRaw<RequirementRow[]>`
      SELECT * FROM ClientRequirement WHERE id = ${reqIdNum} AND surveyId = ${surveyId}
    `
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const [survey] = await db.$queryRaw<{ customerId: number }[]>`
      SELECT customerId FROM SiteSurvey WHERE id = ${surveyId}
    `
    if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

    const formData    = await req.formData()
    const section     = (formData.get("section")     as string | null)?.trim() || existing.section
    const title       = (formData.get("title")       as string | null)?.trim() || existing.title
    const description = (formData.get("description") as string | null)?.trim() || null
    const file        = formData.get("file") as File | null
    const removeFile  = formData.get("removeFile") === "true"

    if (!VALID_SECTIONS.includes(section))
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })

    let fileUrl      = existing.fileUrl
    let filePath     = existing.filePath
    let fileName     = existing.fileName
    let fileMimeType = existing.fileMimeType
    let fileSize     = existing.fileSize

    if (removeFile && existing.fileUrl) {
      await bunnyDelete(existing.fileUrl)
      fileUrl = null; filePath = null; fileName = null; fileMimeType = null; fileSize = null
    }

    if (file && file.size > 0) {
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 })
      if (existing.fileUrl) await bunnyDelete(existing.fileUrl)
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
      UPDATE ClientRequirement
      SET section = ${section}, title = ${title}, description = ${description},
          fileUrl = ${fileUrl}, filePath = ${filePath}, fileName = ${fileName},
          fileMimeType = ${fileMimeType}, fileSize = ${fileSize}, updatedAt = NOW()
      WHERE id = ${reqIdNum}
    `

    const [updated] = await db.$queryRaw<RequirementRow[]>`
      SELECT id, surveyId, section, title, description,
             fileUrl, filePath, fileName, fileMimeType, fileSize,
             createdAt, updatedAt
      FROM ClientRequirement WHERE id = ${reqIdNum}
    `

    return NextResponse.json(updated)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, reqId } = await params
  const surveyId = parseInt(id, 10)
  const reqIdNum = parseInt(reqId, 10)
  if (isNaN(surveyId) || isNaN(reqIdNum))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const [existing] = await db.$queryRaw<RequirementRow[]>`
      SELECT id, fileUrl FROM ClientRequirement WHERE id = ${reqIdNum} AND surveyId = ${surveyId}
    `
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (existing.fileUrl) await bunnyDelete(existing.fileUrl)

    await db.$executeRaw`DELETE FROM ClientRequirement WHERE id = ${reqIdNum}`

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
