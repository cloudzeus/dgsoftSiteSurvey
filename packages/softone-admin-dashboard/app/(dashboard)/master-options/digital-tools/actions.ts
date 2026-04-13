"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import type { DigitalToolType } from "@prisma/client"

export type DigitalToolRow = {
  id:   number
  name: string
  type: DigitalToolType
}

type Result = { tool?: DigitalToolRow; error?: string; success?: boolean; deleted?: number }

export async function createDigitalTool(data: { name: string; type: DigitalToolType }): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.name.trim()) return { error: "Name is required" }
  const existing = await db.digitalTool.findUnique({ where: { name: data.name.trim() } })
  if (existing) return { error: "A tool with that name already exists" }
  const tool = await db.digitalTool.create({ data: { name: data.name.trim(), type: data.type } })
  revalidatePath("/master-options/digital-tools")
  return { tool }
}

export async function updateDigitalTool(id: number, data: { name?: string; type?: DigitalToolType }): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  const tool = await db.digitalTool.update({
    where: { id },
    data: { name: data.name?.trim(), type: data.type },
  })
  revalidatePath("/master-options/digital-tools")
  return { tool }
}

export async function deleteDigitalTool(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.digitalTool.delete({ where: { id } })
  revalidatePath("/master-options/digital-tools")
  return { success: true }
}

export async function deleteDigitalTools(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.digitalTool.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/digital-tools")
  return { deleted: ids.length }
}
