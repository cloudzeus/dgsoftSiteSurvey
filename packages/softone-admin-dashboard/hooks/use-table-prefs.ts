"use client"

/**
 * useTablePrefs — shared hook for all data tables in this app.
 *
 * Persists per-table user preferences to localStorage:
 *   • Which columns are visible
 *   • Rows per page
 *   • Column widths (drag-resizable)
 *
 * Sort state is intentionally ephemeral (resets on navigation).
 *
 * Usage:
 *   const { visibleCols, toggleCol, pageSize, setPageSize, colWidths, setColWidth } =
 *     useTablePrefs("users", COLUMNS, 25, DEFAULT_COL_WIDTHS)
 *
 * Storage key: table_prefs__{tableId}
 */

import { useState, useEffect } from "react"

export type ColDef = {
  key: string
  label: string
  sortable?: boolean
  /** Whether the column is visible by default */
  defaultVisible: boolean
  /** Prevent the user from hiding this column */
  alwaysVisible?: boolean
}

export const PAGE_SIZES = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

type StoredPrefs = {
  visibleCols: string[]
  pageSize: PageSize
  colWidths: Record<string, number>
}

export function useTablePrefs(
  tableId: string,
  columns: ColDef[],
  defaultPageSize: PageSize = 25,
  defaultWidths: Record<string, number> = {},
) {
  const storageKey = `table_prefs__${tableId}`

  const defaultVisible = columns.filter(c => c.defaultVisible).map(c => c.key)

  const [visibleSet,    setVisibleSet]    = useState<Set<string>>(() => new Set(defaultVisible))
  const [pageSize,      setPageSizeState] = useState<PageSize>(defaultPageSize)
  const [colWidths,     setColWidthsState] = useState<Record<string, number>>(defaultWidths)
  const [hydrated,      setHydrated]      = useState(false)

  // Load from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const stored: Partial<StoredPrefs> = JSON.parse(raw)
        if (stored.visibleCols) setVisibleSet(new Set(stored.visibleCols))
        if (stored.pageSize && PAGE_SIZES.includes(stored.pageSize as PageSize)) {
          setPageSizeState(stored.pageSize as PageSize)
        }
        if (stored.colWidths) {
          setColWidthsState(prev => ({ ...prev, ...stored.colWidths }))
        }
      }
    } catch { /* ignore */ }
    setHydrated(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  function persist(next: StoredPrefs) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function toggleCol(key: string) {
    const col = columns.find(c => c.key === key)
    if (col?.alwaysVisible) return
    const next = new Set(visibleSet)
    if (next.has(key)) {
      if (next.size <= 1) return // keep at least one column
      next.delete(key)
    } else {
      next.add(key)
    }
    setVisibleSet(next)
    persist({ visibleCols: Array.from(next), pageSize, colWidths })
  }

  function setPageSize(n: PageSize) {
    setPageSizeState(n)
    persist({ visibleCols: Array.from(visibleSet), pageSize: n, colWidths })
  }

  function setColWidth(key: string, width: number) {
    setColWidthsState(prev => {
      const next = { ...prev, [key]: width }
      persist({ visibleCols: Array.from(visibleSet), pageSize, colWidths: next })
      return next
    })
  }

  return {
    visibleCols: visibleSet,
    toggleCol,
    pageSize,
    setPageSize,
    colWidths,
    setColWidth,
    hydrated,
  }
}
