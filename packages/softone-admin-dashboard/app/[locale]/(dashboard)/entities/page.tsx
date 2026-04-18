import { db } from "@/lib/db"
import { EntitiesTable } from "@/components/entities/entities-table"

export const metadata = { title: "Entities" }
export const dynamic = "force-dynamic"

export default async function EntitiesPage() {
  const [entities, connections] = await Promise.all([
    db.pipelineEntity.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { records: true, bindings: true } },
        bindings: {
          include: { connection: { select: { id: true, name: true, type: true } } },
        },
      },
    }),
    db.connection.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Entities
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Define canonical data schemas and connect them to inbound/outbound system bindings
        </p>
      </div>
      <EntitiesTable entities={entities} connections={connections} />
    </div>
  )
}
