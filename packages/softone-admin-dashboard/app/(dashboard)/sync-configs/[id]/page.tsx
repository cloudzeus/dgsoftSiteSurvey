import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { formatDistanceToNow, format } from "date-fns"
import { StatusBadge } from "@/components/ui/status-badge"
import { ChevronLeft } from "lucide-react"

export const metadata = { title: "Sync Config Details" }

function JobStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: "#16a34a",
    IN_PROGRESS: "#6366f1",
    FAILED: "#dc2626",
    PARTIAL_FAILURE: "#f59e0b",
    PENDING: "#9ca3af",
  }
  return (
    <span
      className="inline-block size-2 rounded-full flex-shrink-0"
      style={{ background: colors[status] ?? "#9ca3af" }}
    />
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default async function SyncConfigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const config = await db.syncConfig.findUnique({
    where: { id },
    include: {
      fieldMappings: { orderBy: [{ isPrimaryKey: "desc" }, { softoneFieldName: "asc" }] },
      syncJobs: { orderBy: { createdAt: "desc" }, take: 50 },
      _count: { select: { syncJobs: true, fieldMappings: true } },
    },
  })

  if (!config) notFound()

  const isPersistent = (config as any).usageType !== "REFERENCE"

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <Link
          href="/sync-configs"
          className="inline-flex items-center gap-1.5 text-[12px] mb-3 transition-colors"
          style={{ color: "var(--foreground-muted)" }}
        >
          <ChevronLeft className="size-3.5" />
          Back to Sync Configs
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
              {config.objectName}
              <span className="ml-2 font-mono text-[16px]" style={{ color: "var(--foreground-muted)" }}>
                / {config.tableName}
              </span>
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <StatusBadge status={config.isActive ? config.syncDirection : "INACTIVE"} />
              <span
                className="text-[11px] px-2 py-0.5 rounded font-mono"
                style={{ background: "var(--muted)", color: "var(--foreground-muted)" }}
              >
                {isPersistent ? "Persistent" : "Reference"}
              </span>
              <span className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
                {config._count.syncJobs} jobs · {config._count.fieldMappings} fields
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Config details + Field mappings */}
      <div className="grid grid-cols-3 gap-4">
        {/* Details */}
        <Card title="Configuration">
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {[
              ["Object", config.objectName],
              ["Table", config.tableName],
              ["Usage", isPersistent ? "Persistent Table" : "Reference / Lookup"],
              ["Direction", config.syncDirection],
              ["Schedule", config.syncSchedule],
              ["Conflict", config.conflictStrategy.replace(/_/g, " ")],
              ["Batch size", String(config.batchSize)],
              ["Last synced", config.lastSyncedAt
                ? format(config.lastSyncedAt, "dd MMM yyyy HH:mm")
                : "Never"],
              ["Created", format(config.createdAt, "dd MMM yyyy")],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between px-5 py-2.5 text-[12px]">
                <span style={{ color: "var(--foreground-muted)" }}>{label}</span>
                <span className="font-medium text-right" style={{ color: "var(--foreground)" }}>{val}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Field mappings */}
        <div className="col-span-2">
          <Card title={`Field Mappings (${config.fieldMappings.length})`}>
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Softone Field", "Local Column", "Type", "PK", "TS", "Sync"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--foreground-subtle)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {config.fieldMappings.map((f) => (
                    <tr key={f.id} style={{ opacity: f.isSyncable ? 1 : 0.4 }}>
                      <td className="px-4 py-2 font-mono" style={{ color: "var(--foreground)" }}>{f.softoneFieldName}</td>
                      <td className="px-4 py-2 font-mono" style={{ color: "var(--foreground-muted)" }}>{f.localColumnName}</td>
                      <td className="px-4 py-2" style={{ color: "var(--foreground-muted)" }}>{f.dataType.slice(0, 5)}</td>
                      <td className="px-4 py-2 text-center">{f.isPrimaryKey ? "✓" : ""}</td>
                      <td className="px-4 py-2 text-center">{f.isTimestamp ? "✓" : ""}</td>
                      <td className="px-4 py-2 text-center">{f.isSyncable ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* Sync job history */}
      <Card title="Sync Job History (last 50)">
        {config.syncJobs.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            No sync jobs yet. Run a sync to see logs here.
          </p>
        ) : (
          <table className="w-full text-[12px]">
            <thead style={{ borderBottom: "1px solid var(--border)" }}>
              <tr>
                {["Status", "Operation", "Processed", "Success", "Failed", "Retries", "Duration", "Started", "Error"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--foreground-subtle)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {config.syncJobs.map((job) => {
                const duration = job.completedAt
                  ? Math.round((job.completedAt.getTime() - job.createdAt.getTime()) / 1000)
                  : null
                return (
                  <tr key={job.id}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <JobStatusDot status={job.status} />
                        <span style={{ color: "var(--foreground)" }}>{job.status.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--foreground-muted)" }}>{job.operation}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--foreground)" }}>{job.recordsProcessed}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "#16a34a" }}>{job.recordsSuccessful}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: job.recordsFailed > 0 ? "#dc2626" : "var(--foreground-muted)" }}>
                      {job.recordsFailed}
                    </td>
                    <td className="px-4 py-2.5 text-center" style={{ color: "var(--foreground-muted)" }}>{job.retryCount}</td>
                    <td className="px-4 py-2.5" style={{ color: "var(--foreground-muted)" }}>
                      {duration !== null ? `${duration}s` : "—"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--foreground-muted)" }}>
                      {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate" style={{ color: "#dc2626" }} title={job.errorMessage ?? ""}>
                      {job.errorMessage ?? ""}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
