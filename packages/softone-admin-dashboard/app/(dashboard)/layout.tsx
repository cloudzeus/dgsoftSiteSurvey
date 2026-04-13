import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { db } from "@/lib/db"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, menuEntities] = await Promise.all([
    auth(),
    db.pipelineEntity.findMany({
      where: { showInMenu: true, isActive: true },
      select: { id: true, menuLabel: true, menuIcon: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  if (!session) redirect("/login")

  const entityMenuItems = menuEntities.map((e) => ({
    id: e.id,
    label: e.menuLabel ?? e.name,
    icon: e.menuIcon ?? "Database",
  }))

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      <Sidebar user={session.user as any} entityMenuItems={entityMenuItems} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
