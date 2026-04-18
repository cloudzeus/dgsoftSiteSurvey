import { db } from "@/lib/db"
import { formatDistanceToNow } from "date-fns"
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react"

export const metadata = { title: "Jobs" }
export const dynamic = "force-dynamic"

export default async function JobsPage() {
  const jobs = await db.pipelineJob.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { entity: { select: { id: true, name: true, slug: true } } },
  })

  const running   = jobs.filter((j) => j.status === "RUNNING").length
  const completed = jobs.filter((j) => j.status === "COMPLETED").length
  const failed    = jobs.filter((j) => j.status === "FAILED").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>Jobs</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>Pipeline processing runs — last 100</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Running",   value: running,   color: "#6366f1" },
          { label: "Completed", value: completed, color: "#16a34a" },
          { label: "Failed",    value: failed,    color: "#dc2626" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4 relative overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: color }} />
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>{label}</p>
            <p className="text-[28px] font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{value}</p>
          </div>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-16 gap-2"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <Clock className="size-8" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>No jobs yet</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/20" }}>
                {["Entity", "Trigger", "Status", "Processed", "OK", "Failed", "Duration", "Started"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j, i) => {
                const ms = j.completedAt
                  ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime() : null
                const dur = ms === null ? "—"
                  : ms < 1000 ? `${ms}ms`
                  : ms < 60000 ? `${(ms / 1000).toFixed(1)}s`
                  : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
                const isLast = i === jobs.length - 1

                return (
                  <tr key={j.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{j.entity.name}</p>
                      <p className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>/{j.entity.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded"
                        style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{j.trigger}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5 w-fit" style={{
                        background: j.status === "RUNNING" ? "#6366f115" : j.status === "COMPLETED" ? "#16a34a15" : "#dc262615",
                        color:      j.status === "RUNNING" ? "#6366f1"   : j.status === "COMPLETED" ? "#16a34a"   : "#dc2626",
                      }}>
                        {j.status === "RUNNING"   && <Loader2 className="size-3.5 animate-spin" />}
                        {j.status === "COMPLETED" && <CheckCircle2 className="size-3.5" />}
                        {j.status === "FAILED"    && <XCircle className="size-3.5" />}
                        <span className="text-[11px] font-semibold">{j.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                      {j.processed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-emerald-500">
                      {j.succeeded.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums"
                      style={{ color: j.failed > 0 ? "#dc2626" : "var(--muted-foreground)" }}>
                      {j.failed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{dur}</td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {formatDistanceToNow(new Date(j.startedAt), { addSuffix: true })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
