import { db } from "@/lib/db"
import { SyncConfigsTable } from "@/components/sync-configs/sync-configs-table"
import { CreateSyncConfigButton } from "@/components/sync-configs/create-sync-config-button"
import { SoftoneConnectionModal } from "@/components/softone/connection-modal"

export const metadata = { title: "Sync Configs" }

export default async function SyncConfigsPage() {
  const configs = await db.syncConfig.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { syncJobs: true, fieldMappings: true } } },
  })

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Sync Configurations
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            {configs.length} configuration{configs.length !== 1 ? "s" : ""} · manage Softone object sync settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SoftoneConnectionModal />
          <CreateSyncConfigButton />
        </div>
      </div>

      <SyncConfigsTable configs={configs} />
    </div>
  )
}
