"use client"

export function LoginForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const focusStyle = { borderColor: "#6366f1" }
  const blurStyle = { borderColor: "rgba(255,255,255,0.1)" }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label
          className="block text-[12px] font-medium mb-1.5"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          Email address
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="w-full rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          onBlur={(e) => Object.assign(e.target.style, blurStyle)}
        />
      </div>

      <div>
        <label
          className="block text-[12px] font-medium mb-1.5"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          onBlur={(e) => Object.assign(e.target.style, blurStyle)}
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 mt-2"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
        }}
      >
        Sign in →
      </button>
    </form>
  )
}
