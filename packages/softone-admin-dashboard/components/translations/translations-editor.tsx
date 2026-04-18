"use client"

import { useMemo, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Search, Save, Sparkles, Loader2, Check, AlertTriangle } from "lucide-react"
import { saveTranslations, translateWithDeepseek } from "@/app/actions/translations"
import { locales, type Locale } from "@/i18n"
import type { TranslationEntry } from "@/app/actions/translations"
import { cn } from "@/lib/utils"

interface Props {
  initialEntries: TranslationEntry[]
}

type DirtyMap = Map<string, Record<Locale, string>>

export function TranslationsEditor({ initialEntries }: Props) {
  const t = useTranslations("translationsPage")
  const [entries, setEntries] = useState<TranslationEntry[]>(initialEntries)
  const [dirty, setDirty] = useState<DirtyMap>(new Map())
  const [search, setSearch] = useState("")
  const [missingOnly, setMissingOnly] = useState(false)
  const [translatingKey, setTranslatingKey] = useState<string | null>(null)
  const [savePending, startSave] = useTransition()
  const [bulkPending, startBulk] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (missingOnly && locales.every((loc) => (e.values[loc] ?? "").trim() !== "")) return false
      if (!q) return true
      if (e.path.toLowerCase().includes(q)) return true
      return locales.some((loc) => (e.values[loc] ?? "").toLowerCase().includes(q))
    })
  }, [entries, search, missingOnly])

  function setValue(path: string, locale: Locale, value: string) {
    setEntries((prev) =>
      prev.map((e) => (e.path === path ? { ...e, values: { ...e.values, [locale]: value } } : e)),
    )
    setDirty((prev) => {
      const next = new Map(prev)
      const current = next.get(path) ?? {} as Record<Locale, string>
      next.set(path, { ...current, [locale]: value })
      return next
    })
  }

  async function translateOne(entry: TranslationEntry, fromLocale: Locale, toLocale: Locale) {
    const source = entry.values[fromLocale]
    if (!source?.trim()) {
      setFeedback({ kind: "err", text: t("noSourceText") })
      return
    }
    setTranslatingKey(`${entry.path}:${toLocale}`)
    setFeedback(null)
    try {
      const { translated } = await translateWithDeepseek(source, fromLocale, toLocale)
      setValue(entry.path, toLocale, translated)
    } catch (err) {
      setFeedback({ kind: "err", text: err instanceof Error ? err.message : String(err) })
    } finally {
      setTranslatingKey(null)
    }
  }

  function translateAllMissing() {
    startBulk(async () => {
      setFeedback(null)
      let count = 0
      const target: Locale = "el"
      const source: Locale = "en"
      for (const entry of entries) {
        const sourceText = entry.values[source]
        const targetText = entry.values[target]
        if (!sourceText?.trim() || targetText?.trim()) continue
        setTranslatingKey(`${entry.path}:${target}`)
        try {
          const { translated } = await translateWithDeepseek(sourceText, source, target)
          setValue(entry.path, target, translated)
          count++
        } catch (err) {
          setFeedback({
            kind: "err",
            text: t("bulkErrorAt", { path: entry.path, error: err instanceof Error ? err.message : String(err) }),
          })
          break
        }
      }
      setTranslatingKey(null)
      if (count > 0) setFeedback({ kind: "ok", text: t("bulkDone", { count }) })
    })
  }

  function save() {
    if (dirty.size === 0) return
    startSave(async () => {
      setFeedback(null)
      const updates: Array<{ path: string; locale: Locale; value: string }> = []
      for (const [path, locValues] of dirty) {
        for (const loc of locales) {
          const v = locValues[loc]
          if (typeof v === "string") updates.push({ path, locale: loc, value: v })
        }
      }
      try {
        const result = await saveTranslations(updates)
        setDirty(new Map())
        setFeedback({ kind: "ok", text: t("saved", { count: result.updated }) })
      } catch (err) {
        setFeedback({ kind: "err", text: err instanceof Error ? err.message : String(err) })
      }
    })
  }

  const dirtyCount = dirty.size
  const filteredCount = filtered.length

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] pl-8 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <label className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] select-none">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          {t("missingOnly")}
        </label>

        <button
          type="button"
          onClick={translateAllMissing}
          disabled={bulkPending || translatingKey !== null}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:opacity-50"
        >
          {bulkPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-violet-400" />}
          {t("translateAllMissing")}
        </button>

        <button
          type="button"
          onClick={save}
          disabled={dirtyCount === 0 || savePending}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savePending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {t("saveChanges", { count: dirtyCount })}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]",
            feedback.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/5 text-rose-300",
          )}
        >
          {feedback.kind === "ok" ? <Check className="size-4 shrink-0 mt-0.5" /> : <AlertTriangle className="size-4 shrink-0 mt-0.5" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Counts */}
      <p className="text-[12px] text-[var(--muted-foreground)]">
        {t("showing", { filtered: filteredCount, total: entries.length })}
      </p>

      {/* Table */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--muted)]/40 text-[var(--muted-foreground)]">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-[28%]">{t("colKey")}</th>
              {locales.map((loc) => (
                <th key={loc} className="text-left px-3 py-2 font-medium">
                  {t(`locale.${loc}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const isDirty = dirty.has(entry.path)
              return (
                <tr
                  key={entry.path}
                  className={cn(
                    "border-t border-[var(--border)] align-top",
                    isDirty && "bg-amber-500/5",
                  )}
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted-foreground)] break-all">
                    {entry.path}
                  </td>
                  {locales.map((loc) => {
                    const isTranslating = translatingKey === `${entry.path}:${loc}`
                    const value = entry.values[loc]
                    const isEmpty = !value?.trim()
                    return (
                      <td key={loc} className="px-2 py-1.5">
                        <div className="flex items-start gap-1.5">
                          <textarea
                            value={value}
                            onChange={(e) => setValue(entry.path, loc, e.target.value)}
                            rows={1}
                            className={cn(
                              "flex-1 resize-y min-h-[34px] rounded-md border bg-[var(--background)] px-2 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30",
                              isEmpty ? "border-rose-500/40" : "border-[var(--border)]",
                            )}
                          />
                          {locales
                            .filter((other) => other !== loc)
                            .map((other) => (
                              <button
                                key={other}
                                type="button"
                                title={t("translateFrom", { from: t(`locale.${other}`) })}
                                onClick={() => translateOne(entry, other, loc)}
                                disabled={!entry.values[other]?.trim() || translatingKey !== null || bulkPending}
                                className="shrink-0 inline-flex items-center justify-center size-7 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                {isTranslating ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Sparkles className="size-3 text-violet-400" />
                                )}
                              </button>
                            ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={1 + locales.length} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                  {t("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
