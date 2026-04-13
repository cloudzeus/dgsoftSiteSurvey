"use client"

import { useState } from "react"
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react"

export function LoginForm({
  action,
  showError,
}: {
  action: (formData: FormData) => Promise<void>
  showError?: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const focusStyle = {
    borderColor: "#6366f1",
    boxShadow: "0 0 0 3px rgba(99,102,241,0.12)",
    outline: "none",
  }
  const blurStyle = {
    borderColor: "#e5e7eb",
    boxShadow: "none",
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
      await action(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {showError && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
          }}
          role="alert"
        >
          <AlertCircle className="size-4 shrink-0" style={{ color: "#ef4444" }} />
          <p className="text-[13px] font-medium" style={{ color: "#b91c1c" }}>
            Invalid email or password. Please try again.
          </p>
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label
          className="block text-[13px] font-semibold"
          style={{ color: "#374151" }}
        >
          Email address
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
            style={{ color: "#9ca3af" }}
          />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            className="w-full rounded-xl pl-10 pr-4 py-3 text-[14px] outline-none transition-all"
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              color: "#111827",
            }}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
            onBlur={(e) => Object.assign(e.target.style, blurStyle)}
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label
          className="block text-[13px] font-semibold"
          style={{ color: "#374151" }}
        >
          Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
            style={{ color: "#9ca3af" }}
          />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl pl-10 pr-11 py-3 text-[14px] outline-none transition-all"
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              color: "#111827",
            }}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
            onBlur={(e) => Object.assign(e.target.style, blurStyle)}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "#9ca3af" }}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-3 text-[14px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
        style={{
          background: "linear-gradient(135deg, #4338ca 0%, #6366f1 60%, #818cf8 100%)",
          boxShadow: loading
            ? "none"
            : "0 4px 16px rgba(99,102,241,0.4), 0 1px 3px rgba(99,102,241,0.3)",
        }}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in →"
        )}
      </button>
    </form>
  )
}
