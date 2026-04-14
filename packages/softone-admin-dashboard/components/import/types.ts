import type { TargetField } from "@/lib/import-targets"

export type { TargetField }

export type SheetMeta = {
  name: string
  rowCount: number
  colCount: number
}

export type RawRow = {
  rowNum: number
  cells: (string | null)[]  // 0-indexed by column position
}

export type ColumnInfo = {
  key: string        // header text
  index: number      // 0-based column index
  colLetter: string  // Excel letter (A, B, AA…)
  samples: string[]  // up to 3 non-empty values from data rows
  isMerged: boolean  // part of a merged cell in the header row
}

/** Snapshot of all per-sheet configuration, keyed by sheet name */
export type SheetSettings = {
  headerRow: number
  dataStartRow: number
  rawRows: RawRow[]
  columnCount: number
  mergedRanges: string[]
  totalRows: number
  columns: ColumnInfo[]
  selectedColumns: string[]
  repeatLabelRow: number | null
  repeatLabelContent: (string | null)[] | null
  excludedRows: number[]
  categoryMarkers: CategoryMarker[]
  forcedMerged: string[]   // serialised from Set<string>
}

export type ColumnMapping = {
  excelColumn: string  // original Excel header
  targetField: string  // target service field key, "" = unmapped
}

export type CategoryMarker = {
  rowNum: number    // Excel row number (1-based)
  category: string  // category name applied to all rows below until next marker
}

export type ImportConfig = {
  // Step 1
  file: File | null
  fileName: string
  fileSize: number
  sheets: SheetMeta[]

  // Step 2
  selectedSheet: string
  headerRow: number
  dataStartRow: number
  rawRows: RawRow[]          // first ~25 rows for interactive preview
  columnCount: number        // total columns detected
  mergedRanges: string[]     // e.g. ["A1:C1", "D2:D4"]
  totalRows: number
  columns: ColumnInfo[]      // derived from rawRows + headerRow
  selectedColumns: string[]  // column keys to include; empty = all
  repeatLabelRow: number | null                  // row number the user marked as repeating label
  repeatLabelContent: (string | null)[] | null   // cells of that row — used to skip matches during import
  excludedRows: number[]                         // individual row numbers manually excluded from import
  categoryMarkers: CategoryMarker[]              // rows that set the category for all rows below them
  sheetSettings: Record<string, SheetSettings>   // saved settings per sheet name

  // Step 3
  connectionId: string | null
  connectionType: string
  connectionName: string
  bindingId: string | null        // selected SystemBinding id
  targetObjectKey: string         // binding.objectName
  targetFields: TargetField[]     // entity's PipelineFields

  // Step 4
  mappings: ColumnMapping[]
  staticValues: Record<string, string>  // fixed values applied to every row (e.g. brand_name)

  // Step 5
  jobName: string
  skipErrors: boolean
}

export const DEFAULT_CONFIG: ImportConfig = {
  file: null,
  fileName: "",
  fileSize: 0,
  sheets: [],
  selectedSheet: "",
  headerRow: 1,
  dataStartRow: 2,
  rawRows: [],
  columnCount: 0,
  mergedRanges: [],
  totalRows: 0,
  columns: [],
  selectedColumns: [],
  repeatLabelRow: null,
  repeatLabelContent: null,
  excludedRows: [],
  categoryMarkers: [],
  sheetSettings: {},
  connectionId: null,
  connectionType: "",
  connectionName: "",
  bindingId: null,
  targetObjectKey: "",
  targetFields: [],
  mappings: [],
  staticValues: {},
  jobName: "",
  skipErrors: true,
}
