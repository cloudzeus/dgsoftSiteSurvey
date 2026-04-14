"use client"

import React, { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Mail, Plus, Loader2, Check, ChevronDown, Paperclip } from "lucide-react"
import type { SurveyTableRow } from "./site-surveys-table"

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserOption {
  id: string
  name: string | null
  email: string
}

interface ContactOption {
  name: string | null
  email: string
  position: string | null
}

interface EmailData {
  users: UserOption[]
  customer: { email: string | null; emailacc: string | null; name: string | null } | null
  contacts: ContactOption[]
}

interface RecipientTag {
  key: string
  label: string
  email: string
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function RecipientPill({ tag, onRemove }: { tag: RecipientTag; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs px-2.5 py-1 border border-[var(--primary)]/20">
      <span className="max-w-[200px] truncate">{tag.label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full hover:bg-[var(--primary)]/20 transition-colors p-0.5"
        aria-label="Remove recipient"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

// ─── Recipient selector ───────────────────────────────────────────────────────

function RecipientSelector({
  data,
  recipients,
  onAdd,
}: {
  data: EmailData
  recipients: RecipientTag[]
  onAdd: (tag: RecipientTag) => void
}) {
  const [open, setOpen] = useState(false)
  const [customEmail, setCustomEmail] = useState("")

  const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()))

  function addIfNew(tag: RecipientTag) {
    if (!existingEmails.has(tag.email.toLowerCase())) {
      onAdd(tag)
    }
    setOpen(false)
  }

  function addCustom() {
    const email = customEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    addIfNew({ key: `custom:${email}`, label: email, email })
    setCustomEmail("")
  }

  const customerEmails: RecipientTag[] = []
  if (data.customer?.email) {
    customerEmails.push({
      key: `cust:main`,
      label: `${data.customer.name ?? "Customer"} <${data.customer.email}>`,
      email: data.customer.email,
    })
  }
  if (data.customer?.emailacc) {
    customerEmails.push({
      key: `cust:acc`,
      label: `${data.customer.name ?? "Customer"} Accounting <${data.customer.emailacc}>`,
      email: data.customer.emailacc,
    })
  }

  const contactEmails: RecipientTag[] = data.contacts
    .filter(c => c.email)
    .map(c => ({
      key: `contact:${c.email}`,
      label: c.name ? `${c.name}${c.position ? ` (${c.position})` : ""} <${c.email}>` : c.email!,
      email: c.email!,
    }))

  const userEmails: RecipientTag[] = data.users.map(u => ({
    key: `user:${u.id}`,
    label: u.name ? `${u.name} <${u.email}>` : u.email,
    email: u.email,
  }))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
      >
        <Plus className="size-3" /> Add recipient <ChevronDown className="size-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
            {/* Custom email */}
            <div className="p-2 border-b border-[var(--border)]">
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
                  placeholder="Enter email address…"
                  className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-2.5 py-1.5 text-xs placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={!customEmail.trim()}
                  className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-90"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {customerEmails.length > 0 && (
                <Group label="Customer">
                  {customerEmails.map(t => (
                    <EmailRow key={t.key} tag={t} selected={existingEmails.has(t.email.toLowerCase())} onSelect={() => addIfNew(t)} />
                  ))}
                </Group>
              )}
              {contactEmails.length > 0 && (
                <Group label="Contacts">
                  {contactEmails.map(t => (
                    <EmailRow key={t.key} tag={t} selected={existingEmails.has(t.email.toLowerCase())} onSelect={() => addIfNew(t)} />
                  ))}
                </Group>
              )}
              {userEmails.length > 0 && (
                <Group label="Users">
                  {userEmails.map(t => (
                    <EmailRow key={t.key} tag={t} selected={existingEmails.has(t.email.toLowerCase())} onSelect={() => addIfNew(t)} />
                  ))}
                </Group>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]/30">
        {label}
      </div>
      {children}
    </div>
  )
}

