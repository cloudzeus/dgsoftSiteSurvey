import { db } from "@/lib/db"
import { auth, microsoftAuthEnabled } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UsersTable } from "@/components/users/users-table"
import { UsersHeader } from "@/components/users/users-header"

export const metadata = { title: "Users" }

interface UsersPageProps {
  params: Promise<{ locale: string }>
}

export default async function UsersPage({ params }: UsersPageProps) {
  const { locale } = await params

  const session = await auth()
  if (!session) redirect(`/${locale}/login`)

  const currentUser = session.user as { id?: string; role?: string; email?: string }
  if (currentUser.role !== "ADMIN") {
    redirect(`/${locale}/dashboard`)
  }

  const users = await db.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      image: true, jobPosition: true,
      phone: true, mobile: true,
      address: true, city: true, zip: true,
      createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return (
    <div className="space-y-6 w-full">
      <UsersHeader count={users.length} microsoftEnabled={microsoftAuthEnabled} />
      <UsersTable users={users} currentUserId={currentUser.id ?? ""} />
    </div>
  )
}
