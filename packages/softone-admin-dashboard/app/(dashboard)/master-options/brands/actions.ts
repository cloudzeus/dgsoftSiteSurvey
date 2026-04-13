"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import type { MasterCategory } from "@prisma/client"

export type BrandRow = {
  id: number
  name: string
  categories: MasterCategory[]
  isCommon: boolean
}

type Result = { brand?: BrandRow; error?: string; success?: boolean; deleted?: number }

function shapeBrand(b: { id: number; name: string; categories: unknown; isCommon: boolean }): BrandRow {
  return {
    ...b,
    categories: Array.isArray(b.categories) ? (b.categories as MasterCategory[]) : [],
  }
}

export async function createBrand(data: {
  name: string
  categories: MasterCategory[]
  isCommon: boolean
}): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.name.trim()) return { error: "Name is required" }
  if (data.categories.length === 0) return { error: "At least one category is required" }
  const existing = await db.brand.findUnique({ where: { name: data.name.trim() } })
  if (existing) return { error: "A brand with that name already exists" }
  const raw = await db.brand.create({
    data: { name: data.name.trim(), categories: data.categories, isCommon: data.isCommon },
  })
  revalidatePath("/master-options/brands")
  return { brand: shapeBrand(raw) }
}

export async function updateBrand(id: number, data: {
  name?: string
  categories?: MasterCategory[]
  isCommon?: boolean
}): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  if (data.categories !== undefined && data.categories.length === 0) {
    return { error: "At least one category is required" }
  }
  const record: Record<string, unknown> = {}
  if (data.name       !== undefined) record.name       = data.name.trim()
  if (data.categories !== undefined) record.categories = data.categories
  if (data.isCommon   !== undefined) record.isCommon   = data.isCommon
  const raw = await db.brand.update({ where: { id }, data: record })
  revalidatePath("/master-options/brands")
  return { brand: shapeBrand(raw) }
}

export async function deleteBrand(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.brand.delete({ where: { id } })
  revalidatePath("/master-options/brands")
  return { success: true }
}

export async function deleteBrands(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.brand.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/brands")
  return { deleted: ids.length }
}
