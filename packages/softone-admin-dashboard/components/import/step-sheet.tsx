"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Sheet, GitMerge, Check, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Repeat2, Eye } from "lucide-react"
import type { ImportConfig, ColumnInfo, RawRow, SheetSettings } from "./types"

type Props = {
  config: ImportConfig
  onChange: (patch: Partial<ImportConfig>) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function parseAddr(a: string): { col: number; row: number } {
  const m = a.match(/^([A-Z]+)(\d+)$/i)
  if (!m) return { col: 0, row: 0 }
  let col = 0
  for (const ch of m[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64
  return { col: col - 1, row: parseInt(m[2]) }
}

/** Returns set of 0-based col indices that are phantom (non-master) merged cells in a given row */
function getMergedPhantomCols(mergedRanges: string[], rowNum: number): Set<number> {
  const phantoms = new Set<number>()
  for (const range of mergedRanges) {
    const [start, end = start] = range.split(":")
    const s = parseAddr(start)
    const e = parseAddr(end)
    if (s.row <= rowNum && rowNum <= e.row) {
      for (let c = s.col + 1; c <= e.col; c++) phantoms.add(c)
    }
  }
  return phantoms
}

/** Derive ColumnInfo[] from rawRows given chosen header/data rows */
function deriveColumns(
  rawRows: RawRow[],
  headerRow: number,
  dataStartRow: number,
  mergedRanges: string[],
  columnCount: number,
  forcedMergedIncludes: Set<string> = new Set(),
): ColumnInfo[] {
  const headerRawRow = rawRows.find(r => r.rowNum === headerRow)
  if (!headerRawRow) return []

  const mergedColsInHeader = getMergedPhantomCols(mergedRanges, headerRow)
  const dataRows = rawRows.filter(r => r.rowNum >= dataStartRow)
  const cols: ColumnInfo[] = []

  for (let i = 0; i < columnCount; i++) {
    const rawKey = headerRawRow.cells[i]
    const isMergedPhantom = rawKey === null && mergedColsInHeader.has(i)
    const key = rawKey?.trim() || `Col ${colIndexToLetter(i)}`

    // Skip phantom merged columns unless user forced include
    if (isMergedPhantom && !forcedMergedIncludes.has(key)) {
      cols.push({
        key,
        index: i,
        colLetter: colIndexToLetter(i),
        samples: [],
        isMerged: true,
      })
      continue
    }

    const samples = dataRows
      .map(r => r.cells[i])
      .filter((v): v is string => v !== null && v !== "")
      .slice(0, 3)

    cols.push({
      key,
      index: i,
      colLetter: colIndexToLetter(i),
      samples,
      isMerged: isMergedPhantom,
    })
  }
  return cols
}

/**
 * Returns true if `row` matches the stored repeat-label pattern.
 * Match = every non-null/non-empty cell in `pattern` equals the same position in `row`.
 */
function rowMatchesRepeat(row: RawRow, pattern: (string | null)[] | null): boolean {
  if (!pattern) return false
  let hasAnyMatch = false
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]
    if (!p) continue
    const c = row.cells[i] ?? null
    if (c !== p) return false
    hasAnyMatch = true
  }
  return hasAnyMatch
}

// ─── Row number stepper ───────────────────────────────────────────────────────

function RowStepper({
  label,
  sublabel,
  value,
  min,
  max,
  color,
  onChange,
}: {
  label: string
  sublabel: string
  value: number
  min: number
  max: number
  color: string
  onChange: (v: number) => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
      style={{ background: "var(--surface)", border: `2px solid ${color}22` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="size-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}
        >
          <span className="text-[11px] font-black" style={{ color }}>{label[0]}</span>
        </div>
        <div>
          <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>{label}</p>
          <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{sublabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-0 rounded-lg overflow-hidden"
        style={{ border: "1.5px solid var(--border)" }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="px-2.5 py-1.5 transition-colors disabled:opacity-30"
          style={{ background: "var(--muted)" }}
        >
          <ChevronDown className="size-3.5" />
        </button>
        <div
          className="w-10 text-center text-[14px] font-bold tabular-nums py-1"
          style={{ color, background: `${color}10`, borderLeft: "1.5px solid var(--border)", borderRight: "1.5px solid var(--border)" }}
        >
          {value}
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="px-2.5 py-1.5 transition-colors disabled:opacity-30"
          style={{ background: "var(--muted)" }}
        >
          <ChevronUp className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main step ────────────────────────────────────────────────────────────────

export function StepSheet({ config, onChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Track which merged columns user has manually forced-included (by colLetter)
  const [forcedMerged, setForcedMerged] = useState<Set<string>>(new Set())

  async function loadSheet(sheetName: string) {
    if (!config.file) return
    setLoading(true)
    setError("")
    setForcedMerged(new Set())
    const fd = new FormData()
    fd.append("file", config.file)
    fd.append("sheet", sheetName)
    try {
      const res = await fetch("/api/import/parse", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to read sheet"); return }

      const headerRow = 1
      const dataStartRow = 2
      const cols = deriveColumns(
        data.rawRows ?? [], headerRow, dataStartRow,
        data.mergedRanges ?? [], data.columnCount ?? 0,
      )
      onChange({
        selectedSheet: sheetName,
        rawRows: data.rawRows ?? [],
        columnCount: data.columnCount ?? 0,
        mergedRanges: data.mergedRanges ?? [],
        totalRows: data.totalRows ?? 0,
        headerRow,
        dataStartRow,
        columns: cols,
        selectedColumns: cols.filter(c => !c.isMerged).map(c => c.key),
        repeatLabelRow: null,
        repeatLabelContent: null,
        excludedRows: [],
      })
    } catch {
      setError("Failed to read sheet.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (config.sheets.length === 1 && config.rawRows.length === 0) {
      loadSheet(config.sheets[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Snapshot all current sheet fields into a SheetSettings object */
  function buildSheetSettings(): SheetSettings {
    return {
      headerRow: config.headerRow,
      dataStartRow: config.dataStartRow,
      rawRows: config.rawRows,
      columnCount: config.columnCount,
      mergedRanges: config.mergedRanges,
      totalRows: config.totalRows,
      columns: config.columns,
      selectedColumns: config.selectedColumns,
      repeatLabelRow: config.repeatLabelRow,
      repeatLabelContent: config.repeatLabelContent,
      excludedRows: config.excludedRows,
      forcedMerged: [...forcedMerged],
    }
  }

  function selectSheet(name: string) {
    if (name === config.selectedSheet && config.rawRows.length > 0) return

    // Save the current sheet before leaving (only if it has been loaded)
    const updatedSheetSettings: Record<string, SheetSettings> = {
      ...config.sheetSettings,
      ...(config.selectedSheet && config.rawRows.length > 0
        ? { [config.selectedSheet]: buildSheetSettings() }
        : {}),
    }

    // Restore saved settings if this sheet was visited before, otherwise load fresh
    const saved = updatedSheetSettings[name]
    if (saved) {
      setForcedMerged(new Set(saved.forcedMerged))
      onChange({
        selectedSheet: name,
        sheetSettings: updatedSheetSettings,
        headerRow: saved.headerRow,
        dataStartRow: saved.dataStartRow,
        rawRows: saved.rawRows,
        columnCount: saved.columnCount,
        mergedRanges: saved.mergedRanges,
        totalRows: saved.totalRows,
        columns: saved.columns,
        selectedColumns: saved.selectedColumns,
        repeatLabelRow: saved.repeatLabelRow,
        repeatLabelContent: saved.repeatLabelContent,
        excludedRows: saved.excludedRows,
      })
    } else {
      setForcedMerged(new Set())
      onChange({
        selectedSheet: name,
        sheetSettings: updatedSheetSettings,
        rawRows: [],
        columns: [],
        selectedColumns: [],
        repeatLabelRow: null,
        repeatLabelContent: null,
        excludedRows: [],
      })
      loadSheet(name)
    }
  }

  function setHeaderRow(rowNum: number) {
    const dataStart = rowNum >= config.dataStartRow ? rowNum + 1 : config.dataStartRow
    const cols = deriveColumns(
      config.rawRows, rowNum, dataStart, config.mergedRanges, config.columnCount, forcedMerged,
    )
    onChange({
      headerRow: rowNum,
      dataStartRow: dataStart,
      columns: cols,
      selectedColumns: cols.filter(c => !c.isMerged).map(c => c.key),
      mappings: [],
      repeatLabelRow: null,
      repeatLabelContent: null,
      excludedRows: [],
    })
  }

  function setDataStartRow(rowNum: number) {
    if (rowNum <= config.headerRow) return
    const cols = deriveColumns(
      config.rawRows, config.headerRow, rowNum, config.mergedRanges, config.columnCount, forcedMerged,
    )
    onChange({ dataStartRow: rowNum, columns: cols, mappings: [] })
  }

  function toggleExcludedRow(rowNum: number) {
    const next = config.excludedRows.includes(rowNum)
      ? config.excludedRows.filter(r => r !== rowNum)
      : [...config.excludedRows, rowNum]
    onChange({ excludedRows: next })
  }

  function toggleRepeatLabelRow(row: RawRow) {
    // Toggle: if same row is clicked again, clear it
    if (config.repeatLabelRow === row.rowNum) {
      onChange({ repeatLabelRow: null, repeatLabelContent: null })
    } else {
      onChange({ repeatLabelRow: row.rowNum, repeatLabelContent: [...row.cells] })
    }
  }

  function toggleForcedMerge(colLetter: string) {
    const next = new Set(forcedMerged)
    if (next.has(colLetter)) next.delete(colLetter)
    else next.add(colLetter)
    setForcedMerged(next)
    const cols = deriveColumns(
      config.rawRows, config.headerRow, config.dataStartRow,
      config.mergedRanges, config.columnCount, next,
    )
    onChange({
      columns: cols,
      selectedColumns: cols.filter(c => !c.isMerged).map(c => c.key),
      mappings: [],
    })
  }

  function toggleColumn(key: string) {
    const current = config.selectedColumns
    const next = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key]
    onChange({ selectedColumns: next, mappings: [] })
  }

  function selectAllColumns() {
    onChange({ selectedColumns: config.columns.filter(c => !c.isMerged).map(c => c.key), mappings: [] })
  }

  function clearAllColumns() {
    onChange({ selectedColumns: [], mappings: [] })
  }

  const activeColumns = useMemo(
    () => config.columns.filter(c => config.selectedColumns.includes(c.key)),
    [config.columns, config.selectedColumns],
  )

  // Rows that match the repeat pattern (excludes the pattern row itself)
  const repeatMatchRowNums = useMemo(() => {
    if (!config.repeatLabelContent) return new Set<number>()
    return new Set(
      config.rawRows
        .filter(r => r.rowNum !== config.repeatLabelRow && rowMatchesRepeat(r, config.repeatLabelContent))
        .map(r => r.rowNum),
    )
  }, [config.rawRows, config.repeatLabelRow, config.repeatLabelContent])

  // Clean data preview: data rows that are not repeat-label rows and not manually excluded
  const cleanPreviewRows = useMemo(() => {
    if (!config.rawRows.length || !activeColumns.length) return []
    return config.rawRows.filter(r =>
      r.rowNum >= config.dataStartRow &&
      r.rowNum !== config.repeatLabelRow &&
      !repeatMatchRowNums.has(r.rowNum) &&
      !config.excludedRows.includes(r.rowNum),
    )
  }, [config.rawRows, config.dataStartRow, config.repeatLabelRow, repeatMatchRowNums, config.excludedRows, activeColumns])

  const hasMergedCols = config.columns.some(c => c.isMerged)
  const hasRaw = config.rawRows.length > 0
  const maxRowNum = config.rawRows[config.rawRows.length - 1]?.rowNum ?? 50

  // Total repeat rows detected in the preview (pattern row + matches)
  const repeatCount = config.repeatLabelRow != null ? repeatMatchRowNums.size + 1 : 0

  // Quick lookup: colIdx → ColumnInfo (for preview table header)
  const colInfoByIndex = useMemo(() => {
    const m = new Map<number, ColumnInfo>()
    for (const c of config.columns) m.set(c.index, c)
    return m
  }, [config.columns])

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Configure Sheet
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          Select the sheet, mark which row contains column labels and where data starts, then choose columns to import.
        </p>
      </div>

      {/* ── Sheet cards ── */}
      {config.sheets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {config.sheets.map(s => {
            const sel = config.selectedSheet === s.name
            return (
              <button
                key={s.name}
                onClick={() => selectSheet(s.name)}
                disabled={loading}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: sel ? "var(--primary-light)" : "var(--muted)",
                  border: `2px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                }}
              >
                <Sheet className="size-4 shrink-0"
                  style={{ color: sel ? "var(--primary)" : "var(--foreground-muted)" }} />
                <span className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {s.name}
                </span>
                <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
                  {s.rowCount.toLocaleString()}r
                </span>
                {sel && loading
                  ? <Loader2 className="size-3.5 animate-spin ml-0.5" style={{ color: "var(--primary)" }} />
                  : sel
                  ? <Check className="size-3.5 ml-0.5" style={{ color: "var(--primary)" }} strokeWidth={3} />
                  : config.sheetSettings[s.name]
                  ? <Check className="size-3 ml-0.5 opacity-40" style={{ color: "var(--foreground-muted)" }} strokeWidth={3} />
                  : null}
              </button>
            )
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[12px] px-3 py-2 rounded-xl"
          style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>
          {error}
        </p>
      )}

      {/* Loading (single-sheet with no cards above) */}
      {loading && config.sheets.length === 1 && (
        <div className="flex items-center justify-center gap-2 py-10 rounded-xl"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
          <Loader2 className="size-4 animate-spin" style={{ color: "var(--primary)" }} />
          <span className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>Reading sheet…</span>
        </div>
      )}

      {/* ── Row configuration + preview ── */}
      {hasRaw && !loading && (
        <>
          {/* Row range controls */}
          <div className="grid grid-cols-2 gap-3">
            <RowStepper
              label="Labels row"
              sublabel="Row that contains column headers"
              value={config.headerRow}
              min={1}
              max={Math.max(1, maxRowNum - 1)}
              color="var(--primary)"
              onChange={setHeaderRow}
            />
            <RowStepper
              label="Data starts at"
              sublabel="First row of actual data"
              value={config.dataStartRow}
              min={config.headerRow + 1}
              max={maxRowNum}
              color="var(--success)"
              onChange={setDataStartRow}
            />
          </div>

          {config.dataStartRow - config.headerRow > 1 && (
            <p className="text-[11px] px-3 py-2 rounded-lg"
              style={{ background: "var(--warning-light)", color: "var(--warning-fg)" }}>
              {config.dataStartRow - config.headerRow - 1} row{config.dataStartRow - config.headerRow - 1 !== 1 ? "s" : ""} between header and data will be skipped.
            </p>
          )}

          {/* Repeat label banner */}
          {config.repeatLabelRow != null && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
              style={{ background: "rgba(217,119,6,0.08)", border: "1.5px solid rgba(217,119,6,0.3)" }}>
              <Repeat2 className="size-4 shrink-0" style={{ color: "rgb(180,100,0)" }} />
              <p className="text-[12px] flex-1" style={{ color: "rgb(140,75,0)" }}>
                Row <strong>{config.repeatLabelRow}</strong> is marked as a repeating label.{" "}
                {repeatCount > 1
                  ? <><strong>{repeatMatchRowNums.size}</strong> matching row{repeatMatchRowNums.size !== 1 ? "s" : ""} found in preview — all will be skipped during import.</>
                  : "No additional matches found in the preview rows."}
              </p>
              <button
                onClick={() => onChange({ repeatLabelRow: null, repeatLabelContent: null })}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: "rgba(217,119,6,0.15)", color: "rgb(140,75,0)" }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Preview hint */}
          <p className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
            Row buttons: Labels (
            <span className="font-semibold" style={{ color: "var(--primary)" }}>H</span>),
            Data start (
            <span className="font-semibold" style={{ color: "var(--success)" }}>D</span>),
            Repeating label (
            <span className="font-semibold" style={{ color: "rgb(180,100,0)" }}>R</span>),
            Exclude row (
            <span className="font-semibold" style={{ color: "rgb(185,28,28)" }}>E</span>).
            &nbsp;·&nbsp;Click a <span className="font-semibold">column letter</span> to include/exclude it.
            &nbsp;·&nbsp;{config.totalRows.toLocaleString()} total rows · {config.columnCount} columns
            {config.totalRows > config.rawRows.length && <> · showing first {config.rawRows.length}</>}
          </p>

          {/* Preview table */}
          <div className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                {/* Clickable column headers */}
                <thead>
                  <tr style={{ background: "var(--muted)", borderBottom: "2px solid var(--border)" }}>
                    {/* gutter placeholder */}
                    <th style={{ minWidth: 96, borderRight: "1px solid var(--border)" }} />
                    {Array.from({ length: config.columnCount }).map((_, colIdx) => {
                      const col = colInfoByIndex.get(colIdx)
                      const isMergedPhantom = col?.isMerged ?? false
                      const colKey = col?.key ?? `Col ${colIndexToLetter(colIdx)}`
                      const isSelected = !isMergedPhantom && config.selectedColumns.includes(colKey)
                      return (
                        <th
                          key={colIdx}
                          style={{ borderLeft: "1px solid var(--border)", padding: "4px 6px", textAlign: "center" }}
                        >
                          {isMergedPhantom ? (
                            <span
                              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                              style={{ color: "var(--foreground-subtle)", background: "var(--border)" }}
                            >
                              {colIndexToLetter(colIdx)}
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleColumn(colKey)}
                              title={isSelected ? "Click to exclude column" : "Click to include column"}
                              className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded transition-all"
                              style={{
                                background: isSelected ? "var(--primary)" : "rgba(220,38,38,0.12)",
                                color: isSelected ? "#fff" : "rgb(185,28,28)",
                                border: isSelected ? "1px solid transparent" : "1px solid rgba(220,38,38,0.25)",
                                opacity: isSelected ? 1 : 0.85,
                              }}
                            >
                              {colIndexToLetter(colIdx)}
                            </button>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {config.rawRows.map((row) => {
                    const isHeader = row.rowNum === config.headerRow
                    const isDataStart = row.rowNum === config.dataStartRow
                    const isBeforeHeader = row.rowNum < config.headerRow
                    const isBetween = row.rowNum > config.headerRow && row.rowNum < config.dataStartRow
                    const isRepeatPattern = row.rowNum === config.repeatLabelRow
                    const isRepeatMatch = repeatMatchRowNums.has(row.rowNum)
                    const isRepeat = isRepeatPattern || isRepeatMatch
                    const isExcluded = config.excludedRows.includes(row.rowNum)
                    const mergedPhantoms = getMergedPhantomCols(config.mergedRanges, row.rowNum)

                    return (
                      <tr
                        key={row.rowNum}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          opacity: isBeforeHeader ? 0.4 : isExcluded || (isRepeat && !isRepeatPattern) ? 0.5 : 1,
                          background: isExcluded
                            ? "rgba(220,38,38,0.05)"
                            : isHeader
                            ? "rgba(79,70,229,0.07)"
                            : isDataStart
                            ? "rgba(22,163,74,0.07)"
                            : isRepeatPattern
                            ? "rgba(217,119,6,0.10)"
                            : isRepeatMatch
                            ? "rgba(217,119,6,0.04)"
                            : isBetween
                            ? "rgba(217,119,6,0.04)"
                            : "var(--surface)",
                        }}
                      >
                        {/* Row gutter */}
                        <td
                          className="sticky left-0 z-10 select-none"
                          style={{
                            minWidth: 110,
                            background: isExcluded
                              ? "rgb(185,28,28)"
                              : isHeader
                              ? "var(--primary)"
                              : isRepeatPattern
                              ? "rgb(180,100,0)"
                              : isDataStart
                              ? "var(--success)"
                              : isRepeatMatch
                              ? "rgba(217,119,6,0.25)"
                              : "var(--muted)",
                            borderRight: "1px solid var(--border)",
                            padding: "4px 6px",
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className="text-[10px] font-mono font-bold tabular-nums w-5 text-right shrink-0"
                              style={{ color: isHeader || isDataStart || isRepeatPattern || isExcluded ? "rgba(255,255,255,0.9)" : "var(--foreground-subtle)" }}
                            >
                              {row.rowNum}
                            </span>
                            <div className="flex gap-0.5">
                              <button
                                onClick={() => setHeaderRow(row.rowNum)}
                                title="Set as Labels row"
                                className="rounded px-1.5 py-0.5 text-[9px] font-black transition-all leading-none"
                                style={{
                                  background: isHeader ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)",
                                  color: isHeader ? "#fff" : "var(--foreground-muted)",
                                  border: isHeader ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent",
                                }}
                              >
                                H
                              </button>
                              <button
                                onClick={() => row.rowNum > config.headerRow && setDataStartRow(row.rowNum)}
                                title="Set as Data start row"
                                disabled={row.rowNum <= config.headerRow}
                                className="rounded px-1.5 py-0.5 text-[9px] font-black transition-all leading-none disabled:opacity-20"
                                style={{
                                  background: isDataStart ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)",
                                  color: isDataStart ? "#fff" : "var(--foreground-muted)",
                                  border: isDataStart ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent",
                                }}
                              >
                                D
                              </button>
                              <button
                                onClick={() => row.rowNum >= config.dataStartRow && toggleRepeatLabelRow(row)}
                                title="Mark as repeating label row"
                                disabled={row.rowNum < config.dataStartRow}
                                className="rounded px-1.5 py-0.5 text-[9px] font-black transition-all leading-none disabled:opacity-20"
                                style={{
                                  background: isRepeatPattern ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)",
                                  color: isRepeatPattern ? "#fff" : isRepeatMatch ? "rgb(180,100,0)" : "var(--foreground-muted)",
                                  border: isRepeatPattern ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent",
                                }}
                              >
                                R
                              </button>
                              <button
                                onClick={() => row.rowNum >= config.dataStartRow && toggleExcludedRow(row.rowNum)}
                                title={isExcluded ? "Re-include this row" : "Exclude this row from import"}
                                disabled={row.rowNum < config.dataStartRow}
                                className="rounded px-1.5 py-0.5 text-[9px] font-black transition-all leading-none disabled:opacity-20"
                                style={{
                                  background: isExcluded ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)",
                                  color: isExcluded ? "#fff" : "var(--foreground-muted)",
                                  border: isExcluded ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent",
                                }}
                              >
                                E
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Cells */}
                        {Array.from({ length: config.columnCount }).map((_, colIdx) => {
                          const val = row.cells[colIdx] ?? null
                          const colLetter = colIndexToLetter(colIdx)
                          const isMergedPhantomCell = mergedPhantoms.has(colIdx)
                          const colInfo = colInfoByIndex.get(colIdx)
                          const isColExcluded = !isMergedPhantomCell && colInfo && !colInfo.isMerged && !config.selectedColumns.includes(colInfo.key)

                          return (
                            <td
                              key={colIdx}
                              className="px-2.5 py-1.5 whitespace-nowrap"
                              style={{
                                maxWidth: 180,
                                borderLeft: "1px solid var(--border)",
                                background: isMergedPhantomCell
                                  ? "var(--muted)"
                                  : isColExcluded
                                  ? "rgba(220,38,38,0.04)"
                                  : undefined,
                                opacity: isColExcluded ? 0.4 : 1,
                              }}
                            >
                              {isMergedPhantomCell ? (
                                <span className="flex items-center gap-1 text-[10px]"
                                  style={{ color: "var(--foreground-subtle)" }}>
                                  <GitMerge className="size-3" />
                                </span>
                              ) : (
                                <span
                                  className="block truncate max-w-[160px]"
                                  title={val ?? ""}
                                  style={{
                                    color: isHeader
                                      ? "var(--primary)"
                                      : isRepeat
                                      ? "rgb(140,75,0)"
                                      : val ? "var(--foreground)" : "var(--foreground-subtle)",
                                    fontWeight: isHeader || isRepeatPattern ? 600 : 400,
                                    fontStyle: val ? "normal" : "italic",
                                    textDecoration: isRepeatMatch ? "line-through" : "none",
                                  }}
                                >
                                  {isHeader && (
                                    <span className="text-[9px] font-mono mr-1 opacity-40">{colLetter}</span>
                                  )}
                                  {val ?? "—"}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Merged columns override ── */}
      {hasMergedCols && !loading && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <GitMerge className="size-4" style={{ color: "var(--foreground-muted)" }} />
            <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
              Merged cells detected
            </p>
            <span className="text-[10px] ml-auto" style={{ color: "var(--foreground-muted)" }}>
              Toggle to include a merged column
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.columns.filter(c => c.isMerged).map(col => {
              const included = forcedMerged.has(col.key)
              return (
                <button
                  key={col.colLetter}
                  onClick={() => toggleForcedMerge(col.key)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    background: included ? "var(--primary-light)" : "var(--surface)",
                    border: `1.5px solid ${included ? "var(--primary)" : "var(--border)"}`,
                    color: included ? "var(--primary)" : "var(--foreground-muted)",
                  }}
                >
                  <span className="font-mono font-bold text-[10px]">{col.colLetter}</span>
                  {col.key !== `Col ${col.colLetter}` && (
                    <span className="truncate max-w-[100px]">{col.key}</span>
                  )}
                  {included
                    ? <ToggleRight className="size-3.5 shrink-0" />
                    : <ToggleLeft className="size-3.5 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Column selector ── */}
      {config.columns.length > 0 && !loading && (
        <div className="space-y-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                Columns to Import
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                <strong style={{ color: "var(--foreground)" }}>{activeColumns.length}</strong>{" "}
                of {config.columns.filter(c => !c.isMerged).length} columns selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAllColumns}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                Select all
              </button>
              <button
                onClick={clearAllColumns}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "var(--muted)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
            {config.columns.filter(c => !c.isMerged).map(col => {
              const isSelected = config.selectedColumns.includes(col.key)
              return (
                <button
                  key={`${col.colLetter}-${col.key}`}
                  onClick={() => toggleColumn(col.key)}
                  className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected ? "var(--primary-light)" : "var(--surface)",
                    border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  {/* Checkbox */}
                  <div
                    className="size-4 rounded mt-0.5 shrink-0 flex items-center justify-center"
                    style={{
                      background: isSelected ? "var(--primary)" : "var(--border)",
                      border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border-strong)"}`,
                    }}
                  >
                    {isSelected && <Check className="size-2.5 text-white" strokeWidth={3} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-mono font-bold px-1 rounded"
                        style={{
                          background: isSelected ? "var(--primary)" : "var(--border)",
                          color: isSelected ? "#fff" : "var(--foreground-muted)",
                        }}
                      >
                        {col.colLetter}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] font-medium leading-tight truncate"
                      style={{ color: "var(--foreground)" }}>
                      {col.key}
                    </p>
                    {col.samples.length > 0 && (
                      <p className="mt-0.5 text-[10px] truncate" style={{ color: "var(--foreground-subtle)" }}>
                        {col.samples.join(" · ")}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Clean data preview ── */}
      {activeColumns.length > 0 && hasRaw && !loading && (
        <div className="space-y-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div className="flex items-center gap-2">
            <Eye className="size-4" style={{ color: "var(--foreground-muted)" }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                Clean Data Preview
              </p>
              <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                {cleanPreviewRows.length} rows shown
                {repeatCount > 0 && (
                  <> · <span style={{ color: "rgb(180,100,0)" }}>{repeatCount} repeating label row{repeatCount !== 1 ? "s" : ""} removed</span></>
                )}
                {config.excludedRows.length > 0 && (
                  <> · <span style={{ color: "rgb(185,28,28)" }}>{config.excludedRows.length} manually excluded</span></>
                )}
                {config.totalRows > config.rawRows.length && <> · full sheet has {config.totalRows.toLocaleString()} rows (scroll to see all preview rows)</>}
              </p>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 400 }}>
              <table className="w-full text-[12px] border-collapse">
                {/* Header — sticky so it stays visible while scrolling */}
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr style={{ background: "var(--muted)", borderBottom: "2px solid var(--border)" }}>
                    <th
                      className="text-left px-2.5 py-2 text-[10px] font-mono font-bold"
                      style={{ color: "var(--foreground-subtle)", minWidth: 40, borderRight: "1px solid var(--border)", background: "var(--muted)" }}
                    >
                      #
                    </th>
                    {activeColumns.map(col => (
                      <th
                        key={col.key}
                        className="text-left px-2.5 py-2 whitespace-nowrap"
                        style={{ borderLeft: "1px solid var(--border)", background: "var(--muted)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[9px] font-mono font-bold px-1 rounded"
                            style={{ background: "var(--primary)", color: "#fff" }}
                          >
                            {col.colLetter}
                          </span>
                          <span className="text-[11px] font-semibold truncate max-w-[120px]"
                            style={{ color: "var(--primary)" }}>
                            {col.key}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cleanPreviewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeColumns.length + 1}
                        className="text-center py-6 text-[12px]"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        No data rows in preview range.
                      </td>
                    </tr>
                  ) : (
                    cleanPreviewRows.map((row, i) => (
                      <tr
                        key={row.rowNum}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: i % 2 === 0 ? "var(--surface)" : "var(--muted)",
                        }}
                      >
                        <td
                          className="px-2.5 py-1.5 text-[10px] font-mono tabular-nums"
                          style={{ color: "var(--foreground-subtle)", borderRight: "1px solid var(--border)" }}
                        >
                          {row.rowNum}
                        </td>
                        {activeColumns.map(col => {
                          const val = row.cells[col.index] ?? null
                          return (
                            <td
                              key={col.key}
                              className="px-2.5 py-1.5 whitespace-nowrap"
                              style={{ borderLeft: "1px solid var(--border)", maxWidth: 200 }}
                            >
                              <span
                                className="block truncate max-w-[180px]"
                                title={val ?? ""}
                                style={{
                                  color: val ? "var(--foreground)" : "var(--foreground-subtle)",
                                  fontStyle: val ? "normal" : "italic",
                                }}
                              >
                                {val ?? "—"}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Prompt when waiting for sheet selection */}
      {!hasRaw && !loading && config.sheets.length > 1 && !config.selectedSheet && (
        <div className="flex items-center justify-center py-8 rounded-xl"
          style={{ background: "var(--muted)", border: "2px dashed var(--border-strong)" }}>
          <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            ↑ Click a sheet above to load its preview
          </p>
        </div>
      )}
    </div>
  )
}
