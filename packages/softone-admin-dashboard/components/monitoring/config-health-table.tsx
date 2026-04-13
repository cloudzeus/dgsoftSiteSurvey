"use client"

import { useState } from "react"
import { formatDistanceToNow, format } from "date-fns"
import { StatusBadge } from "@/components/ui/status-badge"
import { BarChart3, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface RecentJob {
  id: string
  status: string
  createdAt: Date
  completedAt: Date | null
  recordsSuccessful: number
  recordsFailed: number
  recordsProcessed: number
  errorMessage: string | null
}

interface ConfigHealth {
  id: string
  objectName: string
  tableName: string
  lastSyncedAt: Date | null
  lastStatus: string | null
  recentSuccessRate: number | null
  totalJobs: number
  recentJobs: RecentJob[]
}

function durationMs(job: RecentJob): number | null {
  if (!job.completedAt) return null
  return new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function loadRps(job: RecentJob): number | null {
  const ms = durationMs(job)
  if (!ms || ms <= 0 || job.recordsProcessed === 0) return null
  return Math.round((job.recordsProcessed / ms) * 1000 * 10) / 10
}

function successColor(rate: number) {
  if (rate >= 95) return "#16a34a"
  if (rate >= 70) return "#d97706"
  return "#dc2626"
}

export function ConfigHealthTable({ configs }: { configs: ConfigHealth[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div
          className="size-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", boxShadow: "0 4px 12px rgba(15,23,42,0.3)" }}
        >
          <BarChart3 className="size-5 text-white" />
        </div>
        <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
          No active sync configurations
        </p>
      </div>
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr style={{ background: "#fafafa", borderBottom: "1px solid var(--border)" }}>
          <th className="w-8 px-4 py-3" />
          {["Config", "Last Run", "Last Status", "Recent Success", "Total Jobs"].map((h) => (
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
        {configs.map((c, i) => {
          const isOpen = expanded.has(c.id)
          const isLast = i === configs.length - 1

          return (
            <>
              {/* ── Summary row ── */}
              <tr
                key={c.id}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: isOpen || !isLast ? "1px solid var(--border)" : "none" }}
                onClick={() => toggle(c.id)}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "#fafafa" }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "transparent" }}
              >
                {/* Chevron */}
                <td className="w-8 px-4 py-3.5">
                  <ChevronRight
                    className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-90")}
                    style={{ color: "var(--foreground-subtle)" }}
                  />
                </td>

                {/* Config */}
                <td className="px-4 py-3.5">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{c.objectName}</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--foreground-muted)" }}>{c.tableName}</p>
                </td>

                {/* Last Run */}
                <td className="px-4 py-3.5 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                  {c.lastSyncedAt
                    ? formatDistanceToNow(c.lastSyncedAt, { addSuffix: true })
                    : <span style={{ color: "var(--foreground-subtle)" }}>Never</span>}
                </td>

                {/* Last Status */}
                <td className="px-4 py-3.5">
                  {c.lastStatus
                    ? <StatusBadge status={c.lastStatus} />
                    : <span style={{ color: "var(--foreground-subtle)" }}>—</span>}
                </td>

                {/* Recent Success */}
                <td className="px-4 py-3.5">
                  {c.recentSuccessRate !== null ? (
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${c.recentSuccessRate}%`, background: successColor(c.recentSuccessRate) }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: successColor(c.recentSuccessRate) }}>
                        {c.recentSuccessRate}%
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--foreground-subtle)" }}>—</span>
                  )}
                </td>

                {/* Total Jobs */}
                <td className="px-4 py-3.5">
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {c.totalJobs.toLocaleString()}
                  </span>
                </td>
              </tr>

              {/* ── Expanded logs panel ── */}
              {isOpen && (
                <tr
                  key={`${c.id}-expanded`}
                  style={{ borderBottom: !isLast ? "1px solid var(--border)" : "none", background: "#fafafa" }}
                >
                  <td colSpan={6} className="px-6 pb-4 pt-0">
                    {c.recentJobs.length === 0 ? (
                      <p className="text-[12px] py-4 text-center" style={{ color: "var(--foreground-subtle)" }}>No jobs yet</p>
                    ) : (
                      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                        <table className="w-full">
                          <thead>
                            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                              {["Date", "Status", "Duration", "Processed", "✓ OK", "✗ Failed", "Load"].map((h) => (
                                <th
                                  key={h}
                                  className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wide"
                                  style={{ color: "var(--foreground-subtle)" }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {c.recentJobs.map((j, ji) => {
                              const ms = durationMs(j)
                              const rps = loadRps(j)
                              const isLastJob = ji === c.recentJobs.length - 1

                              return (
                                <tr
                                  key={j.id}
                                  style={{
                                    borderBottom: !isLastJob ? "1px solid var(--border)" : "none",
                                    background: "var(--surface)",
                                  }}
                                >
                                  {/* Date */}
                                  <td className="px-3 py-2.5">
                                    <p className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>
                                      {format(new Date(j.createdAt), "MMM d, HH:mm")}
                                    </p>
                                    <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
                                      {j.id.slice(0, 8)}…
                                    </p>
                                  </td>

                                  {/* Status */}
                                  <td className="px-3 py-2.5">
                                    <StatusBadge status={j.status} />
                                    {j.errorMessage && (
                                      <p
                                        className="text-[10px] mt-1 font-mono truncate max-w-40"
                                        style={{ color: "#dc2626" }}
                                        title={j.errorMessage}
                                      >
                                        {j.errorMessage}
                                      </p>
                                    )}
                                  </td>

                                  {/* Duration */}
                                  <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                                    {ms !== null ? formatDuration(ms) : j.status === "IN_PROGRESS" ? (
                                      <span style={{ color: "#4f46e5" }}>Running…</span>
                                    ) : "—"}
                                  </td>

                                  {/* Processed */}
                                  <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                                    {j.recordsProcessed.toLocaleString()}
                                  </td>

                                  {/* OK */}
                                  <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums" style={{ color: "#16a34a" }}>
                                    {j.recordsSuccessful.toLocaleString()}
                                  </td>

                                  {/* Failed */}
                                  <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums" style={{ color: j.recordsFailed > 0 ? "#dc2626" : "var(--foreground-subtle)" }}>
                                    {j.recordsFailed.toLocaleString()}
                                  </td>

                                  {/* Load */}
                                  <td className="px-3 py-2.5">
                                    {rps !== null ? (
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                                          <div
                                            className="h-full rounded-full"
                                            style={{
                                              width: `${Math.min(100, (rps / 50) * 100)}%`,
                                              background: rps >= 20 ? "#16a34a" : rps >= 5 ? "#4f46e5" : "#d97706",
                                            }}
                                          />
                                        </div>
                                        <span
                                          className="text-[11px] font-semibold tabular-nums"
                                          style={{ color: rps >= 20 ? "#16a34a" : rps >= 5 ? "#4f46e5" : "#d97706" }}
                                        >
                                          {rps} r/s
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          )
        })}
      </tbody>
    </table>
  )
}
