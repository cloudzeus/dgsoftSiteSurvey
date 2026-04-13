"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"

export type IotCategoryRow = {
  id:    number
  name:  string
  _count: { products: number }
}

type Result = { category?: IotCategoryRow; error?: string; success?: boolean; deleted?: number }

export async function createIotCategory(data: { name: string }): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.name.trim()) return { error: "Name is required" }
  const existing = await db.iotCategory.findUnique({ where: { name: data.name.trim() } })
  if (existing) return { error: "A category with that name already exists" }
  const category = await db.iotCategory.create({
    data: { name: data.name.trim() },
    include: { _count: { select: { products: true } } },
  })
  revalidatePath("/master-options/iot-categories")
  return { category }
}

export async function updateIotCategory(id: number, data: { name: string }): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  const category = await db.iotCategory.update({
    where: { id },
    data: { name: data.name.trim() },
    include: { _count: { select: { products: true } } },
  })
  revalidatePath("/master-options/iot-categories")
  return { category }
}

export async function deleteIotCategory(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.iotCategory.delete({ where: { id } })
  revalidatePath("/master-options/iot-categories")
  return { success: true }
}

export async function deleteIotCategories(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.iotCategory.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/iot-categories")
  return { deleted: ids.length }
}
