import { formatDistanceToNow } from "date-fns"
import { StatusBadge } from "@/components/ui/status-badge"
import { AlertTriangle, ShieldCheck } from "lucide-react"

interface DLQItem {
  id: string
  originalJobId: string
  operation: string
  errorReason: string
  severity: string
  requiresManualReview: boolean
  reviewedBy: string | null
  createdAt: Date
}

export function DLQTable({ items }: { items: DLQItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center py-20"
        style={{
          background: "var(--surface)",
          border: "2px dashed var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className="size-14 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
            boxShadow: "0 4px 14px rgba(5,46,22,0.35)",
          }}
        >
          <ShieldCheck className="size-6 text-white" />
        </div>
        <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          Dead letter queue is clear
        </p>
        <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
          No items requiring manual review
        </p>
      </div>
    )
  }

  return (
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
            {["Severity", "Operation", "Error Reason", "Job ID", "Age", "Reviewed By"].map((h) => (
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
          {items.map((item, i) => (
            <tr
              key={item.id}
              className="transition-colors"
              style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td className="px-4 py-3.5">
                <StatusBadge status={item.severity} />
              </td>
              <td className="px-4 py-3.5">
                <code
                  className="text-[11px] px-1.5 py-0.5 rounded"
                  style={{ background: "var(--muted)", color: "var(--foreground-muted)" }}
                >
                  {item.operation}
                </code>
              </td>
              <td className="px-4 py-3.5 max-w-[260px]">
                <p
                  className="text-[12px] truncate font-mono"
                  style={{ color: "#dc2626" }}
                  title={item.errorReason}
                >
                  {item.errorReason}
                </p>
              </td>
              <td className="px-4 py-3.5">
                <code
                  className="text-[11px] px-1.5 py-0.5 rounded font-mono"
                  style={{ background: "var(--muted)", color: "var(--foreground-muted)" }}
                >
                  {item.originalJobId.slice(0, 8)}…
                </code>
              </td>
              <td className="px-4 py-3.5 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                {formatDistanceToNow(item.createdAt, { addSuffix: true })}
              </td>
              <td className="px-4 py-3.5">
                {item.reviewedBy ? (
                  <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
                    {item.reviewedBy}
                  </p>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "#fef3c7", color: "#92400e" }}
                  >
                    <AlertTriangle className="size-3" />
                    Pending
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
