"use client"

import { Plus } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { CreateSyncConfigDialog } from "./create-sync-config-dialog"

export function CreateSyncConfigButton() {
  return (
    <CreateSyncConfigDialog>
      <Btn variant="primary" size="sm">
        <Plus className="size-3.5" />
        New Config
      </Btn>
    </CreateSyncConfigDialog>
  )
}
