"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { StatusBadge } from "@/components/ui/status-badge"
import { RotateCcw, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { retryJob } from "@/app/actions/jobs"

interface Job {
  id: string
  status: string
  operation: string
  retryCount: number
  maxRetries: number
  totalRecords: number
  recordsSuccessful: number
  recordsFailed: number
  errorMessage: string | null
  createdAt: Date
  completedAt: Date | null
  syncConfig: { objectName: string; tableName: string }
}

const RETRYABLE = ["FAILED", "PARTIAL_FAILURE"]

const OP_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  FETCH:  { bg: "#eef2ff", color: "#4338ca", border: "#e0e7ff" },
  INSERT: { bg: "#f0fdf4", color: "#15803d", border: "#dcfce7" },
  UPDATE: { bg: "#ecfeff", color: "#0e7490", border: "#cffafe" },
  DELETE: { bg: "#fef2f2", color: "#b91c1c", border: "#fee2e2" },
}

function OperationBadge({ op }: { op: string }) {
  const s = OP_STYLE[op] ?? { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb" }
  return (
    <code
      className="text-[11px] px-2 py-0.5 rounded-md font-mono font-medium"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {op}
    </code>
  )
}

export function JobsTable({ jobs, total, page, pageSize }: {
  jobs: Job[]
  total: number
  page: number
  pageSize: number
}) {
  const totalPages = Math.ceil(total / pageSize)
  const [retrying, setRetrying] = useState<string | null>(null)

  async function handleRetry(jobId: string) {
    setRetrying(jobId)
    try { await retryJob(jobId) } finally { setRetrying(null) }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl overflow-x-auto"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid var(--border)" }}>
              {["Config", "Status", "Op", "Records", "Retries", "Created", "Error", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-subtle)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-16">
                    <div
                      className="size-12 rounded-2xl flex items-center justify-center mb-3"
                      style={{
                        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.3)",
                      }}
                    >
                      <ClipboardList className="size-5 text-white" />
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                      No jobs found
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {jobs.map((job, i) => (
              <tr
                key={job.id}
                className="transition-colors"
                style={{ borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td className="px-4 py-3.5">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {job.syncConfig.objectName}
                  </p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                    {job.syncConfig.tableName}
                  </p>
                </td>
                <td className="px-4 py-3.5"><StatusBadge status={job.status} /></td>
                <td className="px-4 py-3.5">
                  <OperationBadge op={job.operation} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      {job.recordsSuccessful > 0 && (
                        <span className="text-[13px] font-semibold" style={{ color: "#16a34a" }}>
                          +{job.recordsSuccessful}
                        </span>
                      )}
                      {job.recordsFailed > 0 && (
                        <span className="text-[13px] font-semibold" style={{ color: "#dc2626" }}>
                          -{job.recordsFailed}
                        </span>
                      )}
                      {job.totalRecords > 0 && (
                        <span className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
                          / {job.totalRecords}
                        </span>
                      )}
                      {!job.recordsSuccessful && !job.recordsFailed && !job.totalRecords && (
                        <span style={{ color: "var(--foreground-subtle)" }}>—</span>
                      )}
                    </div>
                    {job.status === "IN_PROGRESS" && job.totalRecords > 0 && (
                      <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            background: "#16a34a",
                            width: `${Math.min(100, Math.round(((job.recordsSuccessful + job.recordsFailed) / job.totalRecords) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[12px]" style={{ color: job.retryCount > 0 ? "#dc2626" : "var(--foreground-muted)" }}>
                      {job.retryCount}
                    </span>
                    <span style={{ color: "var(--foreground-subtle)" }}>/</span>
                    <span className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>{job.maxRetries}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                  {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                </td>
                <td className="px-4 py-3.5 max-w-[200px]">
                  {job.errorMessage ? (
                    <p
                      className="text-[11px] truncate font-mono"
                      style={{ color: "#dc2626" }}
                      title={job.errorMessage}
                    >
                      {job.errorMessage}
                    </p>
                  ) : (
                    <span style={{ color: "var(--foreground-subtle)" }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {RETRYABLE.includes(job.status) && (
                    <Btn
                      variant="ghost"
                      size="icon-sm"
                      loading={retrying === job.id}
                      title="Retry job"
                      onClick={() => handleRetry(job.id)}
                      style={{ color: "var(--primary)" }}
                    >
                      <RotateCcw className="size-3.5" />
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <a
              href={page > 1 ? `?page=${page - 1}` : "#"}
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: page <= 1 ? "var(--foreground-subtle)" : "var(--foreground)",
                pointerEvents: page <= 1 ? "none" : "auto",
                opacity: page <= 1 ? 0.4 : 1,
              }}
            >
              <ChevronLeft className="size-3.5" />
            </a>
            <span
              className="px-3 h-8 flex items-center rounded-lg text-[12px] font-medium"
              style={{
                border: "1px solid var(--primary)",
                background: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              {page} / {totalPages}
            </span>
            <a
              href={page < totalPages ? `?page=${page + 1}` : "#"}
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: page >= totalPages ? "var(--foreground-subtle)" : "var(--foreground)",
                pointerEvents: page >= totalPages ? "none" : "auto",
                opacity: page >= totalPages ? 0.4 : 1,
              }}
            >
              <ChevronRight className="size-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
