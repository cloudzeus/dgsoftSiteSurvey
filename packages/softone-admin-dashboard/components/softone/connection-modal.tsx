"use client"

import { useEffect, useState } from "react"
import { X, CheckCircle, XCircle, Loader2, Zap, Building2 } from "lucide-react"
import { Btn } from "@/components/ui/btn"

interface ConnectionResult {
  connected: boolean
  companyinfo?: string | null
  url?: string
  error?: string
}

function parseCompanyInfo(raw: string | null | undefined) {
  if (!raw) return null
  const parts = raw.split("|")
  return {
    name: parts[0]?.split(",")[0]?.trim() ?? raw,
    address: parts[0]?.split(",").slice(1).join(",").trim(),
    vat: parts[1]?.trim(),
    gemi: parts[2]?.trim(),
  }
}

export function SoftoneConnectionModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ConnectionResult | null>(null)

  useEffect(() => {
    const key = "s1_conn_checked"
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1")
      testConnection()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function testConnection() {
    setLoading(true)
    setOpen(true)
    try {
      const res = await fetch("/api/softone/connection")
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ connected: false, error: "Network error" })
    } finally {
      setLoading(false)
    }
  }

  const company = parseCompanyInfo(result?.companyinfo)

  return (
    <>
      <Btn variant="secondary" size="sm" onClick={testConnection}>
        <Zap className="size-3.5" style={{ color: "var(--primary)" }} />
        Test Connection
      </Btn>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="relative w-full max-w-md mx-4 rounded-2xl p-6"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.08)",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="btn btn-ghost btn-icon-sm absolute top-4 right-4"
            >
              <X className="size-4" />
            </button>

            {loading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="size-8 animate-spin" style={{ color: "var(--primary)" }} />
                <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Connecting to Softone ERP…
                </p>
              </div>
            ) : result?.connected ? (
              <>
                <div className="flex items-start gap-3 mb-5">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
                  >
                    <CheckCircle className="size-5" style={{ color: "#16a34a" }} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                      Connected to Softone ERP
                    </h2>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                      Authentication successful
                    </p>
                  </div>
                </div>

                {company && (
                  <div
                    className="rounded-xl p-4 mb-4"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="size-4" style={{ color: "var(--primary)" }} />
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--foreground-subtle)" }}
                      >
                        Company
                      </span>
                    </div>
                    <p className="text-[14px] font-bold mb-1" style={{ color: "var(--foreground)" }}>
                      {company.name}
                    </p>
                    {company.address && (
                      <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                        {company.address}
                      </p>
                    )}
                    {company.vat && (
                      <p className="text-[11px] mt-2 font-mono" style={{ color: "var(--foreground-subtle)" }}>
                        {company.vat}
                      </p>
                    )}
                    {company.gemi && (
                      <p className="text-[11px] font-mono" style={{ color: "var(--foreground-subtle)" }}>
                        {company.gemi}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full flex-shrink-0" style={{ background: "#16a34a" }} />
                  <code className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                    {result.url}/s1services
                  </code>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
                  >
                    <XCircle className="size-5" style={{ color: "#dc2626" }} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                      Connection Failed
                    </h2>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                      Could not authenticate with Softone ERP
                    </p>
                  </div>
                </div>
                {result?.error && (
                  <div
                    className="rounded-lg px-3 py-2.5 text-[12px] font-mono"
                    style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
                  >
                    {result.error}
                  </div>
                )}
              </>
            )}

            {!loading && (
              <Btn
                variant="secondary"
                size="md"
                fullWidth
                className="mt-5"
                onClick={() => setOpen(false)}
              >
                Close
              </Btn>
            )}
          </div>
        </div>
      )}
    </>
  )
}
