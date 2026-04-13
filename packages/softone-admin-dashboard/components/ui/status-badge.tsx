import { cn } from "@/lib/utils"

interface StatusConfig {
  dot: string
  bg: string
  text: string
  label: string
}

const STATUS: Record<string, StatusConfig> = {
  PENDING:         { dot: "#f59e0b", bg: "#fffbeb", text: "#92400e", label: "Pending" },
  IN_PROGRESS:     { dot: "#3b82f6", bg: "#eff6ff", text: "#1e40af", label: "In Progress" },
  COMPLETED:       { dot: "#16a34a", bg: "#f0fdf4", text: "#15803d", label: "Completed" },
  FAILED:          { dot: "#dc2626", bg: "#fef2f2", text: "#b91c1c", label: "Failed" },
  PARTIAL_FAILURE: { dot: "#ea580c", bg: "#fff7ed", text: "#c2410c", label: "Partial" },
  READ:            { dot: "#6366f1", bg: "#eef2ff", text: "#4338ca", label: "Read" },
  WRITE:           { dot: "#8b5cf6", bg: "#f5f3ff", text: "#6d28d9", label: "Write" },
  BIDIRECTIONAL:   { dot: "#0891b2", bg: "#ecfeff", text: "#0e7490", label: "Bidirect." },
  INACTIVE:        { dot: "#9ca3af", bg: "#f9fafb", text: "#6b7280", label: "Inactive" },
  WARNING:         { dot: "#f59e0b", bg: "#fffbeb", text: "#92400e", label: "Warning" },
  ERROR:           { dot: "#dc2626", bg: "#fef2f2", text: "#b91c1c", label: "Error" },
  CRITICAL:        { dot: "#be123c", bg: "#fff1f2", text: "#9f1239", label: "Critical" },
  FETCH:           { dot: "#6366f1", bg: "#eef2ff", text: "#4338ca", label: "Fetch" },
  INSERT:          { dot: "#16a34a", bg: "#f0fdf4", text: "#15803d", label: "Insert" },
  UPDATE:          { dot: "#0891b2", bg: "#ecfeff", text: "#0e7490", label: "Update" },
  DELETE:          { dot: "#dc2626", bg: "#fef2f2", text: "#b91c1c", label: "Delete" },
  CONFLICT_RESOLVED: { dot: "#d97706", bg: "#fffbeb", text: "#b45309", label: "Resolved" },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status]
  if (!cfg) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600">
        <span className="size-1.5 rounded-full bg-gray-400 flex-shrink-0" />
        {status.replace(/_/g, " ")}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span
        className="size-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.dot }}
      />
      {cfg.label}
    </span>
  )
}
