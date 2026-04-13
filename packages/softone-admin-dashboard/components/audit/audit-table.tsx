"use client"

import { formatDistanceToNow } from "date-fns"
import { StatusBadge } from "@/components/ui/status-badge"
import { ChevronLeft, ChevronRight, ScanSearch } from "lucide-react"

interface AuditRecord {
  id: string
  action: string
  recordId: string | null
  syncConfigId: string
  executedBy: string
  createdAt: Date
}

export function AuditTable({
  records,
  total,
  page,
  pageSize,
}: {
  records: AuditRecord[]
  total: number
  page: number
  pageSize: number
}) {
  const totalPages = Math.ceil(total / pageSize)

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
              {["Action", "Record ID", "Config", "Executed By", "When"].map((h) => (
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
            {records.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-16">
                    <div
                      className="size-12 rounded-2xl flex items-center justify-center mb-3"
                      style={{
                        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.3)",
                      }}
                    >
                      <ScanSearch className="size-5 text-white" />
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                      No audit records
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {records.map((r, i) => (
              <tr
                key={r.id}
                className="transition-colors"
                style={{ borderBottom: i < records.length - 1 ? "1px solid var(--border)" : "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td className="px-4 py-3.5">
                  <StatusBadge status={r.action} />
                </td>
                <td className="px-4 py-3.5">
                  <code
                    className="text-[11px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: "var(--muted)", color: "var(--foreground-muted)" }}
                  >
                    {r.recordId}
                  </code>
                </td>
                <td className="px-4 py-3.5">
                  <code
                    className="text-[11px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: "var(--muted)", color: "var(--foreground-muted)" }}
                  >
                    {r.syncConfigId.slice(0, 8)}…
                  </code>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                    {r.executedBy}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                  {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
