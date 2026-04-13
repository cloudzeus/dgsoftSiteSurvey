import { db } from "@/lib/db"
import { AuditTable } from "@/components/audit/audit-table"

export const metadata = { title: "Audit Trail" }

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; configId?: string }>
}) {
  const { page, action, configId } = await searchParams
  const currentPage = Number(page ?? "1")
  const pageSize = 50
  const skip = (currentPage - 1) * pageSize

  const where = {
    ...(action ? { action } : {}),
    ...(configId ? { syncConfigId: configId } : {}),
  }

  const [records, total] = await Promise.all([
    db.syncAudit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.syncAudit.count({ where }),
  ])

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Audit Trail
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {total.toLocaleString()} audit record{total !== 1 ? "s" : ""}
          {action ? ` · filtered by ${action}` : ""}
        </p>
      </div>

      <AuditTable records={records} total={total} page={currentPage} pageSize={pageSize} />
    </div>
  )
}
