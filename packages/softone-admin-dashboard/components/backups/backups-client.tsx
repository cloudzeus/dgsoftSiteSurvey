"use client"

import { useState, useTransition } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { DatabaseIcon, DownloadCloud, RefreshCw, RotateCcw, Trash2, X } from "lucide-react"

export type BackupRow = {
  id: string
  filename: string
  bunnyUrl: string | null
  fileSizeBytes: number | null
  status: string
  notes: string | null
  createdAt: string
  completedAt: string | null
  restoredAt: string | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  PENDING:   "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  FAILED:    "bg-red-500/15 text-red-400 border border-red-500/25",
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  PENDING:   "In progress",
  FAILED:    "Failed",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", STATUS_STYLE[status] ?? "bg-zinc-500/15 text-zinc-400 border border-zinc-500/25")}>
      {status === "PENDING" && <RefreshCw className="size-2.5 animate-spin" />}
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function BackupsClient({ initialBackups }: { initialBackups: BackupRow[] }) {
  const [backups, setBackups] = useState<BackupRow[]>(initialBackups)
  const [creating, startCreate] = useTransition()
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [refreshing, startRefresh] = useTransition()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const confirmBackup = backups.find((b) => b.id === confirmId)

  async function handleCreate() {
    startCreate(async () => {
      const res = await fetch("/api/backups", { method: "POST" })
      if (!res.ok) return
      const row: BackupRow = await res.json()
      setBackups((prev) => [{ ...row, fileSizeBytes: null, bunnyUrl: null, completedAt: null, restoredAt: null }, ...prev])
      pollBackup(row.id)
    })
  }

  function pollBackup(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch("/api/backups")
      if (!res.ok) return
      const all: BackupRow[] = await res.json()
      setBackups(all)
      const updated = all.find((b) => b.id === id)
      if (!updated || updated.status !== "PENDING") clearInterval(interval)
    }, 3000)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/backups/${id}`, { method: "DELETE" })
      setBackups((prev) => prev.filter((b) => b.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRestore(id: string) {
    setConfirmId(null)
    setRestoringId(id)
    try {
      const res = await fetch(`/api/backups/${id}/restore`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Restore failed" }))
        alert(err.error ?? "Restore failed")
        return
      }
      const data = await res.json()
      setBackups((prev) => prev.map((b) => b.id === id ? { ...b, restoredAt: data.restoredAt } : b))
    } finally {
      setRestoringId(null)
    }
  }

  function handleRefresh() {
    startRefresh(async () => {
      const res = await fetch("/api/backups")
      if (!res.ok) return
      setBackups(await res.json())
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          {backups.length} backup{backups.length !== 1 ? "s" : ""} stored on Bunny CDN
        </p>
        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw className="size-3.5 mr-1.5" />
            Refresh
          </Btn>
          <Btn variant="primary" size="sm" onClick={handleCreate} loading={creating}>
            <DatabaseIcon className="size-3.5 mr-1.5" />
            {creating ? "Creating…" : "Create Backup"}
          </Btn>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {["Filename", "Size", "Status", "Created", "Last Restored", ""].map((h) => (
                <th
                  key={h}
                  className={cn("px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide", h === "" && "text-right")}
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  No backups yet. Click &quot;Create Backup&quot; to get started.
                </td>
              </tr>
            )}
            {backups.map((b, i) => (
              <tr
                key={b.id}
                style={{
                  borderTop: i === 0 ? undefined : "1px solid var(--border)",
                  background: "var(--background)",
                }}
              >
                <td className="px-3 py-3 font-mono text-[11px]" style={{ color: "var(--foreground)" }}>
                  {b.filename}
                </td>
                <td className="px-3 py-3" style={{ color: "var(--muted-foreground)" }}>
                  {b.fileSizeBytes != null ? formatBytes(b.fileSizeBytes) : "—"}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={b.status} />
                  {b.status === "FAILED" && b.notes && (
                    <p className="text-[11px] mt-0.5 truncate max-w-[200px]" style={{ color: "var(--destructive)" }} title={b.notes}>
                      {b.notes}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3" style={{ color: "var(--muted-foreground)" }}>
                  {formatDate(b.createdAt)}
                </td>
                <td className="px-3 py-3" style={{ color: "var(--muted-foreground)" }}>
                  {b.restoredAt ? formatDate(b.restoredAt) : "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {b.bunnyUrl && (
                      <a
                        href={b.bunnyUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        title="Download backup"
                        className="btn btn-ghost btn-icon-sm"
                      >
                        <DownloadCloud className="size-3.5" />
                      </a>
                    )}
                    {b.status === "COMPLETED" && (
                      <button
                        title="Restore this backup"
                        className="btn btn-ghost btn-icon-sm"
                        disabled={restoringId === b.id}
                        onClick={() => setConfirmId(b.id)}
                      >
                        {restoringId === b.id
                          ? <RefreshCw className="size-3.5 animate-spin" />
                          : <RotateCcw className="size-3.5" />
                        }
                      </button>
                    )}
                    <button
                      title="Delete backup"
                      className="btn btn-ghost btn-icon-sm"
                      disabled={deletingId === b.id}
                      onClick={() => handleDelete(b.id)}
                      style={{ color: "var(--destructive)" }}
                    >
                      {deletingId === b.id
                        ? <RefreshCw className="size-3.5 animate-spin" />
                        : <Trash2 className="size-3.5" />
                      }
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Restore confirmation dialog */}
      <Dialog.Root open={!!confirmId} onOpenChange={(open) => { if (!open) setConfirmId(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
          />
          <Dialog.Content
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-xl p-6 w-full max-w-md"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <Dialog.Title className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                Restore this backup?
              </Dialog.Title>
              <Dialog.Close className="btn btn-ghost btn-icon-sm -mt-1 -mr-1">
                <X className="size-3.5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="text-[13px] mb-6" style={{ color: "var(--muted-foreground)" }}>
              This will overwrite the current database with{" "}
              <span className="font-mono text-[11px]" style={{ color: "var(--foreground)" }}>
                {confirmBackup?.filename}
              </span>{" "}
              from {confirmBackup ? formatDate(confirmBackup.createdAt) : ""}. This action cannot be undone.
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Btn variant="secondary" size="sm">Cancel</Btn>
              </Dialog.Close>
              <Btn variant="danger" size="sm" onClick={() => confirmId && handleRestore(confirmId)}>
                Restore
              </Btn>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
