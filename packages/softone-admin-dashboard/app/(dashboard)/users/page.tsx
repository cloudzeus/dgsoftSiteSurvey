import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UsersTable } from "@/components/users/users-table"

export const metadata = { title: "Users" }

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const currentUser = session.user as { id?: string; role?: string; email?: string }
  if (currentUser.role !== "ADMIN") {
    redirect("/dashboard")
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Users
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            {users.length} user{users.length !== 1 ? "s" : ""} · manage accounts and roles
          </p>
        </div>
      </div>

      <UsersTable users={users} currentUserId={currentUser.id ?? ""} />
    </div>
  )
}
