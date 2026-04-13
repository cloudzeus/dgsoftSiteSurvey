/**
 * XML Feed Parser
 * Fetches an XML URL, parses it into structured records, detects fields, and diffs snapshots.
 */

import { XMLParser } from "fast-xml-parser"

export interface ParsedRecord {
  _key: string
  [field: string]: unknown
}

export interface FieldDef {
  path: string
  label: string
  dataType: "string" | "number" | "boolean" | "date"
  isAttribute: boolean
  frequency: number
  sampleValue: string | undefined
}

export interface FeedParseResult {
  records: ParsedRecord[]
  fields: FieldDef[]
  rootTag: string
  itemTag: string
}

export interface DiffResult {
  added: ParsedRecord[]
  removed: ParsedRecord[]
  modified: { key: string; fieldPath: string; oldValue: unknown; newValue: unknown }[]
  newFields: string[]
  removedFields: string[]
}

// ─── XML Fetch ────────────────────────────────────────────────────────────────

export async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SoftBoilerplate/1.0 XML Feed Watcher" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.text()
}

// ─── XML Parse ────────────────────────────────────────────────────────────────

export function parseXmlFeed(xml: string): FeedParseResult {
  // Force every non-leaf, non-attribute tag into an array.
  // This ensures <product> is always [{...}] regardless of whether there is
  // 1 or 100 siblings — makes tree-walking predictable.
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
    isArray: (_name, _jpath, isLeaf, isAttr) => !isLeaf && !isAttr,
  })

  const parsed = parser.parse(xml)

  // Root tag — skip the ?xml declaration key
  const rootTag = Object.keys(parsed).find((k) => k !== "?xml") ?? ""
  const rootRaw  = parsed[rootTag]
  // Root itself may be wrapped in an array due to isArray rule — unwrap once
  const root: Record<string, unknown> =
    Array.isArray(rootRaw) ? (rootRaw[0] as Record<string, unknown>) : rootRaw

  // Walk the tree to find the real repeating-item level
  const { tag: itemTag, items } = findItemList(root, rootTag)

  // After picking the item array, unwrap any spurious single-element arrays
  // that resulted from forcing isArray=true for nodes that appear only once.
  const records: ParsedRecord[] = items.map((rawItem, i) => {
    const item = unwrapSingles(rawItem) as Record<string, unknown>
    const keyField = findKeyField(item)
    return {
      _key: keyField ? String(item[keyField]) : String(i),
      ...flattenObject(item),
    }
  })

  return { records, fields: detectFields(records), rootTag, itemTag }
}

// ─── Tree walker ─────────────────────────────────────────────────────────────
//
// Strategy:
//   • Among all keys in `node` that hold an array of objects, pick the one
//     with the most elements — that is the most likely "item list".
//   • If the best candidate has only 1 element, check whether it looks like a
//     pure wrapper (no scalar data of its own).  If it is, drill deeper.
//     If it already has data fields, it IS the record — stop.
//   • This correctly handles unlimited wrapper depth (e.g. <response><catalog>
//     <products><product x50>) without drilling into a product's own
//     sub-nodes (images, categories, etc.).
//   • Hard cap at depth 6 as safety net.

/** True when a node has at least one scalar/primitive data field of its own.
 *  A pure wrapper node (just a container) has no such fields. */
function hasOwnData(node: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("@_")) continue
    if (v === null) continue
    if (typeof v !== "object") return true                               // primitive
    if (Array.isArray(v) && v.length > 0 && typeof v[0] !== "object")  // array of primitives
      return true
  }
  return false
}

