import { db } from "@/lib/db"
import { ProjectsTable } from "@/components/site-survey/projects-table"
import { getTranslations } from "next-intl/server"

export const metadata = { title: "Projects" }
export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  const t = await getTranslations("projects")
  const [projects, users, customerOptions] = await Promise.all([
    db.siteSurvey.findMany({
      where: { type: "PROJECT" },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        surveyor: { select: { id: true, name: true, email: true } },
      },
    }),
    db.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.customer.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const rows = projects.map((p) => ({
    ...p,
    date: p.date.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    branchIds: p.branchIds as number[],
    sections: p.sections as string[],
    invitations: [],
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
      <ProjectsTable projects={rows} users={users} customerOptions={customerOptions} />
    </div>
  )
}
