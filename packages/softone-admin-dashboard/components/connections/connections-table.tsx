"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Plug, Plus, Trash2, CheckCircle2, XCircle, Loader2, MoreHorizontal, RefreshCw, Power, Pencil, BookOpen } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Btn } from "@/components/ui/btn"
import { cn } from "@/lib/utils"
import { CreateConnectionDialog } from "./create-connection-dialog"
import { EditConnectionDialog } from "./edit-connection-dialog"
import { ConnectionInfoDialog } from "./connection-info-dialog"

interface Connection {
  id: string
  name: string
  type: string
  baseUrl: string | null
  isActive: boolean
  lastTestedAt: Date | null
  lastTestOk: boolean | null
  createdAt: Date
  _count: { bindings: number }
}

const TYPE_COLORS: Record<string, string> = {
  SOFTONE:      "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  SHOPIFY:      "bg-green-500/10 text-green-400 border-green-500/20",
  MAGENTO:      "bg-orange-500/10 text-orange-400 border-orange-500/20",
  WOOCOMMERCE:  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OPENAI:       "bg-teal-500/10 text-teal-400 border-teal-500/20",
  DEEPSEEK:     "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  MAILGUN:      "bg-red-500/10 text-red-400 border-red-500/20",
  BUNNY_CDN:    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  CUSTOM_REST:  "bg-sky-500/10 text-sky-400 border-sky-500/20",
  GEOCODE_MAPS: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  BRAVE_SEARCH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  AEEDE_VAT:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  VIVA_PAYMENTS:  "bg-violet-500/10 text-violet-400 border-violet-500/20",
  YUBOTO_SMS:     "bg-lime-500/10 text-lime-400 border-lime-500/20",
}

const TYPE_LABELS: Record<string, string> = {
  SOFTONE:     "Softone ERP",
  SHOPIFY:     "Shopify",
  MAGENTO:     "Magento",
  WOOCOMMERCE: "WooCommerce",
  OPENAI:      "OpenAI",
  DEEPSEEK:    "DeepSeek",
  MAILGUN:     "Mailgun",
  BUNNY_CDN:   "Bunny CDN",
  CUSTOM_REST:  "Custom REST",
  GEOCODE_MAPS: "Geocode Maps",
  BRAVE_SEARCH: "Brave Search",
  AEEDE_VAT:     "AEEDE VAT Info",
  VIVA_PAYMENTS: "Viva Payments",
  YUBOTO_SMS:    "Yuboto SMS",
}

function typeColor(type: string) {
  return TYPE_COLORS[type] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
}
function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type
}

