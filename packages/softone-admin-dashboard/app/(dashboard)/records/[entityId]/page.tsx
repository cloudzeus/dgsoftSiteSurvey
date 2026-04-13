import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { RecordsTable } from "@/components/records/records-table"

export const dynamic = "force-dynamic"

export default async function EntityRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityId: string }>
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { entityId } = await params
  const { status, page = "1" } = await searchParams

  const entity = await db.pipelineEntity.findUnique({
    where: { id: entityId },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  })
  if (!entity) notFound()

  const PAGE_SIZE = 50
  const pageNum = Math.max(1, parseInt(page))
  const where = { entityId, ...(status ? { status } : {}) }

  const [records, total] = await Promise.all([
    db.pipelineRecord.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        deliveries: {
          include: { binding: { include: { connection: { select: { name: true, type: true } } } } },
        },
      },
    }),
    db.pipelineRecord.count({ where }),
  ])

  const statusCounts = await db.pipelineRecord.groupBy({
    by: ["status"],
    where: { entityId },
    _count: true,
  })

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/records" className="size-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-[var(--muted)]"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>{entity.name}</h1>
          <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            {total.toLocaleString()} records · /{entity.slug}
          </p>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {[{ label: "All", value: "" }, { label: "Pending", value: "PENDING" },
          { label: "Completed", value: "COMPLETED" }, { label: "Failed", value: "FAILED" },
          { label: "Partial", value: "PARTIAL" }, { label: "Dead", value: "DEAD" },
        ].map(({ label, value }) => {
          const count = value === "" ? total : (statusCounts.find((s) => s.status === value)?._count ?? 0)
          const active = (status ?? "") === value
          return (
            <Link key={value} href={`/records/${entityId}${value ? `?status=${value}` : ""}`}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                active ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "hover:border-[var(--ring)]"
              }`}
              style={{ borderColor: active ? "#6366f1" : "var(--border)", color: active ? undefined : "var(--muted-foreground)" }}>
              {label} {count > 0 && <span className="ml-0.5 tabular-nums">{count.toLocaleString()}</span>}
            </Link>
          )
        })}
      </div>

      <RecordsTable
        records={records as any}
        fields={entity.fields}
        total={total}
        page={pageNum}
        pageSize={PAGE_SIZE}
        entityId={entityId}
        currentStatus={status}
      />
    </div>
  )
}
