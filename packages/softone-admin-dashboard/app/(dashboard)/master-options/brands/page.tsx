import { db } from "@/lib/db"
import { BrandsTable } from "@/components/master-options/brands-table"

export const metadata = { title: "Brands" }

export default async function BrandsPage() {
  const brands = await db.brand.findMany({ orderBy: { name: "asc" } })

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
