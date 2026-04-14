import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request) {
  await assertApiAccess(req)
  // Return distinct non-null categories already in use, optionally filtered by brand
  const url = new URL(req.url)
  const brandName = url.searchParams.get("brand")

  const where = brandName
    ? { brand: { name: brandName }, category: { not: null } }
    : { category: { not: null } }

  const rows = await db.brandProduct.findMany({
    where,
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  })

  const categories = rows.map(r => r.category).filter(Boolean) as string[]
  return NextResponse.json(categories)
}