export function ConnectionsTable({ connections, isAdmin = false }: { connections: Connection[]; isAdmin?: boolean }) {
  const router = useRouter()
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editConn, setEditConn] = useState<{ id: string; name: string; type: string; credentials: Record<string, any> } | null>(null)
  const [infoConn, setInfoConn] = useState<{ name: string; type: string } | null>(null)

  async function openEdit(id: string, name: string, type: string) {
    const res = await fetch(`/api/connections/${id}`)
    const data = await res.json()
    setEditConn({ id, name, type, credentials: data.credentials ?? {} })
  }

  async function testConnection(id: string) {
    setTesting(id)
    try {
      await fetch(`/api/connections/${id}/test`, { method: "POST" })
      router.refresh()
    } finally { setTesting(null) }
  }

  async function deleteConnection(id: string) {
    if (!confirm("Delete this connection? Any associated entity bindings will also be removed.")) return
    setDeleting(id)
    try {
      await fetch(`/api/connections/${id}`, { method: "DELETE" })
      router.refresh()
    } finally { setDeleting(null) }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    })
    router.refresh()
  }

  if (connections.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-20" style={{ borderColor: "var(--border)" }}>
        <div className="size-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-indigo-900 to-indigo-700 shadow-lg">
          <Plug className="size-6 text-white" />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>No connections yet</p>
        <p className="text-xs mb-5" style={{ color: "var(--foreground-muted)" }}>
          {isAdmin ? "Add your first external system to start building pipelines" : "No connections have been configured yet"}
        </p>
        {isAdmin && (
          <CreateConnectionDialog>
            <Btn variant="primary" size="md">
              <Plus className="size-3.5" />
              Add connection
            </Btn>
          </CreateConnectionDialog>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <CreateConnectionDialog>
            <Btn variant="primary" size="sm">
              <Plus className="size-3.5" />
              Add connection
            </Btn>
          </CreateConnectionDialog>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)/30" }}>
              {["Connection", "Type", "Status", "Bindings", "Last Tested", ...(isAdmin ? [""] : [])].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {connections.map((c, i) => (
              <tr
                key={c.id}
                style={{ borderBottom: i < connections.length - 1 ? "1px solid var(--border)" : "none" }}
                className="group"
              >
                {/* Name */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("size-2 rounded-full", c.isActive ? "bg-emerald-400" : "bg-zinc-500")} />
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</p>
                      {c.baseUrl && (
                        <p className="text-[11px] font-mono truncate max-w-48" style={{ color: "var(--muted-foreground)" }}>{c.baseUrl}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="px-4 py-3.5">
                  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", typeColor(c.type))}>
                    {typeLabel(c.type)}
                  </span>
                </td>

                {/* Test status */}
                <td className="px-4 py-3.5">
                  {c.lastTestedAt === null ? (
                    <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Never tested</span>
                  ) : c.lastTestOk ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      <span className="text-[12px] text-emerald-500">OK</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="size-3.5 text-red-500" />
                      <span className="text-[12px] text-red-500">Failed</span>
                    </div>
                  )}
                </td>

                {/* Bindings */}
                <td className="px-4 py-3.5">
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {c._count.bindings}
                  </span>
                </td>

                {/* Last tested */}
                <td className="px-4 py-3.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {c.lastTestedAt ? formatDistanceToNow(new Date(c.lastTestedAt), { addSuffix: true }) : "—"}
                </td>

                {/* Actions — admin only */}
                {isAdmin && <td className="px-4 py-3.5">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="size-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: "var(--muted-foreground)" }}>
                        {testing === c.id || deleting === c.id
                          ? <Loader2 className="size-4 animate-spin" />
                          : <MoreHorizontal className="size-4" />}
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-xl border p-1 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                        <DropdownMenu.Item
                          onSelect={() => setInfoConn({ name: c.name, type: c.type })}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors"
                        >
                          <BookOpen className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                          View capabilities
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator className="my-1 h-px" style={{ background: "var(--border)" }} />
                        <DropdownMenu.Item
                          onSelect={() => testConnection(c.id)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors"
                        >
                          <RefreshCw className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                          Test connection
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => openEdit(c.id, c.name, c.type)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors"
                        >
                          <Pencil className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                          Edit credentials
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => toggleActive(c.id, c.isActive)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-[var(--muted)] transition-colors"
                        >
                          <Power className={cn("size-3.5", c.isActive ? "text-amber-500" : "text-emerald-500")} />
                          {c.isActive ? "Disable" : "Enable"}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator className="my-1 h-px" style={{ background: "var(--border)" }} />
                        <DropdownMenu.Item
                          onSelect={() => deleteConnection(c.id)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none transition-colors text-red-500 hover:bg-red-500/8"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit credentials dialog — controlled by editConn state */}
      {editConn && (
        <EditConnectionDialog
          key={editConn.id}
          connection={editConn}
          open={true}
          onClose={() => setEditConn(null)}
        />
      )}

      {/* Capabilities info dialog */}
      {infoConn && (
        <ConnectionInfoDialog
          key={infoConn.type}
          connectionName={infoConn.name}
          connectionType={infoConn.type}
          open={true}
          onClose={() => setInfoConn(null)}
        />
      )}
    </div>
  )
}
