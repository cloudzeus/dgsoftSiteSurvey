import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RbacMatrix } from "@/components/roles/rbac-matrix"
import { RBAC_MATRIX_RESOURCES } from "@/lib/rbac-resources"

export const metadata = { title: "Roles & Permissions" }

interface RolesPageProps {
  params: Promise<{ locale: string }>
}

export default async function RolesPage({ params }: RolesPageProps) {
  const { locale } = await params

  const session = await auth()
  if (!session) redirect(`/${locale}/login`)

  const currentUser = session.user as { role?: string }
  if (currentUser.role !== "ADMIN") redirect(`/${locale}/dashboard`)

  const rows = await db.rolePermission.findMany({
    orderBy: [{ role: "asc" }, { resource: "asc" }],
  })

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Roles &amp; Permissions
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Configure what each role can read, add, edit, or delete. ADMIN always has full access.
        </p>
      </div>

      <RbacMatrix initialRows={rows} resources={RBAC_MATRIX_RESOURCES} />
    </div>
  )
}
