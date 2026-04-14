import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

// GET /api/brand-lookup/models?brand=Yealink&q=T5 — search models for a brand
export async function GET(req: Request) {
  await assertApiAccess(req)
  const url        = new URL(req.url)
  const brandName  = url.searchParams.get("brand")?.trim() ?? ""
  const q          = url.searchParams.get("q")?.trim() ?? ""

  if (!brandName) return NextResponse.json([])

  const brand = await db.brand.findUnique({
    where: { name: brandName },
    select: { id: true },
  })
  if (!brand) return NextResponse.json([])

  const products = await db.brandProduct.findMany({
    where: {
      brandId:  brand.id,
      isActive: true,
      ...(q ? { modelName: { contains: q } } : {}),
    },
    orderBy: { modelName: "asc" },
    take: 40,
    select: { id: true, modelName: true, category: true, description: true },
  })

  return NextResponse.json(products)
}

// POST /api/brand-lookup/models — create a new model under a brand (creates brand too if missing)
export async function POST(req: Request) {
  await assertApiAccess(req)
  const { brandName, modelName, category, description } = await req.json()

  if (!brandName?.trim()) return NextResponse.json({ error: "brandName is required" }, { status: 400 })
  if (!modelName?.trim())  return NextResponse.json({ error: "modelName is required" }, { status: 400 })

  // Create brand if it doesn't exist
  const brand = await db.brand.upsert({
    where:  { name: brandName.trim() },
    update: {},
    create: { name: brandName.trim(), categories: [] },
  })

  const product = await db.brandProduct.upsert({
    where:  { brandId_modelName: { brandId: brand.id, modelName: modelName.trim() } },
    update: {
      ...(category    ? { category:    category.trim()    } : {}),
      ...(description ? { description: description.trim() } : {}),
    },
    create: {
      brandId:     brand.id,
      modelName:   modelName.trim(),
      category:    category?.trim()    || null,
      description: description?.trim() || null,
    },
    select: { id: true, modelName: true, category: true },
  })

  return NextResponse.json(product)
}
