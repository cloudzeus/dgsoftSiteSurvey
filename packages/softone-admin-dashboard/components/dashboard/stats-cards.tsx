import { Activity, AlertCircle, Clock, TriangleAlert, TrendingUp, CheckCircle2 } from "lucide-react"

interface StatsCardsProps {
  totalConfigs: number
  pendingJobs: number
  failedJobs: number
  dlqCount: number
}

const cards = (p: StatsCardsProps) => [
  {
    label:      "Active Configs",
    value:      p.totalConfigs,
    icon:       Activity,
    accent:     "#7c3aed",
    // rich violet tint — far from 90s flat purple
    cardBg:     "#ffffff",
    borderColor:"rgba(124,58,237,0.14)",
    leftBorder: "#7c3aed",
    tint:       "radial-gradient(ellipse at top right, rgba(124,58,237,0.07) 0%, transparent 70%)",
    valueColor: "#1e1b4b",
    sub:        "Softone objects syncing",
    pill:       { label: "Live", bg: "rgba(124,58,237,0.1)", color: "#7c3aed" },
  },
  {
    label:      "Pending Jobs",
    value:      p.pendingJobs,
    icon:       Clock,
    accent:     "#0891b2",
    // modern cyan — not 90s teal
    cardBg:     "#ffffff",
    borderColor:"rgba(8,145,178,0.14)",
    leftBorder: "#0891b2",
    tint:       "radial-gradient(ellipse at top right, rgba(8,145,178,0.07) 0%, transparent 70%)",
    valueColor: "#0c4a6e",
    sub:        "Queued for processing",
    pill:       {
      label: p.pendingJobs > 0 ? "In queue" : "Empty",
      bg: p.pendingJobs > 0 ? "rgba(8,145,178,0.1)" : "rgba(16,185,129,0.1)",
      color: p.pendingJobs > 0 ? "#0891b2" : "#059669",
    },
  },
  {
    label:      "Failed Jobs",
    value:      p.failedJobs,
    icon:       p.failedJobs > 0 ? AlertCircle : CheckCircle2,
    accent:     p.failedJobs > 0 ? "#e11d48" : "#10b981",
    // rose for failure, emerald for ok — modern palette
    cardBg:     "#ffffff",
    borderColor: p.failedJobs > 0 ? "rgba(225,29,72,0.14)" : "rgba(16,185,129,0.14)",
    leftBorder: p.failedJobs > 0 ? "#e11d48" : "#10b981",
    tint:       p.failedJobs > 0
      ? "radial-gradient(ellipse at top right, rgba(225,29,72,0.07) 0%, transparent 70%)"
      : "radial-gradient(ellipse at top right, rgba(16,185,129,0.07) 0%, transparent 70%)",
    valueColor: p.failedJobs > 0 ? "#881337" : "#064e3b",
    sub:        p.failedJobs > 0 ? "Requires attention" : "All systems clear",
    pill:       {
      label: p.failedJobs > 0 ? "Action needed" : "Healthy",
      bg: p.failedJobs > 0 ? "rgba(225,29,72,0.1)" : "rgba(16,185,129,0.1)",
      color: p.failedJobs > 0 ? "#e11d48" : "#10b981",
    },
  },
  {
    label:      "DLQ Items",
    value:      p.dlqCount,
    icon:       TriangleAlert,
    accent:     p.dlqCount > 0 ? "#f59e0b" : "#10b981",
    // warm amber — not 90s orange
    cardBg:     "#ffffff",
    borderColor: p.dlqCount > 0 ? "rgba(245,158,11,0.14)" : "rgba(16,185,129,0.14)",
    leftBorder: p.dlqCount > 0 ? "#f59e0b" : "#10b981",
    tint:       p.dlqCount > 0
      ? "radial-gradient(ellipse at top right, rgba(245,158,11,0.07) 0%, transparent 70%)"
      : "radial-gradient(ellipse at top right, rgba(16,185,129,0.07) 0%, transparent 70%)",
    valueColor: p.dlqCount > 0 ? "#78350f" : "#064e3b",
    sub:        p.dlqCount > 0 ? "Needs manual review" : "Queue empty",
    pill:       {
      label: p.dlqCount > 0 ? "Review pending" : "Clear",
      bg: p.dlqCount > 0 ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
      color: p.dlqCount > 0 ? "#d97706" : "#10b981",
    },
  },
]

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards(props).map(({ label, value, icon: Icon, cardBg, borderColor, leftBorder, tint, valueColor, sub, pill }) => (
        <div
          key={label}
          className="relative overflow-hidden rounded-xl p-4"
          style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          {/* Radial tint overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: tint }} />

          {/* Bold left border accent */}
          <div
            className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-xl"
            style={{ background: leftBorder }}
          />

          {/* Header row */}
          <div className="flex items-center justify-between mb-3 pl-2">
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--foreground-subtle)" }}
            >
              {label}
            </p>
            <div
              className="size-7 flex items-center justify-center flex-shrink-0"
              style={{ background: "#0f172a", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
            >
              <Icon className="size-[13px] text-white" />
            </div>
          </div>

          {/* Metric */}
          <div className="pl-2 mb-2.5">
            <p
              className="leading-none tabular-nums font-light"
              style={{ color: valueColor, fontSize: 26, letterSpacing: "-0.02em" }}
            >
              {value}
            </p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--foreground-subtle)" }}>
              {sub}
            </p>
          </div>

          {/* Status pill */}
          <div className="pl-2 pt-2.5" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: pill.bg, color: pill.color }}
            >
              <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: pill.color }} />
              {pill.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
