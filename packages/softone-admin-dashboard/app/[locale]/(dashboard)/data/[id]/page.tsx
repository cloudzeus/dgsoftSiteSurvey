import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { DataTableViewer } from "@/components/data-viewer/data-table-viewer"
import { formatDistanceToNow } from "date-fns"
import { Database, Clock, RefreshCw, Zap } from "lucide-react"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const config = await db.syncConfig.findUnique({ where: { id } })
  return { title: config?.menuLabel ?? config?.tableName ?? "Data Table" }
}

export default async function DataTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const config = await db.syncConfig.findUnique({
    where: { id },
    include: {
      fieldMappings: {
        where:   { isSyncable: true },
        orderBy: [{ isPrimaryKey: "desc" }],
      },
      _count: { select: { syncJobs: true } },
    },
  })

  if (!config) notFound()

  const isReference = config.usageType === "REFERENCE"

  const configMeta = {
    id:          config.id,
    objectName:  config.objectName,
    tableName:   config.tableName,
    menuLabel:   config.menuLabel,
    lastSyncedAt: config.lastSyncedAt,
    isLive:      isReference,
    fieldMappings: config.fieldMappings.map((f) => ({
      key:          isReference ? f.softoneFieldName : f.localColumnName,
      label:        f.softoneFieldName,
      dataType:     f.dataType,
      isPrimaryKey: f.isPrimaryKey,
      isCustom:     f.isCustom,
    })),
  }

  const localTable = `softone_${config.tableName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`

  return (
    <div className="space-y-5 w-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
            <Database className="size-5 text-[var(--primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                {config.menuLabel ?? config.tableName}
              </h1>
              {isReference && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  <Zap className="size-2.5" />
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[var(--muted-foreground)] font-mono">{config.objectName}</span>
              <span className="text-[var(--border)]">·</span>
              {isReference ? (
                <span className="text-xs text-[var(--muted-foreground)]">fetched live from Softone</span>
              ) : (
                <>
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">{localTable}</span>
                  {config.lastSyncedAt && (
                    <>
                      <span className="text-[var(--border)]">·</span>
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                        <Clock className="size-3" />
                        synced {formatDistanceToNow(config.lastSyncedAt, { addSuffix: true })}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <a
          href={`/sync-configs/${config.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors flex-shrink-0"
        >
          <RefreshCw className="size-3.5" />
          Sync settings
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {(isReference
          ? [
              { label: "Fields mapped", value: config.fieldMappings.length },
              { label: "Source",        value: config.objectName, mono: true },
              { label: "Table",         value: config.tableName,  mono: true },
            ]
          : [
              { label: "Fields mapped", value: config.fieldMappings.length },
              { label: "Sync jobs run",  value: config._count.syncJobs },
              { label: "Schedule",       value: config.syncSchedule, mono: true },
            ]
        ).map(({ label, value, mono }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">{label}</p>
            <p className={cn("text-sm font-bold text-[var(--foreground)]", mono && "font-mono text-xs")}>{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <DataTableViewer config={configMeta} />
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
