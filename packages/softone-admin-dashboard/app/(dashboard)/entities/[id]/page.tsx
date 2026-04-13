import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  ChevronLeft, ArrowDown, ArrowUp, ArrowLeftRight,
  CheckCircle2, XCircle, Loader2, Clock, Plug, Link2,
} from "lucide-react"
import { PayloadTemplateEditor } from "@/components/entities/payload-template-editor"
import { ProcessButton } from "@/components/entities/process-button"

export const dynamic = "force-dynamic"

const DIR_LABEL: Record<string, string> = { INBOUND: "Inbound", OUTBOUND: "Outbound", BOTH: "Both" }
const DIR_COLOR: Record<string, string> = { INBOUND: "#0ea5e9", OUTBOUND: "#d97706", BOTH: "#8b5cf6" }

export default async function EntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const entity = await db.pipelineEntity.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      bindings: {
        include: {
          connection: { select: { id: true, name: true, type: true } },
          webhooks: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { records: true, jobs: true } },
    },
  })
  if (!entity) notFound()

  const [statusCounts, recentJobs] = await Promise.all([
    db.pipelineRecord.groupBy({
      by: ["status"],
      where: { entityId: id },
      _count: true,
    }),
    db.pipelineJob.findMany({
      where: { entityId: id },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ])

  function sc(status: string) {
    return statusCounts.find((s) => s.status === status)?._count ?? 0
  }

  const outboundBindings = entity.bindings.filter(
    (b) => b.direction === "OUTBOUND" || b.direction === "BOTH",
  )

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/entities"
          className="size-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-[var(--muted)]"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            {entity.name}
          </h1>
          <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            /{entity.slug} · {entity._count.records.toLocaleString()} records · {entity._count.jobs} jobs
          </p>
        </div>
        <ProcessButton entityId={id} />
      </div>

      {/* Buffer status */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {[
          { label: "Pending",    value: sc("PENDING"),    color: "#6366f1", href: `/records/${id}?status=PENDING` },
          { label: "Processing", value: sc("PROCESSING"), color: "#0ea5e9", href: `/records/${id}` },
          { label: "Completed",  value: sc("COMPLETED"),  color: "#16a34a", href: `/records/${id}?status=COMPLETED` },
          { label: "Partial",    value: sc("PARTIAL"),    color: "#d97706", href: `/records/${id}?status=PARTIAL` },
          { label: "Failed",     value: sc("FAILED"),     color: "#dc2626", href: `/records/${id}?status=FAILED` },
          { label: "Dead",       value: sc("DEAD"),       color: "#7f1d1d", href: `/records/${id}?status=DEAD` },
        ].map(({ label, value, color, href }) => (
          <Link key={label} href={href}
            className="rounded-xl p-4 relative overflow-hidden transition-colors hover:border-indigo-500/40"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: color }} />
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: "var(--muted-foreground)" }}>{label}</p>
            <p className="text-[24px] font-bold tabular-nums" style={{ color }}>{value.toLocaleString()}</p>
          </Link>
        ))}
      </div>

      {/* Bindings */}
      <div className="space-y-3">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>Bindings</h2>

        {/* Inbound — show webhook URLs */}
        {entity.bindings
          .filter((b) => b.direction === "INBOUND" || b.direction === "BOTH")
          .map((b) => (
            <div key={b.id} className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: `${DIR_COLOR[b.direction]}20`, color: DIR_COLOR[b.direction] }}>
                  {b.direction === "INBOUND" ? <ArrowDown className="size-3" />
                   : b.direction === "OUTBOUND" ? <ArrowUp className="size-3" />
                   : <ArrowLeftRight className="size-3" />}
                  {DIR_LABEL[b.direction]}
                </span>
                <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {b.name || b.objectName}
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                  {b.connection.type}
                </span>
                <Plug className="size-3 ml-auto shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{b.connection.name}</span>
              </div>

              {b.webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center gap-2 text-[11px] rounded-lg px-3 py-2 overflow-hidden"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                  <Link2 className="size-3 shrink-0" style={{ color: "#6366f1" }} />
                  <code className="flex-1 truncate font-mono text-[10px]" style={{ color: "var(--foreground)" }}>
                    /api/webhook/{wh.secret}
                  </code>
                  <span className="shrink-0" style={{ color: "var(--muted-foreground)" }}>
                    {wh.totalReceived.toLocaleString()} received
                  </span>
                </div>
              ))}
            </div>
          ))}

        {/* Outbound — payload template editors */}
        {outboundBindings.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--muted-foreground)" }}>Outbound payload templates</p>
            {outboundBindings.map((b) => (
              <PayloadTemplateEditor
                key={b.id}
                bindingId={b.id}
                entityId={id}
                bindingName={b.name ?? b.objectName}
                objectName={b.objectName}
                outboundMethod={(b as any).outboundMethod}
                payloadTemplate={(b as any).payloadTemplate}
                fields={entity.fields}
              />
            ))}
          </div>
        )}
      </div>

      {/* Canonical fields */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Canonical fields</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {entity.fields.length} fields · use <code className="font-mono text-[10px]">{"{{field_name}}"}</code> in templates
          </p>
        </div>
        {entity.fields.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--muted-foreground)" }}>No fields defined</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Name", "Label", "Type", "PK", "Req"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entity.fields.map((f, i) => (
                <tr key={f.id}
                  style={{ borderBottom: i < entity.fields.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td className="px-4 py-2.5 font-mono text-[11px]"
                    style={{ color: f.isPrimaryKey ? "#6366f1" : "var(--foreground)" }}>
                    {f.name}
                  </td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--foreground)" }}>{f.label ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{f.dataType}</td>
                  <td className="px-4 py-2.5 text-[11px]">{f.isPrimaryKey ? "🔑" : ""}</td>
                  <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {f.isRequired ? "✓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent jobs */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Recent jobs</h2>
          <Link href="/jobs" className="text-[11px] font-semibold hover:underline" style={{ color: "#6366f1" }}>
            View all
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <div className="px-4 py-10 flex flex-col items-center gap-2">
            <Clock className="size-7" style={{ color: "var(--muted-foreground)" }} />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>No jobs yet</p>
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {recentJobs.map((j, i) => {
                const ms = j.completedAt
                  ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()
                  : null
                const dur = ms === null ? "Running…"
                  : ms < 1000 ? `${ms}ms`
                  : ms < 60000 ? `${(ms / 1000).toFixed(1)}s`
                  : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
                const isLast = i === recentJobs.length - 1
                return (
                  <tr key={j.id}
                    style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {j.status === "RUNNING"   && <Loader2 className="size-3 text-indigo-400 animate-spin" />}
                        {j.status === "COMPLETED" && <CheckCircle2 className="size-3 text-emerald-500" />}
                        {j.status === "FAILED"    && <XCircle className="size-3 text-red-500" />}
                        <span className="text-[12px] font-semibold" style={{
                          color: j.status === "FAILED" ? "#dc2626"
                            : j.status === "RUNNING" ? "#6366f1"
                            : "var(--foreground)",
                        }}>
                          {j.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      <span className="px-2 py-0.5 rounded" style={{ background: "var(--muted)" }}>{j.trigger}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] tabular-nums" style={{ color: "var(--foreground)" }}>
                      {j.processed.toLocaleString()} records
                    </td>
                    <td className="px-4 py-2.5 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                      <span className="text-emerald-500">{j.succeeded.toLocaleString()}</span>
                      {" ok · "}
                      <span style={{ color: j.failed > 0 ? "#dc2626" : "inherit" }}>{j.failed} failed</span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                      {dur}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-right" style={{ color: "var(--muted-foreground)" }}>
                      {formatDistanceToNow(new Date(j.startedAt), { addSuffix: true })}
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
