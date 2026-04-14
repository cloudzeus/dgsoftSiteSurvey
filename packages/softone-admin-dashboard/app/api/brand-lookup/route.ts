import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

// GET /api/brand-lookup?q=cisco — search brands by name (contains, case-insensitive)
export async function GET(req: Request) {
  await assertApiAccess(req)
  const url = new URL(req.url)
  const q   = url.searchParams.get("q")?.trim() ?? ""

  const brands = await db.brand.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { name: "asc" },
    take: 30,
    select: { id: true, name: true, categories: true },
  })

  return NextResponse.json(brands)
}

// POST /api/brand-lookup — create a new brand if it doesn't exist
export async function POST(req: Request) {
  await assertApiAccess(req)
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const brand = await db.brand.upsert({
    where:  { name: name.trim() },
    update: {},
    create: { name: name.trim(), categories: [] },
    select: { id: true, name: true },
  })

  return NextResponse.json(brand)
}