function findItemList(
  node: Record<string, unknown>,
  nodeName: string,
  depth = 0,
): { tag: string; items: unknown[] } {
  let bestTag   = ""
  let bestItems: unknown[] = []

  for (const key of Object.keys(node)) {
    if (key.startsWith("@_")) continue
    const val = node[key]
    if (!Array.isArray(val)) continue

    const objItems = val.filter((v) => v !== null && typeof v === "object" && !Array.isArray(v))
    if (objItems.length === 0) continue

    if (objItems.length > bestItems.length) {
      bestTag   = key
      bestItems = val
    }
  }

  // No array of objects found — this node IS the single record
  if (!bestTag) return { tag: nodeName, items: [node] }

  const objCount = bestItems.filter((v) => v !== null && typeof v === "object" && !Array.isArray(v)).length

  // Multiple items → this is the repeating list
  if (objCount > 1 || depth >= 6) return { tag: bestTag, items: bestItems }

  const inner = bestItems[0] as Record<string, unknown>

  // The single item has its own data fields → it IS a real record, not a wrapper
  if (hasOwnData(inner)) return { tag: bestTag, items: bestItems }

  // Pure wrapper (no scalar data) → drill one level deeper
  const deeper = findItemList(inner, bestTag, depth + 1)
  const deepObjCount = deeper.items.filter(
    (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  ).length

  return deepObjCount > 1 ? deeper : { tag: bestTag, items: bestItems }
}

// ─── Unwrap singles ───────────────────────────────────────────────────────────
//
// Because we forced isArray=true for all non-leaf tags, nodes that appeared
// only once are wrapped in a 1-element array: [{...}] → {...}.
// Multi-element arrays (real repeating child nodes) are left intact.

function unwrapSingles(val: unknown): unknown {
  if (Array.isArray(val)) {
    // Multi-element → keep as array but recurse into each element
    if (val.length !== 1) return val.map(unwrapSingles)
    // Single-element → unwrap (unless the inner value is itself an array)
    const inner = unwrapSingles(val[0])
    // If the inner is an array (e.g. repeated leaf siblings) keep the wrap
    return Array.isArray(inner) ? inner : inner
  }
  if (val !== null && typeof val === "object") {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      result[k] = unwrapSingles(v)
    }
    return result
  }
  return val
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KEY_FIELD_HINTS = ["id", "ID", "Id", "code", "CODE", "Code", "sku", "SKU", "key", "KEY"]

function findKeyField(item: Record<string, unknown>): string | null {
  for (const hint of KEY_FIELD_HINTS) {
    if (item[hint] !== undefined) return hint
  }
  return null
}

function flattenObject(obj: unknown, prefix = "", depth = 0): Record<string, unknown> {
  if (depth > 8 || obj === null || typeof obj !== "object") {
    return prefix ? { [prefix]: obj } : {}
  }

  // Array → expand items with 1-based serial index (serial format)
  if (Array.isArray(obj)) {
    const result: Record<string, unknown> = {}
    obj.forEach((item, idx) => {
      const key = prefix ? `${prefix}.${idx + 1}` : String(idx + 1)
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        Object.assign(result, flattenObject(item, key, depth + 1))
      } else {
        result[key] = item
      }
    })
    return result
  }

  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === "object") {
      Object.assign(result, flattenObject(v, fullKey, depth + 1))
    } else {
      result[fullKey] = v
    }
  }
  return result
}

function inferType(value: unknown): "string" | "number" | "boolean" | "date" {
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date"
    if (!isNaN(Number(value)) && value.trim() !== "") return "number"
  }
  return "string"
}

function detectFields(records: ParsedRecord[]): FieldDef[] {
  const fieldMap = new Map<string, FieldDef>()

  for (const record of records) {
    for (const [path, value] of Object.entries(record)) {
      if (path === "_key") continue
      if (Array.isArray(value)) continue // arrays are now fully expanded by flattenObject

      const existing = fieldMap.get(path)
      const type     = inferType(value)

      if (!existing) {
        fieldMap.set(path, {
          path,
          label:       path.split(".").pop() ?? path,
          dataType:    type,
          isAttribute: path.includes("@_"),
          frequency:   1,
          sampleValue: value != null ? String(value).slice(0, 500) : undefined,
        })
      } else {
        existing.frequency++
        if (!existing.sampleValue && value != null) {
          existing.sampleValue = String(value).slice(0, 500)
        }
      }
    }
  }

  return Array.from(fieldMap.values()).sort((a, b) => b.frequency - a.frequency)
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export function diffSnapshots(prev: ParsedRecord[], curr: ParsedRecord[]): DiffResult {
  const prevMap = new Map(prev.map((r) => [r._key, r]))
  const currMap = new Map(curr.map((r) => [r._key, r]))

  const added   = curr.filter((r) => !prevMap.has(r._key))
  const removed = prev.filter((r) => !currMap.has(r._key))
  const modified: DiffResult["modified"] = []

  for (const [key, currRecord] of currMap) {
    const prevRecord = prevMap.get(key)
    if (!prevRecord) continue
    for (const field of Object.keys(currRecord)) {
      if (field === "_key") continue
      const oldVal = prevRecord[field]
      const newVal = currRecord[field]
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        modified.push({ key, fieldPath: field, oldValue: oldVal, newValue: newVal })
      }
    }
  }

  const prevFields = new Set(prev.flatMap((r) => Object.keys(r).filter((k) => k !== "_key")))
  const currFields = new Set(curr.flatMap((r) => Object.keys(r).filter((k) => k !== "_key")))
  const newFields      = [...currFields].filter((f) => !prevFields.has(f))
  const removedFields  = [...prevFields].filter((f) => !currFields.has(f))

  return { added, removed, modified, newFields, removedFields }
}
