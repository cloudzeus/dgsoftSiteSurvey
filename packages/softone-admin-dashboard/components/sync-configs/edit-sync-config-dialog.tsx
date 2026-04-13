"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X, Loader2, Check, Sparkles, Database, AlertTriangle, Zap,
  Table2, Users, Package, FileText, ShoppingCart,
  Globe, Building2, Truck, CreditCard, Layers, Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { updateSyncConfig } from "@/app/actions/sync-config"

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHEDULE_PRESETS = [
  { label: "Hourly",  value: "0 * * * *"    },
  { label: "6 hrs",   value: "0 */6 * * *"  },
  { label: "12 hrs",  value: "0 */12 * * *" },
  { label: "Daily",   value: "0 0 * * *"    },
  { label: "Weekly",  value: "0 0 * * 1"    },
]

const MENU_ICONS: { key: string; Icon: React.ElementType }[] = [
  { key: "Database",     Icon: Database     },
  { key: "Table2",       Icon: Table2       },
  { key: "Users",        Icon: Users        },
  { key: "Package",      Icon: Package      },
  { key: "FileText",     Icon: FileText     },
  { key: "ShoppingCart", Icon: ShoppingCart },
  { key: "Globe",        Icon: Globe        },
  { key: "Building2",    Icon: Building2    },
  { key: "Truck",        Icon: Truck        },
  { key: "CreditCard",   Icon: CreditCard   },
  { key: "Layers",       Icon: Layers       },
  { key: "Tag",          Icon: Tag          },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Config {
  id: string
  objectName: string
  tableName: string
  usageType: string
  syncDirection: string
  batchSize: number
  syncSchedule: string
  conflictStrategy: string
  showInMenu: boolean
  menuLabel: string | null
  menuIcon: string | null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        checked ? "bg-indigo-500" : "bg-[var(--muted)]"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditSyncConfigDialog({ config, children }: { config: Config; children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [usageType,        setUsageType]        = useState(config.usageType ?? "PERSISTENT")
  const [syncDirection,    setSyncDirection]    = useState(config.syncDirection)
  const [batchSize,        setBatchSize]        = useState(config.batchSize)
  const [syncSchedule,     setSyncSchedule]     = useState(config.syncSchedule)
  const [conflictStrategy, setConflictStrategy] = useState(config.conflictStrategy)
  const [showInMenu,       setShowInMenu]       = useState(config.showInMenu ?? false)
  const [menuLabel,        setMenuLabel]        = useState(config.menuLabel ?? "")
  const [menuIcon,         setMenuIcon]         = useState(config.menuIcon ?? "Database")

  const isPersistent = usageType === "PERSISTENT"

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await updateSyncConfig(config.id, {
        usageType, syncDirection, batchSize, syncSchedule, conflictStrategy,
        showInMenu,
        menuLabel: showInMenu && menuLabel ? menuLabel : null,
        menuIcon,
      })
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const IconComponent = MENU_ICONS.find((i) => i.key === menuIcon)?.Icon ?? Database

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                <Database className="size-4 text-[var(--primary)]" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-bold text-[var(--foreground)]">Edit Sync Config</Dialog.Title>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">
                  {config.objectName} / {config.tableName}
                </p>
              </div>
            </div>
            <Dialog.Close className="size-8 rounded-xl flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-6 py-5 space-y-5">

            {/* Usage type */}
            <div className="grid grid-cols-2 gap-3">
              {(["PERSISTENT", "REFERENCE"] as const).map((type) => {
                const active = usageType === type
                const isP = type === "PERSISTENT"
                return (
                  <button
                    key={type}
                    onClick={() => setUsageType(type)}
                    className={cn(
                      "rounded-xl border-2 px-4 py-3.5 text-left transition-all",
                      active
                        ? isP ? "border-indigo-500 bg-indigo-500/8" : "border-emerald-500 bg-emerald-500/8"
                        : "border-[var(--border)] hover:border-[var(--muted-foreground)]/40"
                    )}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className={cn("size-6 rounded-lg flex items-center justify-center flex-shrink-0", active ? (isP ? "bg-indigo-500/20" : "bg-emerald-500/20") : "bg-[var(--muted)]")}>
                        {isP
                          ? <Database className={cn("size-3", active ? "text-indigo-400" : "text-[var(--muted-foreground)]")} />
                          : <Zap      className={cn("size-3", active ? "text-emerald-400" : "text-[var(--muted-foreground)]")} />
                        }
                      </div>
                      <span className={cn("text-xs font-bold", active ? (isP ? "text-indigo-400" : "text-emerald-400") : "text-[var(--foreground)]")}>
                        {isP ? "Persistent Table" : "Reference / Lookup"}
                      </span>
                      {active && <Check className={cn("size-3.5 ml-auto flex-shrink-0", isP ? "text-indigo-400" : "text-emerald-400")} />}
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)] leading-relaxed pl-8">
                      {isP ? "Syncs on schedule, stored in MySQL." : "On-demand for dropdowns. No table."}
                    </p>
                  </button>
                )
              })}
            </div>

            {isPersistent && (
              <>
                {/* Direction + Conflict */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Sync Direction</label>
                    <select
                      value={syncDirection}
                      onChange={(e) => setSyncDirection(e.target.value)}
                      className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      <option value="READ">READ — pull from Softone</option>
                      <option value="WRITE">WRITE — push to Softone</option>
                      <option value="BIDIRECTIONAL">BIDIRECTIONAL — both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Conflict Strategy</label>
                    <select
                      value={conflictStrategy}
                      onChange={(e) => setConflictStrategy(e.target.value)}
                      className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      <option value="SOFTONE_WINS">Softone wins (by UPDDATE)</option>
                      <option value="LOCAL_WINS">Local wins</option>
                      <option value="MANUAL_REVIEW">Manual review → queue</option>
                    </select>
                  </div>
                </div>

                {/* Batch + Schedule */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Batch Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={1} max={1000}
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        className="w-28 rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      />
                      <span className="text-xs text-[var(--muted-foreground)]">records / call</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Schedule</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {SCHEDULE_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setSyncSchedule(p.value)}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs border font-medium transition-colors",
                            syncSchedule === p.value
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                              : "border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={syncSchedule}
                      onChange={(e) => setSyncSchedule(e.target.value)}
                      placeholder="cron expression"
                      className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                </div>

                {/* Show in menu */}
                <div className={cn("rounded-xl border-2 overflow-hidden transition-all", showInMenu ? "border-indigo-500/40" : "border-[var(--border)]")}>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn("size-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors", showInMenu ? "bg-indigo-500/15" : "bg-[var(--muted)]")}>
                        <Sparkles className={cn("size-4", showInMenu ? "text-indigo-400" : "text-[var(--muted-foreground)]")} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">Show in sidebar</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Add this table to the Data Tables navigation group</p>
                      </div>
                    </div>
                    <Toggle checked={showInMenu} onChange={() => setShowInMenu((v) => !v)} />
                  </div>

                  {showInMenu && (
                    <div className="px-4 pb-4 border-t border-[var(--border)]/60 pt-4 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Menu label</label>
                        <input
                          type="text"
                          value={menuLabel}
                          onChange={(e) => setMenuLabel(e.target.value)}
                          placeholder="e.g. Customers"
                          className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Icon</label>
                        <div className="grid grid-cols-6 gap-1.5">
                          {MENU_ICONS.map(({ key, Icon }) => (
                            <button
                              key={key}
                              onClick={() => setMenuIcon(key)}
                              title={key}
                              className={cn(
                                "rounded-xl p-2.5 flex items-center justify-center transition-all border",
                                menuIcon === key
                                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-400 scale-105"
                                  : "border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                              )}
                            >
                              <Icon className="size-4" />
                            </button>
                          ))}
                        </div>

                        {/* Live preview */}
                        <div className="mt-3 flex items-center gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/5 px-4 py-3">
                          <div className="size-7 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="size-3.5 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[var(--foreground)]">{menuLabel || config.tableName}</p>
                            <p className="text-[10px] text-[var(--muted-foreground)]">Sidebar preview</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {!isPersistent && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Zap className="size-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-400 mb-1">On-demand lookup</p>
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                      Available at <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-400">/api/softone/lookup?config={config.id}</span>
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">No MySQL table or cron job.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3">
                <AlertTriangle className="size-4 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--destructive)]">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--border)] flex-shrink-0">
            <Dialog.Close className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted)] transition-colors">
              Cancel
            </Dialog.Close>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
