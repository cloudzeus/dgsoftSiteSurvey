import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

// GET /api/site-surveys/:id/results
// Returns all saved answers for a survey, keyed by question.key for easy form hydration.
export async function GET(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const surveyId = Number(id)

  const results = await db.surveyResult.findMany({
    where: { surveyId },
    include: { question: { select: { key: true, section: true, type: true } } },
  })

  // Shape: { [question.key]: answerValue }
  const byKey = Object.fromEntries(
    results.map((r) => [r.question.key, r.answerValue])
  )

  return NextResponse.json({ results, byKey })
}

// POST /api/site-surveys/:id/results
// Body: { answers: Record<questionKey, string | null> }
// Upserts one SurveyResult row per answer. Safe to call multiple times (idempotent).
export async function POST(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const surveyId = Number(id)

  const body = await req.json()
  const answers: Record<string, string | null> = body.answers ?? {}

  // Verify the survey exists
  const survey = await db.siteSurvey.findUnique({ where: { id: surveyId } })
  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  // Resolve all referenced question keys in one query
  const keys = Object.keys(answers)
  const questions = await db.surveyQuestion.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  })

  const keyToId = Object.fromEntries(questions.map((q) => [q.key, q.id]))

  const upserts = keys
    .filter((key) => keyToId[key] !== undefined)
    .map((key) =>
      db.surveyResult.upsert({
        where: { surveyId_questionId: { surveyId, questionId: keyToId[key] } },
        update: { answerValue: answers[key] },
        create: { surveyId, questionId: keyToId[key], answerValue: answers[key] },
      })
    )

  await db.$transaction(upserts)

  return NextResponse.json({ saved: upserts.length })
}
