import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await assertApiAccess(req)
  const { id: rawId } = await params
  const id = Number(rawId)

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = await req.json()
  const { name, description, customerId, surveyorId, sections, status, type, date, branchIds } = body

  const survey = await db.siteSurvey.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(customerId !== undefined && { customerId: Number(customerId) }),
      ...(surveyorId !== undefined && surveyorId !== "system" && { surveyorId }),
      ...(branchIds !== undefined && { branchIds }),
      ...(sections !== undefined && { sections }),
      ...(status !== undefined && { status }),
      ...(type !== undefined && { type }),
    },
    include: {
      customer: { select: { id: true, name: true } },
      surveyor: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(survey)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await assertApiAccess(req)
  const { id: rawId } = await params
  const id = Number(rawId)

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  await db.siteSurvey.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
