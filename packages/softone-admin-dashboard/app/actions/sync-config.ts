"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"

export async function deleteSyncConfig(id: string) {
  await requireResourceAction("sync-configs", "delete")
  await db.syncConfig.delete({ where: { id } })
  revalidatePath("/sync-configs")
}

export async function toggleSyncConfig(id: string, isActive: boolean) {
  await requireResourceAction("sync-configs", "edit")
  await db.syncConfig.update({ where: { id }, data: { isActive } })
  revalidatePath("/sync-configs")
}

export async function updateSyncConfig(
  id: string,
  data: {
    syncDirection: string
    batchSize: number
    syncSchedule: string
    conflictStrategy: string
    usageType: string
    showInMenu: boolean
    menuLabel: string | null
    menuIcon: string
  }
) {
  await requireResourceAction("sync-configs", "edit")
  await db.syncConfig.update({ where: { id }, data })
  revalidatePath("/sync-configs")
  revalidatePath(`/sync-configs/${id}`)
}
