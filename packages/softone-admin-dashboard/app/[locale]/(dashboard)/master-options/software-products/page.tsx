import { db } from "@/lib/db"
import { SoftwareProductsTable } from "@/components/master-options/software-products-table"

export const metadata = { title: "Software Products" }

export default async function SoftwareProductsPage() {
  const [products, vendors] = await Promise.all([
    db.softwareProduct.findMany({
      orderBy: [{ vendor: { name: "asc" } }, { name: "asc" }],
      include: { vendor: { select: { id: true, name: true } } },
    }),
    db.softwareVendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Software Products
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {products.length} product{products.length !== 1 ? "s" : ""} · ERP, CRM, WMS and other business software
        </p>
      </div>
      <SoftwareProductsTable initialProducts={products} vendors={vendors} />
    </div>
  )
}
