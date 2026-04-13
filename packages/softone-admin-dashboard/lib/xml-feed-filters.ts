import type { ParsedRecord } from "./xml-feed-parser"

export interface FeedFilter {
  id:       string
  type:     string  // EXCLUDE_FIELD | EXCLUDE_RECORD
  field:    string
  operator: string | null
  value:    string | null
  label:    string | null
}

export const OPERATORS: { value: string; label: string; needsValue: boolean }[] = [
  { value: "equals",       label: "equals",          needsValue: true  },
  { value: "not_equals",   label: "does not equal",  needsValue: true  },
  { value: "contains",     label: "contains",        needsValue: true  },
  { value: "not_contains", label: "does not contain",needsValue: true  },
  { value: "starts_with",  label: "starts with",     needsValue: true  },
  { value: "ends_with",    label: "ends with",       needsValue: true  },
  { value: "gt",           label: ">",               needsValue: true  },
  { value: "gte",          label: ">=",              needsValue: true  },
  { value: "lt",           label: "<",               needsValue: true  },
  { value: "lte",          label: "<=",              needsValue: true  },
  { value: "is_empty",     label: "is empty",        needsValue: false },
  { value: "not_empty",    label: "is not empty",    needsValue: false },
]

// ─── Core filter engine ───────────────────────────────────────────────────────

function testRule(record: ParsedRecord, filter: FeedFilter): boolean {
  const raw     = record[filter.field]
  const strVal  = raw != null ? String(raw) : ""
  const ruleVal = filter.value ?? ""

  switch (filter.operator) {
    case "equals":       return strVal === ruleVal
    case "not_equals":   return strVal !== ruleVal
    case "contains":     return strVal.toLowerCase().includes(ruleVal.toLowerCase())
    case "not_contains": return !strVal.toLowerCase().includes(ruleVal.toLowerCase())
    case "starts_with":  return strVal.toLowerCase().startsWith(ruleVal.toLowerCase())
    case "ends_with":    return strVal.toLowerCase().endsWith(ruleVal.toLowerCase())
    case "is_empty":     return strVal === "" || raw == null
    case "not_empty":    return strVal !== "" && raw != null
    case "gt":           return Number(strVal) > Number(ruleVal)
    case "gte":          return Number(strVal) >= Number(ruleVal)
    case "lt":           return Number(strVal) < Number(ruleVal)
    case "lte":          return Number(strVal) <= Number(ruleVal)
    default:             return false
  }
}

export function applyFilters(
  records: ParsedRecord[],
  filters: FeedFilter[],
): { records: ParsedRecord[]; excludedRecords: number; excludedFields: string[] } {
  const fieldExclusions = filters
    .filter((f) => f.type === "EXCLUDE_FIELD")
    .map((f) => f.field)

  const recordRules = filters.filter((f) => f.type === "EXCLUDE_RECORD")

  let excludedRecords = 0

  const filtered = records
    .filter((record) => {
      const excluded = recordRules.some((rule) => testRule(record, rule))
      if (excluded) excludedRecords++
      return !excluded
    })
    .map((record) => {
      if (fieldExclusions.length === 0) return record
      const copy = { ...record }
      for (const path of fieldExclusions) delete copy[path]
      return copy
    })

  return { records: filtered, excludedRecords, excludedFields: fieldExclusions }
}

/** Human-readable description of a filter rule */
export function describeFilter(f: FeedFilter): string {
  if (f.type === "EXCLUDE_FIELD") return `Exclude field "${f.field}"`
  const op  = OPERATORS.find((o) => o.value === f.operator)?.label ?? f.operator ?? "?"
  const val = f.operator === "is_empty" || f.operator === "not_empty" ? "" : ` "${f.value ?? ""}"`
  return `Exclude records where "${f.field}" ${op}${val}`
}
