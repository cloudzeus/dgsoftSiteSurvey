// ANSI 1253 (Windows-1253) ↔ UTF-8 conversion for Softone API responses
// Softone returns Windows-1253 encoded data — always decode via arrayBuffer()

import iconv from "iconv-lite"

/**
 * Decode a Fetch Response that contains Windows-1253 encoded JSON.
 * Never call res.json() directly on Softone responses.
 */
export async function decodeS1Response(res: Response): Promise<unknown> {
  const buffer = await res.arrayBuffer()
  const decoded = iconv.decode(Buffer.from(buffer), "win1253")
  return JSON.parse(decoded)
}

/**
 * Decode a raw ArrayBuffer of Windows-1253 bytes into a UTF-8 string.
 */
export function decodeBuffer(buffer: ArrayBuffer): string {
  return iconv.decode(Buffer.from(buffer), "win1253")
}

/**
 * Decode a single string value that was received as Windows-1253 binary.
 * Use this when individual field values need re-encoding.
 */
export function decodeFieldValue(value: string): string {
  const buf = Buffer.from(value, "binary")
  return iconv.decode(buf, "win1253")
}

/**
 * Recursively walk a record and decode every string field from Windows-1253.
 * Use after JSON.parse() when individual string values are still binary-encoded.
 */
export function decodeRecord<T extends Record<string, unknown>>(record: T): T {
  const result = {} as Record<string, unknown>
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      result[key] = decodeFieldValue(value)
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = decodeRecord(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result as T
}
