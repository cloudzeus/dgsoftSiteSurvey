"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import type { MasterCategory } from "@prisma/client"

export type AssetTypeRow = {
  id: number
  name: string
  category: MasterCategory
}

type Result = { assetType?: AssetTypeRow; error?: string; success?: boolean; deleted?: number }

export async function createAssetType(data: {
  name: string
  category: MasterCategory
}): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.name.trim()) return { error: "Name is required" }
  const existing = await db.assetType.findUnique({ where: { name: data.name.trim() } })
  if (existing) return { error: "An asset type with that name already exists" }
  const assetType = await db.assetType.create({ data: { name: data.name.trim(), category: data.category } })
  revalidatePath("/master-options/asset-types")
  return { assetType }
}

export async function updateAssetType(id: number, data: {
  name?: string
  category?: MasterCategory
}): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  const record: Record<string, unknown> = {}
  if (data.name     !== undefined) record.name     = data.name.trim()
  if (data.category !== undefined) record.category = data.category
  const assetType = await db.assetType.update({ where: { id }, data: record })
  revalidatePath("/master-options/asset-types")
  return { assetType }
}

export async function deleteAssetType(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.assetType.delete({ where: { id } })
  revalidatePath("/master-options/asset-types")
  return { success: true }
}

export async function deleteAssetTypes(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.assetType.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/asset-types")
  return { deleted: ids.length }
}
