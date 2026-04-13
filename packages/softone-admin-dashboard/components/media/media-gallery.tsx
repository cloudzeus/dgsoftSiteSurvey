"use client"

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  type DragEvent,
} from "react"
import Image from "next/image"
import {
  Folder,
  FolderPlus,
  Upload,
  X,
  Loader2,
  Film,
  Copy,
  Trash2,
  ChevronRight,
  Home,
  Check,
  ImageIcon,
  AlertTriangle,
  FolderOpen,
  Eye,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { useImageConvert } from "@/hooks/use-image-convert"

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaFileRecord = {
  id: string
  name: string
  cdnUrl: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
  folderId: string | null
  createdAt: string
}

type MediaFolderRecord = {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  _count: { files: number; children: number }
}

type BreadcrumbEntry = { id: string | null; name: string }

export type MediaGalleryProps = {
  /** "gallery" = full management UI, "picker" = select a file and return it */
  mode?: "gallery" | "picker"
  /** Filter accepted file types */
  accept?: "image" | "video" | "all"
  /** Called when a file is selected (picker mode) */
  onSelect?: (file: MediaFileRecord) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/")
}

function isVideo(mimeType: string) {
  return mimeType.startsWith("video/")
}

function totalItems(f: MediaFolderRecord) {
  return f._count.files + f._count.children
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Breadcrumb({
  trail,
  onNavigate,
}: {
  trail: BreadcrumbEntry[]
  onNavigate: (id: string | null) => void
}) {
  return (
    <nav className="flex items-center gap-1 text-[12px] flex-wrap" aria-label="breadcrumb">
      {trail.map((entry, i) => {
        const isLast = i === trail.length - 1
        return (
          <span key={entry.id ?? "__root"} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="size-3" style={{ color: "var(--foreground-subtle)" }} />
            )}
            {isLast ? (
              <span className="font-medium" style={{ color: "var(--foreground)" }}>
                {entry.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(entry.id)}
                className="flex items-center gap-1 hover:underline transition-colors"
                style={{ color: "var(--foreground-muted)" }}
              >
                {i === 0 && <Home className="size-3" />}
                {entry.name}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function FolderCard({
  folder,
  onClick,
  onDelete,
  readonly,
}: {
  folder: MediaFolderRecord
  onClick: () => void
  onDelete: () => void
  readonly: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const count = totalItems(folder)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl cursor-pointer select-none transition-all"
      style={{
        background: hovered ? "var(--primary-light)" : "var(--muted)",
        border: `1.5px solid ${hovered ? "var(--primary)" : "var(--border)"}`,
        padding: "14px 12px 12px",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <Folder
          className="size-9 shrink-0 mt-0.5"
          style={{ color: hovered ? "var(--primary)" : "var(--foreground-muted)" }}
        />
        {!readonly && hovered && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--danger)", background: "var(--danger-light)" }}
            title="Delete folder"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <p
        className="mt-2 text-[12px] font-semibold leading-tight line-clamp-2"
        style={{ color: "var(--foreground)" }}
      >
        {folder.name}
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--foreground-muted)" }}>
        {count === 0 ? "Empty" : `${count} item${count !== 1 ? "s" : ""}`}
      </p>
    </div>
  )
}

function PreviewModal({
  file,
  onClose,
  onCopy,
  onDelete,
  mode,
}: {
  file: MediaFileRecord
  onClose: () => void
  onCopy: (url: string) => void
  onDelete: (f: MediaFileRecord) => void
  mode: "gallery" | "picker"
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    onCopy(file.cdnUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const imgLike = isImage(file.mimeType)
  const videoLike = isVideo(file.mimeType)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden w-full"
        style={{
          maxWidth: 860,
          maxHeight: "90vh",
          background: "var(--surface)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-[13px] font-semibold truncate max-w-xs" style={{ color: "var(--foreground)" }}>
            {file.name}
          </p>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: copied ? "var(--success-light)" : "var(--muted)",
                color: copied ? "var(--success-fg)" : "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied!" : "Copy URL"}
            </button>
            {mode === "gallery" && (
              <button
                onClick={() => { onDelete(file); onClose() }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
                style={{
                  background: "var(--danger-light)",
                  color: "var(--danger-fg)",
                  border: "1px solid var(--border)",
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg"
              style={{ color: "var(--foreground-muted)" }}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Media area */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4"
          style={{ background: "var(--background)" }}>
          {imgLike && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.cdnUrl}
              alt={file.name}
              className="max-w-full max-h-full rounded-lg"
              style={{ objectFit: "contain", maxHeight: "calc(90vh - 130px)" }}
            />
          )}
          {videoLike && (
            <video
              src={file.cdnUrl}
              controls
              className="max-w-full rounded-lg"
              style={{ maxHeight: "calc(90vh - 130px)" }}
            />
          )}
        </div>

        {/* Footer meta */}
        <div className="px-4 py-2.5 shrink-0 flex items-center gap-4"
          style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
            {formatBytes(file.size)}
          </span>
          {file.width && file.height && (
            <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
              {file.width} × {file.height} px
            </span>
          )}
          <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
            {file.mimeType}
          </span>
        </div>
      </div>
    </div>
  )
}

function FileCard({
  file,
  mode,
  onSelect,
  onDelete,
  onCopy,
  onPreview,
}: {
  file: MediaFileRecord
  mode: "gallery" | "picker"
  onSelect: (f: MediaFileRecord) => void
  onDelete: (f: MediaFileRecord) => void
  onCopy: (url: string) => void
  onPreview: (f: MediaFileRecord) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    onCopy(file.cdnUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const imgLike = isImage(file.mimeType)
  const videoLike = isVideo(file.mimeType)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl overflow-hidden select-none"
      style={{
        border: `1.5px solid ${hovered ? "var(--primary)" : "var(--border)"}`,
        background: "var(--surface)",
        boxShadow: hovered ? "var(--shadow-md)" : "var(--shadow-xs)",
        transition: "border-color 150ms, box-shadow 150ms",
      }}
    >
      {/* Thumbnail area — 1:1 aspect ratio */}
      <div
        className="relative w-full cursor-pointer"
        style={{ paddingBottom: "100%" }}
        onClick={() => mode === "picker" ? onSelect(file) : onPreview(file)}
      >
        <div
          className="absolute inset-0 flex items-center justify-center p-2"
          style={{ background: "var(--muted)" }}
        >
          {imgLike && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.cdnUrl}
              alt={file.name}
              className="max-w-full max-h-full rounded"
              style={{ objectFit: "contain" }}
              loading="lazy"
            />
          )}
          {videoLike && (
            <div className="flex flex-col items-center gap-2">
              <Film className="size-8" style={{ color: "var(--foreground-muted)" }} />
              <span className="text-[10px] uppercase font-semibold tracking-wide"
                style={{ color: "var(--foreground-subtle)" }}>
                {file.mimeType.split("/")[1]}
              </span>
            </div>
          )}
          {!imgLike && !videoLike && (
            <ImageIcon className="size-8" style={{ color: "var(--foreground-muted)" }} />
          )}
        </div>

        {/* Hover overlay — action buttons */}
        {hovered && (
          <div
            className="absolute inset-0 flex flex-col justify-end pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)" }}
          >
            <div className="flex items-center justify-end gap-1 p-2 pointer-events-auto">
              {/* Copy URL */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-sm"
                style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
                title="Copy CDN URL"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              </button>

              {/* Preview */}
              <button
                onClick={e => { e.stopPropagation(); onPreview(file) }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-sm"
                style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
                title="Preview"
              >
                <Eye className="size-3" />
              </button>

              {/* Picker: select */}
              {mode === "picker" && (
                <button
                  onClick={e => { e.stopPropagation(); onSelect(file) }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  <Check className="size-3" />
                  Select
                </button>
              )}

              {/* Gallery: delete */}
              {mode === "gallery" && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(file) }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-sm"
                  style={{ background: "rgba(220,38,38,0.8)", color: "#fff" }}
                  title="Delete"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="px-2.5 py-2">
        <p
          className="text-[11px] font-medium leading-tight truncate"
          style={{ color: "var(--foreground)" }}
          title={file.name}
        >
          {file.name}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {formatBytes(file.size)}
          {file.width && file.height && ` · ${file.width}×${file.height}`}
        </p>
      </div>
    </div>
  )
}

function CreateFolderModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError("Name is required"); return }
    setLoading(true); setError("")
    try {
      await onCreate(trimmed)
      onClose()
    } catch (err) {
      setError((err as Error).message || "Failed to create folder")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-xl)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
            New Folder
          </h3>
          <button onClick={onClose} style={{ color: "var(--foreground-muted)" }}>
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            className="input-field w-full"
            placeholder="Folder name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={80}
          />
          {error && (
            <p className="text-[11px] px-2.5 py-1.5 rounded-lg"
              style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Btn variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" size="sm" type="submit" loading={loading}>Create</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-xl)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full p-2 mt-0.5 shrink-0"
            style={{ background: "var(--danger-light)" }}>
            <AlertTriangle className="size-4" style={{ color: "var(--danger)" }} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {title}
            </h3>
            <p className="mt-1 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              {message}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={loading}>Cancel</Btn>
          <Btn variant="danger" size="sm" onClick={onConfirm} loading={loading}>Delete</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Main Gallery ─────────────────────────────────────────────────────────────

export function MediaGallery({ mode = "gallery", accept = "all", onSelect }: MediaGalleryProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: null, name: "Media" }])
  const [folders, setFolders] = useState<MediaFolderRecord[]>([])
  const [files, setFiles] = useState<MediaFileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>("")
  const [dragging, setDragging] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [previewFile, setPreviewFile] = useState<MediaFileRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "file"; item: MediaFileRecord }
    | { type: "folder"; item: MediaFolderRecord; nonEmpty?: boolean }
    | null
  >(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { convert } = useImageConvert()
  const [, startTransition] = useTransition()

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async (folderId: string | null) => {
    setLoading(true); setError("")
    try {
      const params = folderId ? `?folderId=${folderId}` : ""
      const res = await fetch(`/api/media${params}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error ?? `Server returned ${res.status}`)
      }
      setFolders(data.folders)
      setFiles(data.files)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(currentFolderId)
  }, [currentFolderId, fetchData])

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function navigateInto(folder: MediaFolderRecord) {
    setCurrentFolderId(folder.id)
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  function navigateTo(id: string | null) {
    const idx = breadcrumb.findIndex(b => b.id === id)
    if (idx === -1) return
    setBreadcrumb(prev => prev.slice(0, idx + 1))
    setCurrentFolderId(id)
  }

  // ─── Upload ─────────────────────────────────────────────────────────────────

  const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
  const VIDEO_ACCEPT = "video/mp4,video/webm,video/ogg,video/quicktime"
  const inputAccept =
    accept === "image" ? IMAGE_ACCEPT
    : accept === "video" ? VIDEO_ACCEPT
    : `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`

  async function uploadFiles(rawFiles: FileList | File[]) {
    const list = Array.from(rawFiles)
    if (!list.length) return

    setUploading(true)
    setUploadProgress("")
    setError("")

    const fd = new FormData()
    if (currentFolderId) fd.append("folderId", currentFolderId)

    let converted = 0
    for (const f of list) {
      const processedFile = f.type.startsWith("image/") ? await convert(f) : f
      fd.append("files", processedFile)
      converted++
      setUploadProgress(`Preparing ${converted}/${list.length}…`)
    }

    setUploadProgress(`Uploading ${list.length} file${list.length !== 1 ? "s" : ""}…`)

    try {
      const res = await fetch("/api/media", { method: "POST", body: fd })
      const data = await res.json()

      if (!res.ok && !data.results) {
        setError(data.error ?? "Upload failed")
        return
      }

      const failed = (data.results as { success: boolean; error?: string; name?: string }[])
        .filter(r => !r.success)

      if (failed.length) {
        setError(`${failed.length} file${failed.length !== 1 ? "s" : ""} failed: ${failed.map(f => f.name ?? "unknown").join(", ")}`)
      }

      startTransition(() => fetchData(currentFolderId))
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setUploading(false)
      setUploadProgress("")
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // ─── Drag & drop ────────────────────────────────────────────────────────────

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }
  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }

  // ─── Create folder ──────────────────────────────────────────────────────────

  async function createFolder(name: string) {
    const res = await fetch("/api/media/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to create folder")
    setFolders(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  function requestDeleteFile(file: MediaFileRecord) {
    setDeleteTarget({ type: "file", item: file })
  }

  function requestDeleteFolder(folder: MediaFolderRecord) {
    const nonEmpty = totalItems(folder) > 0
    setDeleteTarget({ type: "folder", item: folder, nonEmpty })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === "file") {
        const res = await fetch(`/api/media/${deleteTarget.item.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Delete failed")
        setFiles(prev => prev.filter(f => f.id !== deleteTarget.item.id))
      } else {
        const res = await fetch(`/api/media/folders/${deleteTarget.item.id}?force=true`, { method: "DELETE" })
        if (!res.ok) throw new Error("Delete failed")
        setFolders(prev => prev.filter(f => f.id !== deleteTarget.item.id))
      }
      setDeleteTarget(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  // ─── Copy URL ───────────────────────────────────────────────────────────────

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).catch(() => {})
  }

  // ─── File filtering ─────────────────────────────────────────────────────────

  const visibleFiles = files.filter(f => {
    if (accept === "image") return isImage(f.mimeType)
    if (accept === "video") return isVideo(f.mimeType)
    return true
  })

  const isEmpty = !loading && folders.length === 0 && visibleFiles.length === 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Breadcrumb trail={breadcrumb} onNavigate={navigateTo} />

        {mode === "gallery" && (
          <div className="flex items-center gap-2 ml-auto">
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
            >
              <FolderPlus className="size-3.5" />
              New Folder
            </Btn>
            <Btn
              variant="primary"
              size="sm"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {!uploading && <Upload className="size-3.5" />}
              {uploading ? uploadProgress || "Uploading…" : "Upload"}
            </Btn>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={inputAccept}
              className="hidden"
              onChange={e => e.target.files && uploadFiles(e.target.files)}
            />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
          style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")}><X className="size-3.5" /></button>
        </div>
      )}

      {/* Drop zone wrapper */}
      <div
        className="relative flex-1 min-h-0 overflow-y-auto"
        onDragOver={mode === "gallery" ? onDragOver : undefined}
        onDragLeave={mode === "gallery" ? onDragLeave : undefined}
        onDrop={mode === "gallery" ? onDrop : undefined}
      >
        {/* Drag overlay */}
        {dragging && (
          <div
            className="absolute inset-0 z-20 rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none"
            style={{
              background: "rgba(79,70,229,0.08)",
              border: "2px dashed var(--primary)",
            }}
          >
            <Upload className="size-10" style={{ color: "var(--primary)" }} />
            <p className="text-[14px] font-semibold" style={{ color: "var(--primary)" }}>
              Drop files to upload
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-3" style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl animate-pulse"
                style={{ background: "var(--muted)", height: 180 }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="rounded-2xl p-4" style={{ background: "var(--muted)" }}>
              <FolderOpen className="size-10" style={{ color: "var(--foreground-subtle)" }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
              No files here yet
            </p>
            {mode === "gallery" && (
              <p className="text-[12px]" style={{ color: "var(--foreground-subtle)" }}>
                Upload files or drag &amp; drop them here
              </p>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && (folders.length > 0 || visibleFiles.length > 0) && (
          <div className="grid gap-3" style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          }}>
            {folders.map(folder => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onClick={() => navigateInto(folder)}
                onDelete={() => requestDeleteFolder(folder)}
                readonly={mode === "picker"}
              />
            ))}
            {visibleFiles.map(file => (
              <FileCard
                key={file.id}
                file={file}
                mode={mode}
                onSelect={f => {
                  if (mode === "picker") onSelect?.(f)
                }}
                onDelete={requestDeleteFile}
                onCopy={copyUrl}
                onPreview={setPreviewFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onCopy={copyUrl}
          onDelete={f => { setPreviewFile(null); requestDeleteFile(f) }}
          mode={mode}
        />
      )}

      {/* Modals */}
      {showCreateFolder && (
        <CreateFolderModal
          onClose={() => setShowCreateFolder(false)}
          onCreate={createFolder}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title={
            deleteTarget.type === "file"
              ? `Delete "${deleteTarget.item.name}"?`
              : `Delete folder "${deleteTarget.item.name}"?`
          }
          message={
            deleteTarget.type === "folder" && deleteTarget.nonEmpty
              ? "This folder contains files and subfolders. They will all be permanently deleted from the CDN."
              : "This will permanently delete the file from the CDN. This cannot be undone."
          }
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}
