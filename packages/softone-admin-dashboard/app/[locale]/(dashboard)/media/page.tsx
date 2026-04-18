import { MediaGallery } from "@/components/media/media-gallery"

export const metadata = { title: "Media Library" }

export default function MediaPage() {
  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 80px)" }}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Media Library
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Upload and manage images &amp; videos stored on Bunny CDN
        </p>
      </div>

      <div className="flex-1 rounded-2xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <MediaGallery mode="gallery" />
      </div>
    </div>
  )
}
