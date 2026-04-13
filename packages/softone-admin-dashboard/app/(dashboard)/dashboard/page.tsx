import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { format } from "date-fns"
import Link from "next/link"
import { Plug, GitMerge, Inbox, CheckCircle2, XCircle, Loader2, Clock, ArrowRight } from "lucide-react"

export const metadata = { title: "Overview" }
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await auth()

  const today = new Date(new Date().setHours(0, 0, 0, 0))

  const [
    connections, entities, pendingRecords, failedDeliveries,
    completedToday, recentJobs,
  ] = await Promise.all([
    db.connection.count({ where: { isActive: true } }),
    db.pipelineEntity.count({ where: { isActive: true } }),
    db.pipelineRecord.count({ where: { status: "PENDING" } }),
    db.recordDelivery.count({ where: { status: { in: ["FAILED", "DEAD"] } } }),
    db.pipelineJob.count({ where: { status: "COMPLETED", startedAt: { gte: today } } }),
    db.pipelineJob.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { entity: { select: { name: true, slug: true } } },
    }),
  ])

  const userName = session?.user?.email?.split("@")[0] ?? "there"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  const kpis = [
    { label: "Active connections", value: connections, href: "/connections", color: "#6366f1", Icon: Plug },
    { label: "Active entities",    value: entities,    href: "/entities",    color: "#0ea5e9", Icon: GitMerge },
    { label: "Pending records",    value: pendingRecords, href: "/records",  color: "#d97706", Icon: Inbox },
    { label: "Failed deliveries",  value: failedDeliveries, href: "/records", color: failedDeliveries > 0 ? "#dc2626" : "#16a34a", Icon: failedDeliveries > 0 ? XCircle : CheckCircle2 },
  ]

  return (
    <div className="space-y-7 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-medium" style={{ color: "var(--foreground-muted)" }}>
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
          <h1 className="text-[22px] font-bold tracking-tight mt-0.5" style={{ color: "var(--foreground)" }}>
            {greeting}, {userName}
          </h1>
        </div>
        <div className="text-right px-4 py-2.5 rounded-xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>Jobs completed today</p>
          <p className="text-[22px] font-bold" style={{ color: "#16a34a" }}>{completedToday}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map(({ label, value, href, color, Icon }) => (
          <Link key={label} href={href}
            className="rounded-xl p-5 relative overflow-hidden group transition-colors hover:border-indigo-500/40"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: color }} />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{label}</p>
              <Icon className="size-4" style={{ color }} />
            </div>
            <p className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "var(--foreground)" }}>{value}</p>
            <ArrowRight className="size-3.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }} />
          </Link>
        ))}
      </div>

      {/* Recent jobs */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Recent jobs</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Latest pipeline processing runs</p>
          </div>
          <Link href="/jobs" className="text-[11px] font-semibold hover:underline" style={{ color: "#6366f1" }}>
            View all
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <div className="px-5 py-10 flex flex-col items-center gap-2">
            <Clock className="size-8" style={{ color: "var(--muted-foreground)" }} />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>No jobs yet</p>
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {recentJobs.map((j, i) => {
                const ms = j.completedAt
                  ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime() : null
                const dur = ms === null ? null
                  : ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s`
                  : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
                const isLast = i === recentJobs.length - 1

                return (
                  <tr key={j.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
                    className="hover:bg-[var(--muted)]/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {j.status === "RUNNING"   && <Loader2 className="size-3.5 text-indigo-400 animate-spin" />}
                        {j.status === "COMPLETED" && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                        {j.status === "FAILED"    && <XCircle className="size-3.5 text-red-500" />}
                        <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{j.entity.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                        {j.trigger}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                      {j.processed.toLocaleString()} records
                    </td>
                    {dur && (
                      <td className="px-5 py-3 text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{dur}</td>
                    )}
                    <td className="px-5 py-3 text-[11px] text-right" style={{ color: "var(--muted-foreground)" }}>
                      {format(new Date(j.startedAt), "HH:mm")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
