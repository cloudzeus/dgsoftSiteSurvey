import { db } from "@/lib/db"
import { DLQTable } from "@/components/dlq/dlq-table"

export const metadata = { title: "Dead Letter Queue" }

export default async function DLQPage() {
  const [items, total, critical] = await Promise.all([
    db.syncJobDLQ.findMany({
      where: { requiresManualReview: true },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    }),
    db.syncJobDLQ.count({ where: { requiresManualReview: true } }),
    db.syncJobDLQ.count({ where: { requiresManualReview: true, severity: "CRITICAL" } }),
  ])

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Dead Letter Queue
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            {total} item{total !== 1 ? "s" : ""} requiring manual review
            {critical > 0 && (
              <span className="ml-2 font-semibold" style={{ color: "#dc2626" }}>
                · {critical} critical
              </span>
            )}
          </p>
        </div>

        {total > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold"
            style={{
              background: critical > 0 ? "#fef2f2" : "#fef3c7",
              color: critical > 0 ? "#dc2626" : "#92400e",
              border: `1px solid ${critical > 0 ? "#fecaca" : "#fde68a"}`,
            }}
          >
            {critical > 0 ? "⚠️ Action required" : "🔶 Review pending"}
          </div>
        )}
      </div>

      <DLQTable items={items} />
    </div>
  )
}
