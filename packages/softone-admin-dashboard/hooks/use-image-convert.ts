"use client"

// Client-side image → WebP conversion using the Canvas API.
// Runs in the browser before upload — reduces payload size and ensures
// consistent format before the file reaches the server.
//
// SVGs are passed through unchanged.
// All raster images are resized to ≤1920 px wide and exported as WebP.
//
// Usage:
//   const { convert } = useImageConvert()
//   const webpFile = await convert(originalFile)
//   // upload webpFile normally

const MAX_WIDTH = 1920
const WEBP_QUALITY = 0.85

export function useImageConvert() {
  async function convert(file: File): Promise<File> {
    // SVG: pass through unchanged
    if (file.type === "image/svg+xml") return file

    const bitmap = await createImageBitmap(file)
    const { width, height } = scaleDimensions(bitmap.width, bitmap.height)

    const canvas = document.createElement("canvas")
    canvas.width  = width
    canvas.height = height

    const ctx = canvas.getContext("2d")!
    // Clear to transparent before drawing (preserves PNG/WebP alpha)
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY)
    const baseName = file.name.replace(/\.[^.]+$/, "")
    return new File([blob], `${baseName}.webp`, { type: "image/webp" })
  }

  return { convert }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function scaleDimensions(w: number, h: number): { width: number; height: number } {
  if (w <= MAX_WIDTH) return { width: w, height: h }
  return { width: MAX_WIDTH, height: Math.round((h / w) * MAX_WIDTH) }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      type,
      quality,
    )
  })
}
