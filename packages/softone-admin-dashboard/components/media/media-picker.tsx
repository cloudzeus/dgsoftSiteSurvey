"use client"

import { X } from "lucide-react"
import { MediaGallery, type MediaFileRecord } from "./media-gallery"

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaPickerProps = {
  open: boolean
  onClose: () => void
  onSelect: (file: MediaFileRecord) => void
  /** Filter what files are shown/uploadable */
  accept?: "image" | "video" | "all"
  title?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = "all",
  title = "Select Media",
}: MediaPickerProps) {
  if (!open) return null

  function handleSelect(file: MediaFileRecord) {
    onSelect(file)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full rounded-2xl overflow-hidden"
        style={{
          maxWidth: 900,
          height: "min(80vh, 680px)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Gallery */}
        <div className="flex-1 min-h-0 p-5">
          <MediaGallery
            mode="picker"
            accept={accept}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  )
}
