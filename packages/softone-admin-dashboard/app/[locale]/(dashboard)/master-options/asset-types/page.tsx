import { db } from "@/lib/db"
import { AssetTypesTable } from "@/components/master-options/asset-types-table"

export const metadata = { title: "Asset Types" }

export default async function AssetTypesPage() {
  const assetTypes = await db.assetType.findMany({ orderBy: { name: "asc" } })

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Asset Types
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {assetTypes.length} type{assetTypes.length !== 1 ? "s" : ""} · hardware & infrastructure categories
        </p>
      </div>
      <AssetTypesTable initialAssetTypes={assetTypes} />
    </div>
  )
}
