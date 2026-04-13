import { db } from "@/lib/db"
import { checkRole } from "@/lib/permissions"
import { XmlFeedsClient } from "@/components/xml-feeds/xml-feeds-client"

export const dynamic = "force-dynamic"
export const metadata = { title: "XML Feeds" }

export default async function XmlFeedsPage() {
  const [feeds, isOperator] = await Promise.all([
    db.xmlFeed.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { snapshots: true, fields: true } } },
    }),
    checkRole("OPERATOR"),
  ])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>XML Feeds</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Monitor external XML sources and track field-level changes over time
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <XmlFeedsClient feeds={feeds as any} canEdit={isOperator} />
      </div>
    </div>
  )
}
