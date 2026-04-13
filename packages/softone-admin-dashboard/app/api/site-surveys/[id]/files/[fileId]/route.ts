import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bunnyDelete } from "@/lib/bunny"

type Params = { params: Promise<{ id: string; fileId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { id, fileId } = await params
  const surveyId = parseInt(id, 10)
  const fId      = parseInt(fileId, 10)
  if (isNaN(surveyId) || isNaN(fId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const [file] = await db.$queryRaw<{ cdnUrl: string }[]>`
      SELECT cdnUrl FROM File WHERE id = ${fId} AND surveyId = ${surveyId}
    `
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await bunnyDelete(file.cdnUrl)
    await db.$executeRaw`DELETE FROM File WHERE id = ${fId} AND surveyId = ${surveyId}`

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
