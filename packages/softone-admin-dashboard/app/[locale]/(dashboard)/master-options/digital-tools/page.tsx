import { db } from "@/lib/db"
import { DigitalToolsTable } from "@/components/master-options/digital-tools-table"

export const metadata = { title: "Digital Tools" }

export default async function DigitalToolsPage() {
  const tools = await db.digitalTool.findMany({ orderBy: { name: "asc" } })

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Digital Tools
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {tools.length} tool{tools.length !== 1 ? "s" : ""} · analytics, SEO suites, ads platforms and marketing automation
        </p>
      </div>
      <DigitalToolsTable initialTools={tools} />
    </div>
  )
}
