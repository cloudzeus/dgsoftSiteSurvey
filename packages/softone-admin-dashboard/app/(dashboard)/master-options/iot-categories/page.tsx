import { db } from "@/lib/db"
import { IotCategoriesTable } from "@/components/master-options/iot-categories-table"

export const metadata = { title: "IoT Categories" }

export default async function IotCategoriesPage() {
  const categories = await db.iotCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  })

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          IoT Categories
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {categories.length} categor{categories.length !== 1 ? "ies" : "y"} · organize IoT and computer vision product groups
        </p>
      </div>
      <IotCategoriesTable initialCategories={categories} />
    </div>
  )
}
