import { db } from "@/lib/db"
import { SiteSurveysTable } from "@/components/site-survey/site-surveys-table"
import { getTranslations } from "next-intl/server"

export const metadata = { title: "Site Survey" }
export const dynamic = "force-dynamic"

export default async function SiteSurveyPage() {
  const t = await getTranslations("survey")
  const [surveys, total, users, customerOptions] = await Promise.all([
    db.siteSurvey.findMany({
      where: { type: "SURVEY" },
      orderBy: { date: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        surveyor: { select: { id: true, name: true, email: true } },
        invitations: {
          where: { completedAt: { not: null } },
          select: { sectionKey: true, email: true, completedAt: true },
          orderBy: { completedAt: "desc" },
        },
      },
    }),
    db.siteSurvey.count({ where: { type: "SURVEY" } }),
    db.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.customer.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const rows = surveys.map((s) => ({
    ...s,
    date: s.date.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    branchIds: s.branchIds as number[],
    sections: s.sections as string[],
    invitations: s.invitations.map(i => ({
      ...i,
      completedAt: i.completedAt!.toISOString(),
    })),
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
          {t("description")}
        </p>
      </div>
      <SiteSurveysTable surveys={rows} total={total} users={users} customerOptions={customerOptions} />
    </div>
  )
}
