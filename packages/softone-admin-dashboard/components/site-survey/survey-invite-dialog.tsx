"use client"

import React, { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Mail, Send, Loader2, Check, AlertCircle, Link } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  surveyId: number
  surveyName: string
  sectionKey: string
  sectionLabel: string
}

export function SurveyInviteDialog({ open, onClose, surveyId, surveyName, sectionKey, sectionLabel }: Props) {
  const [email,    setEmail]    = useState("")
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const canSend    = emailRegex.test(email.trim()) && !sending

  function handleClose() {
    if (sending) return
    setEmail("")
    setSent(false)
    setError(null)
    onClose()
  }

  async function handleSend() {
    if (!canSend) return
    setSending(true)
    setError(null)

    try {
      const res = await fetch(`/api/site-surveys/${surveyId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), sectionKey }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Request failed (${res.status})`)
        return
      }

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleClose}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 focus:outline-none"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="rounded-2xl border shadow-2xl overflow-hidden"
            style={{ background: "#1a1d27", borderColor: "rgba(255,255,255,0.08)" }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between px-6 py-5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#b8020b1a", border: "1px solid #b8020b30" }}>
                  <Link className="size-4" style={{ color: "#ef4444" }} />
                </div>
                <div>
                  <Dialog.Title
                    className="text-[14px] font-bold"
                    style={{ color: "#ffffff" }}
                  >
                    Send questionnaire link
                  </Dialog.Title>
                  <Dialog.Description
                    className="text-[12px] mt-0.5"
                    style={{ color: "#6b7280" }}
                  >
                    {sectionLabel} · {surveyName}
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  onClick={handleClose}
                  className="size-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/8 mt-0.5"
                  style={{ color: "#6b7280" }}
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              {sent ? (
                // ── Success state ──
                <div className="flex flex-col items-center py-6 text-center gap-4">
                  <div className="size-14 rounded-full flex items-center justify-center"
                    style={{ background: "#064e3b", border: "2px solid #065f46" }}>
                    <Check className="size-7 text-emerald-400" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white mb-1">Invitation sent!</p>
                    <p className="text-[13px] leading-relaxed" style={{ color: "#9ca3af" }}>
                      A questionnaire link for <strong className="text-white">{sectionLabel}</strong> has been
                      sent to <strong className="text-white">{email}</strong>.
                      <br /><br />
                      The link will expire in <strong className="text-white">7 days</strong>.
                      When the customer submits their answers, you will receive a notification email.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="mt-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors"
                    style={{ background: "#b8020b" }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                // ── Form state ──
                <div className="space-y-5">
                  {/* Info box */}
                  <div className="rounded-xl px-4 py-3.5 text-[13px] leading-relaxed"
                    style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.06)", color: "#9ca3af" }}>
                    The recipient will receive an email with a <strong style={{ color: "#e5e7eb" }}>secure, one-time link</strong> to
                    fill in the <strong style={{ color: "#e5e7eb" }}>{sectionLabel}</strong> questionnaire — no login required.
                    The link expires after <strong style={{ color: "#e5e7eb" }}>7 days</strong>.
                  </div>

                  {/* Email input */}
                  <div>
                    <label
                      className="block text-[11px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: "#6b7280" }}
                    >
                      Recipient email
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
                        style={{ color: "#4b5563" }}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(null) }}
                        onKeyDown={e => e.key === "Enter" && canSend && handleSend()}
                        placeholder="customer@example.com"
                        autoFocus
                        className="w-full rounded-xl border pl-10 pr-4 py-3 text-[14px] transition-all focus:outline-none focus:ring-2"
                        style={{
                          background: "#111318",
                          border: error ? "1px solid #ef444460" : "1px solid rgba(255,255,255,0.08)",
                          color: "#ffffff",
                          "--tw-ring-color": "#b8020b50",
                        } as React.CSSProperties}
                      />
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 mt-2">
                        <AlertCircle className="size-3.5 text-red-400 shrink-0" />
                        <p className="text-[12px] text-red-400">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!sent && (
              <div
                className="flex items-center justify-end gap-3 px-6 py-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors hover:bg-white/8"
                  style={{ color: "#6b7280" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold transition-all",
                    canSend
                      ? "text-white shadow-lg shadow-red-900/30"
                      : "cursor-not-allowed opacity-40",
                  )}
                  style={{ background: canSend ? "#b8020b" : "#374151" }}
                >
                  {sending
                    ? <><Loader2 className="size-3.5 animate-spin" /> Sending…</>
                    : <><Send className="size-3.5" /> Send invitation</>
                  }
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
