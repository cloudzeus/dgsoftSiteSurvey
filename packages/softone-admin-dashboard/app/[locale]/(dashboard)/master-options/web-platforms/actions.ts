"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import type { WebCategory } from "@prisma/client"

export type WebPlatformRow = {
  id:       number
  name:     string
  category: WebCategory
  isSaaS:   boolean
}

type Result = { platform?: WebPlatformRow; error?: string; success?: boolean; deleted?: number }

export async function createWebPlatform(data: { name: string; category: WebCategory; isSaaS: boolean }): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.name.trim()) return { error: "Name is required" }
  const existing = await db.webPlatform.findUnique({ where: { name: data.name.trim() } })
  if (existing) return { error: "A platform with that name already exists" }
  const platform = await db.webPlatform.create({ data: { name: data.name.trim(), category: data.category, isSaaS: data.isSaaS } })
  revalidatePath("/master-options/web-platforms")
  return { platform }
}

export async function updateWebPlatform(id: number, data: { name?: string; category?: WebCategory; isSaaS?: boolean }): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  const platform = await db.webPlatform.update({
    where: { id },
    data: { name: data.name?.trim(), category: data.category, isSaaS: data.isSaaS },
  })
  revalidatePath("/master-options/web-platforms")
  return { platform }
}

export async function deleteWebPlatform(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.webPlatform.delete({ where: { id } })
  revalidatePath("/master-options/web-platforms")
  return { success: true }
}

export async function deleteWebPlatforms(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.webPlatform.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/web-platforms")
  return { deleted: ids.length }
}
