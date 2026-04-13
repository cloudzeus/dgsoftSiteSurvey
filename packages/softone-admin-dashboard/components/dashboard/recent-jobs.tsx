import { formatDistanceToNow } from "date-fns"
import { StatusBadge } from "@/components/ui/status-badge"
import { ArrowRight, Inbox } from "lucide-react"
import Link from "next/link"

interface Job {
  id: string
  status: string
  operation: string
  createdAt: Date
  recordsSuccessful: number
  recordsFailed: number
  syncConfig: { objectName: string; tableName: string }
}

export function RecentJobs({ jobs }: { jobs: Job[] }) {
  return (
    <div
      className="rounded-xl overflow-x-auto"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
            Recent Jobs
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            Last {jobs.length} sync operations
          </p>
        </div>
        <Link
          href="/jobs"
          className="flex items-center gap-1 text-[12px] font-medium transition-colors"
          style={{ color: "var(--primary)" }}
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* Table header */}
      {jobs.length > 0 && (
        <div
          className="grid px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide"
          style={{
            color: "var(--foreground-subtle)",
            background: "#fafafa",
            borderBottom: "1px solid var(--border)",
            gridTemplateColumns: "1fr 120px 80px 100px 80px",
          }}
        >
          <span>Config</span>
          <span>Status</span>
          <span>Operation</span>
          <span>Records</span>
          <span>When</span>
        </div>
      )}

      {/* Rows */}
      <div>
        {jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14">
            <div
              className="size-12 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                boxShadow: "0 4px 12px rgba(49,46,129,0.35)",
              }}
            >
              <Inbox className="size-5 text-white" />
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
              No jobs yet
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--foreground-subtle)" }}>
              Create a sync configuration to get started
            </p>
          </div>
        )}

        {jobs.map((job, i) => (
          <div
            key={job.id}
            className="grid items-center px-5 py-3 transition-colors cursor-default"
            style={{
              gridTemplateColumns: "1fr 120px 80px 100px 80px",
              borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>
                {job.syncConfig.objectName}
              </p>
              <p className="text-[11px] font-mono truncate" style={{ color: "var(--foreground-muted)" }}>
                {job.syncConfig.tableName}
              </p>
            </div>

            <div><StatusBadge status={job.status} /></div>

            <div>
              {(() => {
                const OP: Record<string, { bg: string; color: string; border: string }> = {
                  FETCH:  { bg: "#eef2ff", color: "#4338ca", border: "#e0e7ff" },
                  INSERT: { bg: "#f0fdf4", color: "#15803d", border: "#dcfce7" },
                  UPDATE: { bg: "#ecfeff", color: "#0e7490", border: "#cffafe" },
                  DELETE: { bg: "#fef2f2", color: "#b91c1c", border: "#fee2e2" },
                }
                const s = OP[job.operation] ?? { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb" }
                return (
                  <code
                    className="text-[11px] px-2 py-0.5 rounded-md font-mono font-medium"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                  >
                    {job.operation}
                  </code>
                )
              })()}
            </div>

            <div className="flex items-center gap-2">
              {job.recordsSuccessful > 0 && (
                <span className="text-[12px] font-semibold" style={{ color: "#16a34a" }}>
                  +{job.recordsSuccessful}
                </span>
              )}
              {job.recordsFailed > 0 && (
                <span className="text-[12px] font-semibold" style={{ color: "#dc2626" }}>
                  -{job.recordsFailed}
                </span>
              )}
              {job.recordsSuccessful === 0 && job.recordsFailed === 0 && (
                <span style={{ color: "var(--foreground-subtle)" }}>—</span>
              )}
            </div>

            <div
              className="text-[11px]"
              style={{ color: "var(--foreground-subtle)" }}
            >
              {formatDistanceToNow(job.createdAt, { addSuffix: true })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
