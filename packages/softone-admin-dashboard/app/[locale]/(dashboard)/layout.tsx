import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { db } from "@/lib/db"

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { locale } = await params

  const [session, menuEntities] = await Promise.all([
    auth(),
    db.pipelineEntity.findMany({
      where: { showInMenu: true, isActive: true },
      select: { id: true, menuLabel: true, menuIcon: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  if (!session) redirect(`/${locale}/login`)

  const entityMenuItems = menuEntities.map((e) => ({
    id: e.id,
    label: e.menuLabel ?? e.name,
    icon: e.menuIcon ?? "Database",
  }))

  const licenseData = {
    serial: process.env.SOFTWARE_SERIAL ?? "",
    vendor: process.env.SOFTWARE_COMPANY_VENTOR?.replace(/^"|"$/g, "").trim() ?? "",
    buyer: process.env.SOFTWARE_COMPANY_BUYER?.replace(/^"|"$/g, "").trim() ?? "",
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      <Sidebar user={session.user as any} entityMenuItems={entityMenuItems} licenseData={licenseData} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
