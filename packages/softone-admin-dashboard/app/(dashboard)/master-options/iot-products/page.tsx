import { db } from "@/lib/db"
import { IotProductsTable } from "@/components/master-options/iot-products-table"

export const metadata = { title: "IoT Products" }

export default async function IotProductsPage() {
  const [products, categories] = await Promise.all([
    db.iotProduct.findMany({
      orderBy: [{ category: { name: "asc" } }, { modelName: "asc" }],
      include: { category: { select: { id: true, name: true } } },
    }),
    db.iotCategory.findMany({ orderBy: { name: "asc" } }),
  ])

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          IoT Products
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {products.length} product{products.length !== 1 ? "s" : ""} · Milesight LoRaWAN sensors, gateways and AI vision devices
        </p>
      </div>
      <IotProductsTable initialProducts={products} categories={categories} />
    </div>
  )
}
