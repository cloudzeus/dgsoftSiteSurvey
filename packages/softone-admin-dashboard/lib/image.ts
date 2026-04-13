// Server-side image processing utility.
// Converts any raster image to WebP, preserving transparency, max 1920 px wide.
// SVGs are returned unchanged.
//
// Usage (in API routes / server actions):
//   import { toWebP } from "@/lib/image"
//   const { buffer, contentType } = await toWebP(rawBuffer, file.type)
//   await bunnyUpload(path, buffer, contentType)

import sharp from "sharp"

const MAX_WIDTH = 1920
const WEBP_QUALITY = 85

export interface ImageResult {
  buffer: Buffer
  contentType: string
  /** Final filename extension to use, e.g. "webp" or "svg" */
  ext: string
}

/**
 * Convert a raster image buffer to WebP.
 * - SVG → returned as-is (SVG already vector, no conversion needed)
 * - All others → resized to ≤1920 px wide, converted to WebP with alpha channel preserved
 */
export async function toWebP(input: Buffer, mimeType: string): Promise<ImageResult> {
  // Pass SVG through unchanged
  if (mimeType === "image/svg+xml") {
    return { buffer: input, contentType: "image/svg+xml", ext: "svg" }
  }

  const result = await sharp(input)
    .rotate()                           // auto-orient from EXIF
    .resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,         // never upscale
      fit: "inside",
    })
    .webp({
      quality: WEBP_QUALITY,
      alphaQuality: 100,                // lossless alpha channel
      effort: 4,
    })
    .toBuffer()

  return { buffer: result, contentType: "image/webp", ext: "webp" }
}
