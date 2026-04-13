"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import type { SoftwareType } from "@prisma/client"

export type SoftwareProductRow = {
  id:       number
  name:     string
  type:     SoftwareType
  vendorId: number
  vendor:   { id: number; name: string }
}

type Result = { product?: SoftwareProductRow; error?: string; success?: boolean; deleted?: number }

const INCLUDE = { vendor: { select: { id: true, name: true } } } as const

export async function createSoftwareProduct(data: {
  name: string; type: SoftwareType; vendorId: number
}): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.name.trim()) return { error: "Name is required" }
  const existing = await db.softwareProduct.findUnique({ where: { name: data.name.trim() } })
  if (existing) return { error: "A product with that name already exists" }
  const product = await db.softwareProduct.create({
    data: { name: data.name.trim(), type: data.type, vendorId: data.vendorId },
    include: INCLUDE,
  })
  revalidatePath("/master-options/software-products")
  return { product }
}

export async function updateSoftwareProduct(id: number, data: {
  name?: string; type?: SoftwareType; vendorId?: number
}): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  const record: Record<string, unknown> = {}
  if (data.name     !== undefined) record.name     = data.name.trim()
  if (data.type     !== undefined) record.type     = data.type
  if (data.vendorId !== undefined) record.vendorId = data.vendorId
  const product = await db.softwareProduct.update({ where: { id }, data: record, include: INCLUDE })
  revalidatePath("/master-options/software-products")
  return { product }
}

export async function deleteSoftwareProduct(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.softwareProduct.delete({ where: { id } })
  revalidatePath("/master-options/software-products")
  return { success: true }
}

export async function deleteSoftwareProducts(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.softwareProduct.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/software-products")
  return { deleted: ids.length }
}
