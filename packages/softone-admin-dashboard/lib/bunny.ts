// Bunny CDN Storage API helper
// Docs: https://docs.bunny.net/reference/storage-api

const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE!
const API_KEY      = process.env.BUNNY_ACCESS_KEY!
const STORAGE_HOST = (process.env.BUNNY_STORAGE_API_HOST ?? "storage.bunnycdn.com").replace(/\/$/, "")
const CDN_URL      = `https://${(process.env.BUNNY_CDN_HOSTNAME ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "")}`

/**
 * Upload a Buffer to Bunny Storage.
 * @param path  Storage path relative to the zone root, e.g. "avatars/user123.webp"
 * @param body  File contents as Buffer
 * @param contentType  MIME type, e.g. "image/webp"
 * @returns Public CDN URL for the uploaded file
 */
export async function bunnyUpload(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const url = `https://${STORAGE_HOST}/${STORAGE_ZONE}/${path}`

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: API_KEY,
      "Content-Type": contentType,
    },
    body: new Uint8Array(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Bunny upload failed (${res.status}): ${text}`)
  }

  return `${CDN_URL}/${path}`
}

/**
 * Delete a file from Bunny Storage by its CDN URL.
 * Safe to call even if the file does not exist.
 */
export async function bunnyDelete(cdnUrl: string): Promise<void> {
  if (!cdnUrl.startsWith(CDN_URL)) return // not our CDN

  const path = cdnUrl.slice(CDN_URL.length + 1) // strip leading slash
  const url = `https://${STORAGE_HOST}/${STORAGE_ZONE}/${path}`

  await fetch(url, {
    method: "DELETE",
    headers: { AccessKey: API_KEY },
  }).catch(() => {}) // swallow — best effort
}