function EmailRow({ tag, selected, onSelect }: { tag: RecipientTag; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-[var(--muted)] transition-colors"
    >
      <span className={`size-4 rounded-full border flex items-center justify-center shrink-0 ${selected ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--border)]"}`}>
        {selected && <Check className="size-2.5" />}
      </span>
      <span className="truncate text-[var(--foreground)]">{tag.label}</span>
    </button>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  survey: SurveyTableRow
}

export function SurveySendMailDialog({ open, onClose, survey }: Props) {
  const [data, setData] = useState<EmailData | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  const [recipients, setRecipients] = useState<RecipientTag[]>([])
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [attachSurvey, setAttachSurvey] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSent(false)
    setError(null)
    setRecipients([])
    setSubject(`Site Survey: ${survey.name}`)
    setBody("")
    setAttachSurvey(true)
    setLoadingData(true)
    fetch(`/api/site-surveys/${survey.id}/send-email`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError("Failed to load recipient data"))
      .finally(() => setLoadingData(false))
  }, [open, survey.id, survey.name])

  function addRecipient(tag: RecipientTag) {
    setRecipients(prev => prev.find(r => r.email.toLowerCase() === tag.email.toLowerCase()) ? prev : [...prev, tag])
  }

  function removeRecipient(key: string) {
    setRecipients(prev => prev.filter(r => r.key !== key))
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!recipients.length || !subject.trim() || !body.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/site-surveys/${survey.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipients.map(r => r.email),
          subject: subject.trim(),
          message: body.trim(),
          attachSurvey,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? "Send failed"); return }
      setSent(true)
    } catch {
      setError("Network error")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <Mail className="size-4 text-[var(--primary)]" />
                </div>
                <div>
                  <Dialog.Title className="text-sm font-semibold text-[var(--foreground)]">
                    Send Mail
                  </Dialog.Title>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 max-w-xs truncate">
                    {survey.name} · {survey.customer.name}
                  </p>
                </div>
              </div>
              <Dialog.Close className="size-7 rounded-lg flex items-center justify-center hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]">
                <X className="size-4" />
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {sent ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                  <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="size-6 text-emerald-500" />
                  </div>
                  <p className="font-semibold text-[var(--foreground)]">Email sent successfully</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Sent to {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSend} id="send-mail-form" className="flex flex-col gap-4 p-5">
                  {/* To */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">To</label>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-2.5 min-h-[44px] flex flex-wrap gap-1.5">
                      {recipients.map(tag => (
                        <RecipientPill key={tag.key} tag={tag} onRemove={() => removeRecipient(tag.key)} />
                      ))}
                      {loadingData ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                          <Loader2 className="size-3 animate-spin" /> Loading…
                        </span>
                      ) : data ? (
                        <RecipientSelector data={data} recipients={recipients} onAdd={addRecipient} />
                      ) : null}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      required
                      className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      placeholder="Subject…"
                    />
                  </div>

                  {/* Message */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Message</label>
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      required
                      rows={8}
                      className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
                      placeholder="Write your message…"
                    />
                    <p className="text-[11px] text-[var(--muted-foreground)]">Line breaks will be preserved in the sent email.</p>
                  </div>

                  {/* Attach survey toggle */}
                  <button
                    type="button"
                    onClick={() => setAttachSurvey(v => !v)}
                    className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      attachSurvey
                        ? "border-[var(--primary)]/40 bg-[var(--primary)]/5"
                        : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)]/40"
                    }`}
                  >
                    <span className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${attachSurvey ? "bg-[var(--primary)]/10" : "bg-[var(--muted)]"}`}>
                      <Paperclip className={`size-4 ${attachSurvey ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-[var(--foreground)]">Attach site survey document</span>
                      <span className="block text-xs text-[var(--muted-foreground)] truncate">
                        {attachSurvey ? `${survey.name}.docx will be attached` : "No attachment"}
                      </span>
                    </span>
                    <span className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${attachSurvey ? "border-[var(--primary)] bg-[var(--primary)]" : "border-[var(--border)]"}`}>
                      {attachSurvey && <Check className="size-3 text-[var(--primary-foreground)]" />}
                    </span>
                  </button>

                  {error && (
                    <p className="rounded-lg bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 px-3 py-2 text-sm text-[var(--destructive)]">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>

            {/* Footer */}
            {!sent && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)] shrink-0">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {recipients.length ? `${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}` : "No recipients selected"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="send-mail-form"
                    disabled={sending || !recipients.length || !subject.trim() || !body.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                    {sending ? "Sending…" : "Send Email"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
