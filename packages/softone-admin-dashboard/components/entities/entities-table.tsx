"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { GitMerge, Plus, Trash2, MoreHorizontal, Loader2, Power, ExternalLink, Play } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { CreateEntityWizard } from "./create-entity-wizard"

const TYPE_COLORS: Record<string, string> = {
  SOFTONE:     "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  SHOPIFY:     "bg-green-500/10 text-green-400 border-green-500/20",
  MAGENTO:     "bg-orange-500/10 text-orange-400 border-orange-500/20",
  WOOCOMMERCE: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  CUSTOM_REST: "bg-sky-500/10 text-sky-400 border-sky-500/20",
}

const DIR_COLORS: Record<string, string> = {
  INBOUND:  "bg-emerald-500/10 text-emerald-400",
  OUTBOUND: "bg-amber-500/10 text-amber-400",
  BOTH:     "bg-indigo-500/10 text-indigo-400",
}

interface Connection { id: string; name: string; type: string }
interface Binding { id: string; direction: string; objectName: string; connection: Connection }
interface Entity {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  showInMenu: boolean
  createdAt: Date
  _count: { records: number; bindings: number }
  bindings: Binding[]
}

export function EntitiesTable({
  entities,
  connections,
}: {
  entities: Entity[]
  connections: { id: string; name: string; type: string }[]
}) {
  const router = useRouter()
  const [processing, setProcessing] = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)

  async function handleProcess(id: string) {
    setProcessing(id)
    try {
      await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: id }),
      })
      router.refresh()
    } finally { setProcessing(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entity and all its records? This cannot be undone.")) return
    setDeleting(id)
    try {
      await fetch(`/api/entities/${id}`, { method: "DELETE" })
      router.refresh()
    } finally { setDeleting(null) }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/entities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    })
    router.refresh()
  }

  if (entities.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-20"
        style={{ borderColor: "var(--border)" }}>
        <div className="size-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-indigo-900 to-indigo-700 shadow-lg">
          <GitMerge className="size-6 text-white" />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>No entities yet</p>
        <p className="text-xs mb-5" style={{ color: "var(--foreground-muted)" }}>
          Define your first canonical entity to start orchestrating data between systems
        </p>
        <CreateEntityWizard connections={connections}>
          <Btn variant="primary" size="md">
            <Plus className="size-3.5" />
            New entity
          </Btn>
        </CreateEntityWizard>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateEntityWizard connections={connections}>
          <Btn variant="primary" size="sm">
            <Plus className="size-3.5" />
            New entity
          </Btn>
        </CreateEntityWizard>
      </div>

      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/20" }}>
              {["Entity", "Bindings", "Records", "Created", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--muted-foreground)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entities.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: i < entities.length - 1 ? "1px solid var(--border)" : "none" }}>

                {/* Name + slug */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("size-2 rounded-full shrink-0", e.isActive ? "bg-emerald-400" : "bg-zinc-500")} />
                    <div>
                      <Link href={`/entities/${e.id}`}
                        className="text-[13px] font-semibold hover:underline"
                        style={{ color: "var(--foreground)" }}>
                        {e.name}
                      </Link>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>/{e.slug}</p>
                    </div>
                  </div>
                </td>

                {/* Bindings */}
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {e.bindings.length === 0 ? (
                      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>None</span>
                    ) : e.bindings.map((b) => (
                      <div key={b.id} className="flex items-center gap-1">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", DIR_COLORS[b.direction])}>
                          {b.direction === "INBOUND" ? "IN" : b.direction === "OUTBOUND" ? "OUT" : "BOTH"}
                        </span>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md border",
                          TYPE_COLORS[b.connection.type] ?? "bg-zinc-500/10 text-zinc-400")}>
                          {b.connection.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>

                {/* Record count */}
                <td className="px-4 py-3.5">
                  <Link href={`/records/${e.id}`}
                    className="text-[13px] font-semibold tabular-nums hover:underline"
                    style={{ color: "var(--foreground)" }}>
                    {e._count.records.toLocaleString()}
                  </Link>
                </td>

                {/* Created */}
                <td className="px-4 py-3.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                </td>

                {/* Actions */}
                <td className="px-4 py-3.5">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="size-7 rounded-lg flex items-center justify-center"
                        style={{ color: "var(--muted-foreground)" }}>
                        {processing === e.id || deleting === e.id
                          ? <Loader2 className="size-4 animate-spin" />
                          : <MoreHorizontal className="size-4" />}
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end"
                        className="z-50 min-w-44 rounded-xl border p-1 shadow-xl"
                        style={{ background: "var(--card)", borderColor: "var(--border)" }}>

                        <DropdownMenu.Item asChild>
                          <Link href={`/entities/${e.id}`}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors">
                            <ExternalLink className="size-3.5" style={{ color: "#6366f1" }} />
                            Configure / Templates
                          </Link>
                        </DropdownMenu.Item>

                        <DropdownMenu.Item asChild>
                          <Link href={`/records/${e.id}`}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors">
                            <ExternalLink className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                            View records
                          </Link>
                        </DropdownMenu.Item>

                        <DropdownMenu.Item onSelect={() => handleProcess(e.id)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors">
                          <Play className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                          Process now
                        </DropdownMenu.Item>

                        <DropdownMenu.Separator className="my-1 h-px" style={{ background: "var(--border)" }} />

                        <DropdownMenu.Item onSelect={() => handleToggle(e.id, e.isActive)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors">
                          <Power className={cn("size-3.5", e.isActive ? "text-amber-500" : "text-emerald-500")} />
                          {e.isActive ? "Disable" : "Enable"}
                        </DropdownMenu.Item>

                        <DropdownMenu.Separator className="my-1 h-px" style={{ background: "var(--border)" }} />

                        <DropdownMenu.Item onSelect={() => handleDelete(e.id)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none transition-colors text-red-500 hover:bg-red-500/8">
                          <Trash2 className="size-3.5" />
                          Delete
                        </DropdownMenu.Item>

                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
