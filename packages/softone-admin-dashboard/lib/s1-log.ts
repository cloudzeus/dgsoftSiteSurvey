// In-memory ring buffer for Softone API request/response logging.
// Persists across requests within the same Node.js process.
// Cleared on server restart.

export interface S1LogEntry {
  id: string
  ts: Date
  direction: "→" | "←"
  service: string
  payload: unknown  // request body (password redacted) or response body
  ok?: boolean
  durationMs?: number
}

const MAX = 200
const entries: S1LogEntry[] = []

export const s1Log = {
  push(entry: S1LogEntry) {
    entries.unshift(entry)
    if (entries.length > MAX) entries.length = MAX
  },
  all(): S1LogEntry[] {
    return [...entries]
  },
  clear() {
    entries.length = 0
  },
}
