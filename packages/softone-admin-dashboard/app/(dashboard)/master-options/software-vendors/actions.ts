"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"

export type SoftwareVendorRow = {
  id:   number
  name: string
  _count: { products: number }
}

type Result = { vendor?: SoftwareVendorRow; error?: string; success?: boolean; deleted?: number }

export async function createSoftwareVendor(data: { name: string }): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.name.trim()) return { error: "Name is required" }
  const existing = await db.softwareVendor.findUnique({ where: { name: data.name.trim() } })
  if (existing) return { error: "A vendor with that name already exists" }
  const vendor = await db.softwareVendor.create({
    data: { name: data.name.trim() },
    include: { _count: { select: { products: true } } },
  })
  revalidatePath("/master-options/software-vendors")
  return { vendor }
}

export async function updateSoftwareVendor(id: number, data: { name?: string }): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  const vendor = await db.softwareVendor.update({
    where: { id },
    data: { name: data.name?.trim() },
    include: { _count: { select: { products: true } } },
  })
  revalidatePath("/master-options/software-vendors")
  return { vendor }
}

export async function deleteSoftwareVendor(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.softwareVendor.delete({ where: { id } })
  revalidatePath("/master-options/software-vendors")
  return { success: true }
}

export async function deleteSoftwareVendors(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.softwareVendor.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/software-vendors")
  return { deleted: ids.length }
}
