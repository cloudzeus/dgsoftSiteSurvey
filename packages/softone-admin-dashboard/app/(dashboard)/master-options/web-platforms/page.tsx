import { db } from "@/lib/db"
import { WebPlatformsTable } from "@/components/master-options/web-platforms-table"

export const metadata = { title: "Web Platforms" }

export default async function WebPlatformsPage() {
  const platforms = await db.webPlatform.findMany({ orderBy: { name: "asc" } })

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Web Platforms
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {platforms.length} platform{platforms.length !== 1 ? "s" : ""} · CMS, e-commerce engines and website builders
        </p>
      </div>
      <WebPlatformsTable initialPlatforms={platforms} />
    </div>
  )
}
