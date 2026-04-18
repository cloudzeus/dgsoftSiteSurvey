"use client"

import { useState } from "react"
import { Search, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { VatLookup } from "@/components/aeede/vat-lookup"
import { GemiSearch } from "@/components/gemi/gemi-search"

type Tab = "aeede" | "gemi"

const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: "aeede", label: "AEEDE — Αναζήτηση ΑΦΜ", icon: Search },
  { key: "gemi", label: "ΓΕΜΗ — Μητρώο Επιχειρήσεων", icon: Building2 },
]

export function VatLookupTabs() {
  const [tab, setTab] = useState<Tab>("aeede")

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px",
                active
                  ? "border-indigo-500 text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "aeede" && <VatLookup />}
      {tab === "gemi" && <GemiSearch />}
    </div>
  )
}
