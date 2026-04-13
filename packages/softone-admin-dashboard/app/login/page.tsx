import { signIn } from "@/lib/auth"
import { CredentialsSignin } from "next-auth"
import { redirect } from "next/navigation"
import { Zap } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"

export const metadata = { title: "Sign in" }

function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  )
}

async function loginAction(formData: FormData) {
  "use server"
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    })
  } catch (e) {
    if (isNextRedirect(e)) throw e
    if (e instanceof CredentialsSignin) redirect("/login?error=invalid")
    throw e
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const showInvalid = error === "invalid"

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--sidebar-bg)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.15), transparent)",
        }}
      />

      <div className="relative w-full max-w-sm px-4">
        <div className="flex flex-col items-center mb-8">
          <div
            className="size-12 rounded-2xl flex items-center justify-center mb-3"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
            }}
          >
            <Zap className="size-5 text-white" />
          </div>
          <h1 className="text-[20px] font-bold text-white">Softone Sync</h1>
          <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            Sign in to your dashboard
          </p>
        </div>

        <div
          className="rounded-2xl p-7"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
          }}
        >
          {showInvalid ? (
            <p className="text-[13px] text-red-400 mb-4" role="alert">
              Invalid email or password.
            </p>
          ) : null}
          <LoginForm action={loginAction} />
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          Softone ERP Integration Platform
        </p>
      </div>
    </div>
  )
}
