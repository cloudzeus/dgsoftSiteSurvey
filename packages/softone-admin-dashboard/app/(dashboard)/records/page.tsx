import { db } from "@/lib/db"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Inbox } from "lucide-react"

export const metadata = { title: "Records" }
export const dynamic = "force-dynamic"

export default async function RecordsPage() {
  const entities = await db.pipelineEntity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { records: true } },
      records: {
        take: 1,
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true, status: true },
      },
      bindings: {
        include: { connection: { select: { name: true, type: true } } },
      },
    },
  })

  const statusColor: Record<string, string> = {
    PENDING:    "bg-zinc-500/10 text-zinc-400",
    PROCESSING: "bg-indigo-500/10 text-indigo-400",
    COMPLETED:  "bg-emerald-500/10 text-emerald-400",
    PARTIAL:    "bg-amber-500/10 text-amber-400",
    FAILED:     "bg-red-500/10 text-red-400",
    DEAD:       "bg-red-900/20 text-red-600",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>Records</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Canonical records flowing through the hub — click an entity to inspect individual records
        </p>
      </div>

      {entities.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-20"
          style={{ borderColor: "var(--border)" }}>
          <Inbox className="size-10 mb-3" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>No entities yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Create an entity first to start receiving records
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((e) => {
            const lastRecord = e.records[0]
            const inbound  = e.bindings.filter((b) => b.direction === "INBOUND" || b.direction === "BOTH")
            const outbound = e.bindings.filter((b) => b.direction === "OUTBOUND" || b.direction === "BOTH")

            return (
              <Link key={e.id} href={`/records/${e.id}`}
                className="rounded-2xl border p-5 flex flex-col gap-3 hover:border-indigo-500/50 transition-colors group"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}>

                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[14px] font-semibold group-hover:text-indigo-400 transition-colors"
                      style={{ color: "var(--foreground)" }}>{e.name}</p>
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>/{e.slug}</p>
                  </div>
                  <span className="text-[22px] font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {e._count.records.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {inbound.map((b) => (
                    <span key={b.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                      ← {b.connection.name}
                    </span>
                  ))}
                  {outbound.map((b) => (
                    <span key={b.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                      → {b.connection.name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-auto pt-2"
                  style={{ borderTop: "1px solid var(--border)" }}>
                  {lastRecord ? (
                    <>
                      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        Last: {formatDistanceToNow(lastRecord.receivedAt, { addSuffix: true })}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[lastRecord.status] ?? ""}`}>
                        {lastRecord.status}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>No records yet</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
