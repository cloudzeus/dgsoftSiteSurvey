"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import type { IotTech } from "@prisma/client"

export type IotProductRow = {
  id:          number
  modelName:   string
  description: string | null
  technology:  IotTech
  categoryId:  number
  category:    { id: number; name: string }
}

type Result = { product?: IotProductRow; error?: string; success?: boolean; deleted?: number }

export async function createIotProduct(data: { modelName: string; description?: string; technology: IotTech; categoryId: number }): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.modelName.trim()) return { error: "Model name is required" }
  if (!data.categoryId) return { error: "Category is required" }
  const existing = await db.iotProduct.findUnique({ where: { modelName: data.modelName.trim() } })
  if (existing) return { error: "A product with that model name already exists" }
  const product = await db.iotProduct.create({
    data: { modelName: data.modelName.trim(), description: data.description?.trim() || null, technology: data.technology, categoryId: data.categoryId },
    include: { category: { select: { id: true, name: true } } },
  })
  revalidatePath("/master-options/iot-products")
  return { product }
}

export async function updateIotProduct(id: number, data: { modelName?: string; description?: string; technology?: IotTech; categoryId?: number }): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  const product = await db.iotProduct.update({
    where: { id },
    data: {
      modelName:   data.modelName?.trim(),
      description: data.description !== undefined ? (data.description.trim() || null) : undefined,
      technology:  data.technology,
      categoryId:  data.categoryId,
    },
    include: { category: { select: { id: true, name: true } } },
  })
  revalidatePath("/master-options/iot-products")
  return { product }
}

export async function deleteIotProduct(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.iotProduct.delete({ where: { id } })
  revalidatePath("/master-options/iot-products")
  return { success: true }
}

export async function deleteIotProducts(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.iotProduct.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/iot-products")
  return { deleted: ids.length }
}
