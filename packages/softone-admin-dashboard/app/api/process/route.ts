import { NextResponse, after } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { processingEngine } from "@/lib/processing-engine"

export async function POST(req: Request) {
  await assertApiAccess(req)
  const { entityId } = await req.json()
  if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 })

  const entity = await db.pipelineEntity.findUnique({ where: { id: entityId }, select: { id: true, name: true } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  after(async () => {
    try {
      await processingEngine(entityId)
    } catch (err) {
      console.error(`Processing engine error for ${entityId}:`, err)
    }
  })

  return NextResponse.json({ ok: true, message: `Processing started for ${entity.name}` }, { status: 202 })
}
