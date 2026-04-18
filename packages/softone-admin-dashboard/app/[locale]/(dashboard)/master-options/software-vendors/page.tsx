import { db } from "@/lib/db"
import { SoftwareVendorsTable } from "@/components/master-options/software-vendors-table"

export const metadata = { title: "Software Vendors" }

export default async function SoftwareVendorsPage() {
  const vendors = await db.softwareVendor.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  })

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Software Vendors
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} · manage software companies and their products
        </p>
      </div>
      <SoftwareVendorsTable initialVendors={vendors} />
    </div>
  )
}
