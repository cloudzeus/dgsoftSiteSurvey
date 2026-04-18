"use client"

import { useEffect, useState, useTransition } from "react"
import { X, Loader2, AlertCircle, Search, CheckCircle2, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn } from "@/components/ui/btn"
import { listMicrosoftTenantUsers, importMicrosoftUsers, type TenantUserRow } from "@/app/actions/microsoft-users"

type Role = "ADMIN" | "OPERATOR" | "VIEWER"

export function MicrosoftImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const [users, setUsers] = useState<TenantUserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [hideImported, setHideImported] = useState(true)
  const [hideDisabled, setHideDisabled] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [defaultRole, setDefaultRole] = useState<Role>("VIEWER")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()
  const [importing, startImport] = useTransition()

  useEffect(() => {
    if (!open) return
    setUsers(null)
    setError(null)
    setSelected(new Set())
    setFeedback(null)
    startLoad(async () => {
      const res = await listMicrosoftTenantUsers()
      if (res.ok) setUsers(res.users)
      else setError(res.error)
    })
  }, [open])

  if (!open) return null

  const filtered = (users ?? []).filter((u) => {
    if (hideImported && u.alreadyImported) return false
    if (hideDisabled && !u.accountEnabled) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.displayName ?? "").toLowerCase().includes(q) ||
      (u.jobTitle ?? "").toLowerCase().includes(q)
    )
  })

  const allFilteredSelected =
    filtered.length > 0 &&
    filtered.every((u) => u.alreadyImported || selected.has(u.email))
  const importableCount = filtered.filter((u) => !u.alreadyImported).length

  function toggleAll() {
    if (allFilteredSelected) {
      const next = new Set(selected)
      filtered.forEach((u) => next.delete(u.email))
      setSelected(next)
    } else {
      const next = new Set(selected)
      filtered.forEach((u) => { if (!u.alreadyImported) next.add(u.email) })
      setSelected(next)
    }
  }

  function toggleOne(email: string) {
    const next = new Set(selected)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    setSelected(next)
  }

  function handleImport() {
    if (selected.size === 0) return
    setFeedback(null)
    startImport(async () => {
      const res = await importMicrosoftUsers([...selected], defaultRole)
      if (res.ok) {
        setFeedback(`Εισήχθησαν ${res.created} χρήστες (παραλείφθηκαν ${res.skipped})`)
        onImported()
        // Refresh list to update alreadyImported flags
        const refreshed = await listMicrosoftTenantUsers()
        if (refreshed.ok) setUsers(refreshed.users)
        setSelected(new Set())
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-sky-700 to-blue-600">
              <Users className="size-4 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                Εισαγωγή Χρηστών από Microsoft 365
              </h2>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {users ? `${users.length} χρήστες στον tenant` : "Φόρτωση…"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-[var(--accent)]" aria-label="Κλείσιμο">
            <X className="size-4" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση ονόματος, email ή θέσης…"
              className="w-full rounded-md border pl-8 pr-3 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>
          <label className="flex items-center gap-1.5 text-[12px] select-none" style={{ color: "var(--muted-foreground)" }}>
            <input type="checkbox" checked={hideImported} onChange={(e) => setHideImported(e.target.checked)} />
            Απόκρυψη ήδη εισηγμένων
          </label>
          <label className="flex items-center gap-1.5 text-[12px] select-none" style={{ color: "var(--muted-foreground)" }}>
            <input type="checkbox" checked={hideDisabled} onChange={(e) => setHideDisabled(e.target.checked)} />
            Απόκρυψη ανενεργών
          </label>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 className="size-4 animate-spin" /> Φόρτωση χρηστών από Microsoft Graph…
            </div>
          )}
          {!loading && error && (
            <div className="m-5 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] bg-rose-500/5 border-rose-500/30 text-rose-300">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Σφάλμα Microsoft Graph</p>
                <p className="mt-1 opacity-90">{error}</p>
                <p className="mt-2 text-[11px] opacity-70">
                  Βεβαιωθείτε ότι έχει δοθεί admin consent για την άδεια <code>User.Read.All</code> στην εφαρμογή Azure AD.
                </p>
              </div>
            </div>
          )}
          {!loading && !error && users && filtered.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-12 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Δεν βρέθηκαν χρήστες με αυτά τα κριτήρια.
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <table className="w-full text-[12px]">
              <thead className="bg-[var(--muted)]/40 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      aria-label="Επιλογή όλων"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--muted-foreground)" }}>Όνομα</th>
                  <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--muted-foreground)" }}>Email</th>
                  <th className="px-3 py-2 text-left font-medium hidden md:table-cell" style={{ color: "var(--muted-foreground)" }}>Θέση</th>
                  <th className="px-3 py-2 text-left font-medium w-24" style={{ color: "var(--muted-foreground)" }}>Κατάσταση</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelected = selected.has(u.email)
                  return (
                    <tr
                      key={u.graphId}
                      className={cn(
                        "border-t hover:bg-[var(--accent)]/30 transition-colors",
                        u.alreadyImported && "opacity-60",
                      )}
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={u.alreadyImported || isSelected}
                          disabled={u.alreadyImported}
                          onChange={() => toggleOne(u.email)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--foreground)" }}>
                        {u.displayName || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {u.email}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell" style={{ color: "var(--muted-foreground)" }}>
                        {u.jobTitle || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {u.alreadyImported ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            <CheckCircle2 className="size-2.5" /> Εισηγμένος
                          </span>
                        ) : !u.accountEnabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                            Ανενεργός
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-sky-500/10 text-sky-400 border-sky-500/20">
                            Ενεργός
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {selected.size > 0
              ? `${selected.size} επιλεγμένοι · ${importableCount} διαθέσιμοι`
              : `${importableCount} διαθέσιμοι για εισαγωγή`}
          </div>
          {feedback && (
            <span className="text-[12px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> {feedback}
            </span>
          )}
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            Ρόλος:
            <select
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value as Role)}
              className="rounded-md border px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ borderColor: "var(--input)", background: "var(--background)", color: "var(--foreground)" }}
            >
              <option value="VIEWER">VIEWER</option>
              <option value="OPERATOR">OPERATOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={importing}>Άκυρο</Btn>
          <Btn variant="primary" size="sm" onClick={handleImport} disabled={selected.size === 0 || importing}>
            {importing
              ? <><Loader2 className="size-3.5 animate-spin" /> Εισαγωγή…</>
              : <>Εισαγωγή ({selected.size})</>}
          </Btn>
        </div>
      </div>
    </div>
  )
}
