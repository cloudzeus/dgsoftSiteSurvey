// Conflict resolution using Softone's UPDDATE / INSDATE timestamps
// Strategies: SOFTONE_WINS | LOCAL_WINS | MANUAL_REVIEW

import { parseISO, isAfter } from "date-fns"
import type { ConflictContext, ConflictResult } from "./types"

/**
 * Compare Softone UPDDATE against local updated_at.
 * Falls back to INSDATE when UPDDATE is absent.
 */
function getSoftoneTimestamp(record: Record<string, unknown>): Date | null {
  const raw = (record["UPDDATE"] ?? record["INSDATE"]) as string | null | undefined
  if (!raw) return null
  try {
    return parseISO(raw)
  } catch {
    return null
  }
}

function getLocalTimestamp(record: Record<string, unknown>): Date | null {
  const raw = (record["updatedAt"] ?? record["updated_at"]) as
    | string
    | Date
    | null
    | undefined
  if (!raw) return null
  return raw instanceof Date ? raw : parseISO(String(raw))
}

export function resolveConflict(ctx: ConflictContext): ConflictResult {
  const { softoneRecord, localRecord, strategy, syncConfigId, syncJobId } = ctx

  const softoneTime = getSoftoneTimestamp(softoneRecord as Record<string, unknown>)
  const localTime = getLocalTimestamp(localRecord)

  if (strategy === "SOFTONE_WINS") {
    // If we can compare timestamps, use them; otherwise Softone always wins
    if (softoneTime && localTime && !isAfter(softoneTime, localTime)) {
      return { resolved: true, winner: "local", record: localRecord }
    }
    return { resolved: true, winner: "softone", record: softoneRecord as Record<string, unknown> }
  }

  if (strategy === "LOCAL_WINS") {
    if (localTime && softoneTime && !isAfter(localTime, softoneTime)) {
      return { resolved: true, winner: "softone", record: softoneRecord as Record<string, unknown> }
    }
    return { resolved: true, winner: "local", record: localRecord }
  }

  // MANUAL_REVIEW — caller must create DLQ entry
  return {
    resolved: false,
    winner: "manual_review",
    record: null,
  }
}
