import { db } from "@/lib/db"
import { SurveyQuestionsTable } from "@/components/master-options/survey-questions-table"

export const metadata = { title: "Survey Questions" }

export default async function SurveyQuestionsPage() {
  const questions = await db.surveyQuestion.findMany({
    orderBy: [{ section: "asc" }, { order: "asc" }],
  })

  const rows = questions.map(q => ({
    id: q.id,
    section: q.section,
    key: q.key,
    label: q.label,
    type: q.type,
    optionsSource: q.optionsSource ?? null,
    options: Array.isArray(q.options) ? (q.options as string[]) : null,
    order: q.order,
    isActive: q.isActive,
  }))

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Survey Questions
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {questions.length} question{questions.length !== 1 ? "s" : ""} · questionnaire fields shown in the site survey wizard
        </p>
      </div>
      <SurveyQuestionsTable initialQuestions={rows} />
    </div>
  )
}
