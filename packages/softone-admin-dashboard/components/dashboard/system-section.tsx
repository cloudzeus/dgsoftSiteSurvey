"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Activity } from "lucide-react"

interface SystemSectionProps {
  title: string
  subtitle: string
  expandLabel: string
  collapseLabel: string
  healthy: boolean
  healthyLabel: string
  attentionLabel: string
  children: React.ReactNode
}

export function SystemSection({
  title,
  subtitle,
  expandLabel,
  collapseLabel,
  healthy,
  healthyLabel,
  attentionLabel,
  children,
}: SystemSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--muted)]/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: healthy ? "#f0fdf4" : "#fef2f2",
            }}
          >
            <Activity
              className="size-[18px]"
              style={{ color: healthy ? "#16a34a" : "#dc2626" }}
            />
          </div>
          <div className="text-left">
            <h2
              className="text-[13px] font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {title}
            </h2>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--foreground-muted)" }}
            >
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="text-[11px] font-semibold hidden sm:inline"
            style={{ color: healthy ? "#15803d" : "#b91c1c" }}
          >
            {healthy ? healthyLabel : attentionLabel}
          </span>
          <span
            className="text-[11px] font-semibold flex items-center gap-1"
            style={{ color: "var(--primary)" }}
          >
            {open ? collapseLabel : expandLabel}
            {open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </span>
        </div>
      </button>

      {open && (
        <div
          className="px-5 py-5 space-y-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
