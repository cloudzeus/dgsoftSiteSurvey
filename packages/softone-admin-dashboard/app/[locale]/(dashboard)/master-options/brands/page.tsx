import { db } from "@/lib/db"
import { BrandsTable } from "@/components/master-options/brands-table"
import type { MasterCategory } from "@prisma/client"

export const metadata = { title: "Brands" }

export default async function BrandsPage() {
  const raw = await db.brand.findMany({ orderBy: { name: "asc" } })
  const brands = raw.map(b => ({
    ...b,
    categories: Array.isArray(b.categories) ? (b.categories as MasterCategory[]) : [],
  }))

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Brands
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {brands.length} brand{brands.length !== 1 ? "s" : ""} · hardware & networking manufacturers
        </p>
      </div>
      <BrandsTable initialBrands={brands} />
    </div>
  )
}
