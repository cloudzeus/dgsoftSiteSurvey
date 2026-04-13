import { db } from "@/lib/db"
import { BackupsClient, type BackupRow } from "@/components/backups/backups-client"

export const metadata = { title: "Database Backups" }

export default async function BackupsPage() {
  const backups = await db.databaseBackup.findMany({
    orderBy: { createdAt: "desc" },
  })

  const rows: BackupRow[] = backups.map((b) => ({
    id: b.id,
    filename: b.filename,
    bunnyUrl: b.bunnyUrl ?? null,
    fileSizeBytes: b.fileSizeBytes ? Number(b.fileSizeBytes) : null,
    status: b.status,
    notes: b.notes ?? null,
    createdAt: b.createdAt.toISOString(),
    completedAt: b.completedAt?.toISOString() ?? null,
    restoredAt: b.restoredAt?.toISOString() ?? null,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          Database Backups
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
          Create and restore MySQL backups stored on Bunny CDN
        </p>
      </div>
      <BackupsClient initialBackups={rows} />
    </div>
  )
}
