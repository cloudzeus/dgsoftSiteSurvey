"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Skull } from "lucide-react"
import { cn } from "@/lib/utils"

interface PipelineField { id: string; name: string; label: string | null; isPrimaryKey: boolean }

interface Delivery {
  id: string; status: string; attempt: number; externalId: string | null
  errorMessage: string | null; deliveredAt: Date | null
  binding: { connection: { name: string; type: string } }
}

interface PipelineRecord {
  id: string; status: string; canonicalData: unknown; sourceSystem: string
  sourceRecordId: string | null; receivedAt: Date; processedAt: Date | null
  errorMessage: string | null; retryCount: number
  deliveries: Delivery[]
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:    <Clock className="size-3.5 text-zinc-400" />,
  PROCESSING: <Loader2 className="size-3.5 text-indigo-400 animate-spin" />,
  COMPLETED:  <CheckCircle2 className="size-3.5 text-emerald-500" />,
  PARTIAL:    <AlertTriangle className="size-3.5 text-amber-500" />,
  FAILED:     <XCircle className="size-3.5 text-red-500" />,
  DEAD:       <Skull className="size-3.5 text-red-700" />,
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending", PROCESSING: "Processing", COMPLETED: "Completed",
  PARTIAL: "Partial", FAILED: "Failed", DEAD: "Dead",
}

const DELIVERY_COLOR: Record<string, string> = {
  PENDING:    "bg-zinc-500/10 text-zinc-400",
  DELIVERING: "bg-indigo-500/10 text-indigo-400",
  DELIVERED:  "bg-emerald-500/10 text-emerald-400",
  FAILED:     "bg-red-500/10 text-red-400",
  DEAD:       "bg-red-900/20 text-red-600",
}

// Show at most 4 canonical fields as columns; rest available on expand
const MAX_COLS = 4

export function RecordsTable({
  records, fields, total, page, pageSize, entityId, currentStatus,
}: {
  records: PipelineRecord[]; fields: PipelineField[]
  total: number; page: number; pageSize: number
  entityId: string; currentStatus?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const displayFields = fields.slice(0, MAX_COLS)

  function pageLink(p: number) {
    const params = new URLSearchParams()
    if (currentStatus) params.set("status", currentStatus)
    params.set("page", String(p))
    return `/records/${entityId}?${params}`
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border flex items-center justify-center py-16"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>No records match this filter</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/20" }}>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: "var(--muted-foreground)" }}>Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: "var(--muted-foreground)" }}>Source</th>
                {displayFields.map((f) => (
                  <th key={f.id} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: "var(--muted-foreground)" }}>
                    {f.label ?? f.name}{f.isPrimaryKey && " 🔑"}
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: "var(--muted-foreground)" }}>Deliveries</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: "var(--muted-foreground)" }}>Received</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const data = r.canonicalData as Record<string, unknown>
                const isLast = i === records.length - 1

                return (
                  <tr key={r.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
                    className="hover:bg-[var(--muted)]/20 transition-colors">

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICON[r.status]}
                        <span className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </div>
                      {r.errorMessage && (
                        <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-36" title={r.errorMessage}>
                          {r.errorMessage}
                        </p>
                      )}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{r.sourceSystem}</p>
                      {r.sourceRecordId && (
                        <p className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>#{r.sourceRecordId}</p>
                      )}
                    </td>

                    {/* Canonical field values */}
                    {displayFields.map((f) => (
                      <td key={f.id} className="px-4 py-3 text-[12px] tabular-nums max-w-[160px]"
                        style={{ color: "var(--foreground)" }}>
                        <span className="truncate block">
                          {data[f.name] !== null && data[f.name] !== undefined
                            ? String(data[f.name])
                            : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                        </span>
                      </td>
                    ))}

                    {/* Deliveries */}
                    <td className="px-4 py-3">
                      {r.deliveries.length === 0 ? (
                        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.deliveries.map((d) => (
                            <div key={d.id} className="flex items-center gap-1">
                              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", DELIVERY_COLOR[d.status])}>
                                {d.binding.connection.name}
                              </span>
                              {d.attempt > 1 && (
                                <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>×{d.attempt}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Received */}
                    <td className="px-4 py-3 text-[11px] whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                      {format(new Date(r.receivedAt), "MMM d, HH:mm:ss")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link href={pageLink(page - 1)}
              className={cn("size-7 rounded-lg border flex items-center justify-center transition-colors",
                page <= 1 ? "opacity-30 pointer-events-none" : "hover:bg-[var(--muted)]")}
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <ChevronLeft className="size-4" />
            </Link>
            <span className="text-[12px] px-2 tabular-nums" style={{ color: "var(--foreground)" }}>
              {page} / {totalPages}
            </span>
            <Link href={pageLink(page + 1)}
              className={cn("size-7 rounded-lg border flex items-center justify-center transition-colors",
                page >= totalPages ? "opacity-30 pointer-events-none" : "hover:bg-[var(--muted)]")}
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
