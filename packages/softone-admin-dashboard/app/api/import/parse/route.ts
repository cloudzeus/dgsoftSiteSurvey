import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import ExcelJS from "exceljs"
import type { SheetMeta, RawRow } from "@/components/import/types"

export type { SheetMeta, RawRow }

export type ParseResponse = {
  fileName: string
  fileSize: number
  sheets: SheetMeta[]
  rawRows?: RawRow[]
  columnCount?: number
  mergedRanges?: string[]
  totalRows?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert 0-based column index to Excel letter(s): 0→A, 25→Z, 26→AA */
function colIndexToLetter(idx: number): string {
  let letter = ""
  let n = idx + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

/** Parse a cell address like "C4" into { col: 2, row: 4 } (0-based col) */
function parseCellAddr(addr: string): { col: number; row: number } {
  const m = addr.match(/^([A-Z]+)(\d+)$/i)
  if (!m) return { col: 0, row: 0 }
  let col = 0
  for (const ch of m[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64
  return { col: col - 1, row: parseInt(m[2]) }
}

/**
 * Expand a range string like "B2:D4" into all cell addresses it covers.
 * Returns a Set<"col:row"> for fast lookup.
 */
function expandRange(range: string): Set<string> {
  const [start, end = start] = range.split(":")
  const s = parseCellAddr(start)
  const e = parseCellAddr(end)
  const cells = new Set<string>()
  for (let r = s.row; r <= e.row; r++) {
    for (let c = s.col; c <= e.col; c++) {
      cells.add(`${c}:${r}`)
    }
  }
  return cells
}

/**
 * Convert any ExcelJS cell value to a plain string (or null if empty).
 * Handles: string, number, boolean, Date, formula {result}, shared formula,
 * rich text {richText:[{text}...]}, and error {error} objects.
 */
function cellToString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value.trim() || null
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return String(value)
  if (value instanceof Date) {
    // Return ISO date portion (YYYY-MM-DD) so it stays readable
    return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    // Formula / shared formula — recurse on the result
    if ("result" in obj) return cellToString(obj.result)
    // Rich text — join all text segments
    if ("richText" in obj && Array.isArray(obj.richText)) {
      const joined = (obj.richText as { text?: string }[])
        .map(r => r.text ?? "")
        .join("")
        .trim()
      return joined || null
    }
    // Error value
    if ("error" in obj) return String(obj.error)
  }
  // Fallback — should rarely reach here
  const s = String(value).trim()
  return s === "[object Object]" ? null : s || null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// POST /api/import/parse
// Body (multipart): file  +  optionally: sheet
// If sheet is supplied → returns rawRows + mergedRanges for that sheet
export async function POST(req: Request) {
  await assertApiAccess(req)
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get("file")
    const sheetName = formData.get("sheet") as string | null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !["xlsx", "xls", "xlsm", "xlsb"].includes(ext)) {
      return NextResponse.json({ error: "Only Excel files (.xlsx, .xls) are supported" }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 20 MB" }, { status: 400 })
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())

    const sheets: SheetMeta[] = workbook.worksheets.map(ws => ({
      name: ws.name,
      rowCount: Math.max(0, ws.rowCount - 1),
      colCount: ws.columnCount,
    }))

    // First call (no sheet) → return sheet list only
    if (!sheetName) {
      return NextResponse.json({ fileName: file.name, fileSize: file.size, sheets } satisfies ParseResponse)
    }

    const ws = workbook.getWorksheet(sheetName)
    if (!ws) {
      return NextResponse.json({ error: `Sheet "${sheetName}" not found` }, { status: 404 })
    }

    // ── Merged cell detection ──────────────────────────────────────────────────
    // ExcelJS stores merges in ws.model.merges (array of range strings)
    const mergedRanges: string[] = (ws.model as { merges?: string[] }).merges ?? []

    // Build a flat set of all merged cell positions for quick lookup
    const mergedCellSet = new Set<string>()
    for (const range of mergedRanges) {
      for (const key of expandRange(range)) mergedCellSet.add(key)
    }

    // ── Determine actual column count ─────────────────────────────────────────
    let maxCol = 0
    ws.eachRow({ includeEmpty: false }, row => {
      row.eachCell({ includeEmpty: false }, (_, colNum) => {
        if (colNum > maxCol) maxCol = colNum
      })
    })

    // ── Read raw rows (first 25, all rows returned for interactive preview) ────
    const PREVIEW_ROWS = 25
    const rawRows: RawRow[] = []
    let totalRows = 0

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      totalRows++
      if (rawRows.length < PREVIEW_ROWS) {
        const cells: (string | null)[] = []
        for (let c = 1; c <= maxCol; c++) {
          const cell = row.getCell(c)
          // For merged cells that aren't the top-left master, ExcelJS returns
          // the shared value. We mark phantom merged cells as null.
          const isMergedPhantom = mergedCellSet.has(`${c - 1}:${rowNum}`)
            && cell.value === null && c > 1
          cells[c - 1] = isMergedPhantom ? null : cellToString(cell.value)
        }
        rawRows.push({ rowNum, cells })
      }
    })

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      sheets,
      rawRows,
      columnCount: maxCol,
      mergedRanges,
      totalRows,
    } satisfies ParseResponse)
  } catch (err) {
    console.error("[POST /api/import/parse]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to parse file" },
      { status: 500 },
    )
  }
}
