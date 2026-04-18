import { db } from "@/lib/db"
import { CustomersTable } from "@/components/customers/customers-table"
import type { CustomerRow } from "@/components/customers/customer-dialog"

export const metadata = { title: "Customers" }

export default async function CustomersPage() {
  const [customers, total, users] = await Promise.all([
    db.customer.findMany({
      orderBy: { name: "asc" },
      take: 25,
      include: { branches: { select: { id: true, name: true, code: true }, orderBy: { name: "asc" } } },
    }),
    db.customer.count(),
    db.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ])

  const rows: CustomerRow[] = customers.map((c) => ({
    ...c,
    insdate:          c.insdate?.toISOString() ?? null,
    upddate:          c.upddate?.toISOString() ?? null,
    registrationDate: c.registrationDate?.toISOString() ?? null,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          Customers
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
          Manage customers synced with Softone ERP
        </p>
      </div>
      <CustomersTable initialCustomers={rows} total={total} users={users} />
    </div>
  )
}
