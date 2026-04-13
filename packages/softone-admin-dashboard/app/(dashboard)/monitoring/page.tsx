import { db } from "@/lib/db"
import { subDays, startOfDay, format } from "date-fns"

export const metadata = { title: "Monitoring" }
export const revalidate = 60

async function getLast14Days() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i)
    return { date: startOfDay(d), label: format(d, "MMM d") }
  })

  const jobs = await db.pipelineJob.findMany({
    where: { startedAt: { gte: days[0]!.date } },
    select: { startedAt: true, status: true, processed: true, succeeded: true, failed: true },
  })

  return days.map(({ label, date }) => {
    const next = new Date(date.getTime() + 86_400_000)
    const day = jobs.filter((j) => j.startedAt >= date && j.startedAt < next)
    const total = day.length
    const done = day.filter((j) => j.status === "COMPLETED").length
    const fail = day.filter((j) => j.status === "FAILED").length
    const records = day.reduce((s, j) => s + j.succeeded, 0)
    return { label, total, completed: done, failed: fail, records, successRate: total > 0 ? Math.round((done / total) * 100) : 100 }
  })
}

async function getEntityHealth() {
  const entities = await db.pipelineEntity.findMany({
    where: { isActive: true },
    include: {
      jobs: { orderBy: { startedAt: "desc" }, take: 10,
        select: { status: true, startedAt: true, completedAt: true, processed: true, succeeded: true, failed: true } },
      _count: { select: { records: true, jobs: true } },
      records: { orderBy: { receivedAt: "desc" }, take: 1, select: { receivedAt: true, status: true } },
    },
  })

  return entities.map((e) => {
    const recent = e.jobs
    const successCount = recent.filter((j) => j.status === "COMPLETED").length
    return {
      id: e.id, name: e.name, slug: e.slug,
      totalRecords: e._count.records,
      totalJobs: e._count.jobs,
      lastReceivedAt: e.records[0]?.receivedAt ?? null,
      recentSuccessRate: recent.length > 0 ? Math.round((successCount / recent.length) * 100) : null,
      recentJobs: recent,
    }
  })
}

async function getDeliveryStats() {
  const [total, failed, dead] = await Promise.all([
    db.recordDelivery.count(),
    db.recordDelivery.count({ where: { status: "FAILED" } }),
    db.recordDelivery.count({ where: { status: "DEAD" } }),
  ])
  return { total, failed, dead }
}

export default async function MonitoringPage() {
  const [chartData, entityHealth, deliveries] = await Promise.all([
    getLast14Days(),
    getEntityHealth(),
    getDeliveryStats(),
  ])

  const todayData     = chartData.at(-1)!
  const totalRecords  = chartData.reduce((s, d) => s + d.records, 0)
  const successRate   = todayData.successRate

  const kpis = [
    { label: "Today's success rate", value: `${successRate}%`,
      sub: successRate >= 95 ? "Healthy" : "Below threshold",
      color: successRate >= 95 ? "#16a34a" : "#d97706",
      bg: successRate >= 95 ? "#f0fdf4" : "#fffbeb" },
    { label: "Records (14 days)", value: totalRecords.toLocaleString(),
      sub: "Across all entities", color: "#4f46e5", bg: "#eef2ff" },
    { label: "Failed deliveries", value: String(deliveries.failed),
      sub: deliveries.failed > 0 ? "Needs attention" : "All clear",
      color: deliveries.failed > 0 ? "#dc2626" : "#16a34a",
      bg: deliveries.failed > 0 ? "#fef2f2" : "#f0fdf4" },
    { label: "Dead deliveries", value: String(deliveries.dead),
      sub: deliveries.dead > 0 ? "Manual review needed" : "None",
      color: deliveries.dead > 0 ? "#dc2626" : "#16a34a",
      bg: deliveries.dead > 0 ? "#fef2f2" : "#f0fdf4" },
  ]

  function successColor(rate: number) {
    return rate >= 95 ? "#16a34a" : rate >= 70 ? "#d97706" : "#dc2626"
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>Monitoring</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Hub health overview · auto-refreshes every 60s
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map(({ label, value, sub, color, bg }) => (
          <div key={label} className="rounded-xl p-5 relative overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: color }} />
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--foreground-subtle)" }}>{label}</p>
            <p className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "var(--foreground)" }}>{value}</p>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: bg, color }}>{sub}</span>
          </div>
        ))}
      </div>

      {/* 14-day bar chart (HTML-only, no recharts dep on new models) */}
      <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <h2 className="text-[13px] font-semibold mb-1" style={{ color: "var(--foreground)" }}>Job volume — last 14 days</h2>
        <p className="text-[11px] mb-4" style={{ color: "var(--foreground-muted)" }}>Completed vs failed jobs per day</p>
        <div className="flex items-end gap-1.5 h-24">
          {chartData.map((d) => {
            const max = Math.max(...chartData.map((x) => x.total), 1)
            const completedH = Math.round((d.completed / max) * 96)
            const failedH    = Math.round((d.failed / max) * 96)
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.label}: ${d.completed} ok, ${d.failed} failed`}>
                <div className="w-full flex flex-col justify-end gap-px" style={{ height: 96 }}>
                  {d.failed > 0 && <div className="w-full rounded-sm" style={{ height: failedH, background: "#dc2626aa" }} />}
                  {d.completed > 0 && <div className="w-full rounded-sm" style={{ height: completedH, background: "#4f46e5" }} />}
                  {d.total === 0 && <div className="w-full rounded-sm" style={{ height: 2, background: "var(--border)" }} />}
                </div>
                <span className="text-[9px] rotate-45 origin-left mt-2" style={{ color: "var(--foreground-subtle)" }}>{d.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Entity health */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Entity Health</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>Based on last 10 jobs per entity</p>
        </div>

        {entityHealth.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            No active entities
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/10" }}>
                {["Entity", "Records", "Last Activity", "Recent Success", "Total Jobs"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--foreground-subtle)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entityHealth.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: i < entityHealth.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{e.name}</p>
                    <p className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>/{e.slug}</p>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {e.totalRecords.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    {e.lastReceivedAt
                      ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
                          -Math.round((Date.now() - new Date(e.lastReceivedAt).getTime()) / 60000), "minute")
                      : <span style={{ color: "var(--foreground-subtle)" }}>Never</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {e.recentSuccessRate !== null ? (
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${e.recentSuccessRate}%`, background: successColor(e.recentSuccessRate) }} />
                        </div>
                        <span className="text-[12px] font-semibold tabular-nums"
                          style={{ color: successColor(e.recentSuccessRate) }}>
                          {e.recentSuccessRate}%
                        </span>
                      </div>
                    ) : <span style={{ color: "var(--foreground-subtle)" }}>—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {e.totalJobs.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
