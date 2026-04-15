// GET /api/site-surveys/[id]/history
// Returns audit trail of all answer changes across all sections for a survey.

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  await assertApiAccess(req)

  const { id } = await params
  const surveyId = Number(id)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const history = await db.surveyResultHistory.findMany({
    where: { surveyId },
    include: {
      question: { select: { key: true, label: true, section: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200, // cap to last 200 changes
  })

  return NextResponse.json({ history })
}
