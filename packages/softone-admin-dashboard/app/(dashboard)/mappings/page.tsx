import { db } from "@/lib/db"
import { checkRole } from "@/lib/permissions"
import { MappingsClient } from "@/components/mappings/mappings-client"

export const metadata = { title: "Mappings" }
export const dynamic = "force-dynamic"

export default async function MappingsPage() {
  const [tables, connections, isAdmin] = await Promise.all([
    db.mappingTable.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { entries: true } },
        entries: { orderBy: { sourceValue: "asc" } },
        sourceConnection: { select: { id: true, name: true, type: true } },
        targetConnection: { select: { id: true, name: true, type: true } },
      },
    }),
    db.connection.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    checkRole("ADMIN"),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Mappings
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Value translations and cross-system identifier bridges between connected systems
        </p>
      </div>
      <MappingsClient tables={tables} connections={connections} isAdmin={isAdmin} />
    </div>
  )
}
