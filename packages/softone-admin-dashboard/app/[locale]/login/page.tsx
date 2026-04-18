import { signIn, microsoftAuthEnabled } from "@/lib/auth"
import { CredentialsSignin } from "next-auth"
import { redirect } from "next/navigation"
import { Map, ClipboardList, ShieldCheck, CheckCircle2 } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"

export const metadata = { title: "Sign in — Site Survey Platform" }

async function microsoftSignInAction() {
  "use server"
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" })
}

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

const FEATURES = [
  { icon: Map,          text: "Precise site survey management" },
  { icon: ClipboardList, text: "Automated proposal generation" },
  { icon: ShieldCheck,  text: "Role-based access & audit trail" },
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const showInvalid = error === "invalid"
  const showNotImported = error === "NotImported"
  const showNoEmail = error === "NoEmail"

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden"
      style={{ background: "#eef1f6" }}
    >
      {/* Page background accents */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 10% 10%, rgba(99,102,241,0.09), transparent)," +
            "radial-gradient(ellipse 50% 40% at 90% 90%, rgba(139,92,246,0.07), transparent)",
        }}
      />

      {/* ── Main card ──────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-[920px] rounded-3xl overflow-hidden flex flex-col md:flex-row"
        style={{
          boxShadow:
            "0 32px 80px rgba(17,17,26,0.12), 0 8px 24px rgba(17,17,26,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
          minHeight: "600px",
        }}
      >
        {/* ── Left branded panel ───────────────────────────────────── */}
        <div
          className="relative flex flex-col overflow-hidden md:w-[420px] shrink-0 p-10 md:p-12"
          style={{
            background:
              "linear-gradient(145deg, #1e1b4b 0%, #312e81 28%, #4338ca 60%, #6366f1 100%)",
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "-80px",
              right: "-80px",
              width: "360px",
              height: "360px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              top: "-40px",
              right: "-40px",
              width: "240px",
              height: "240px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: "-100px",
              left: "-60px",
              width: "300px",
              height: "300px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
            }}
          />
          {/* Dot grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-auto">
              <div
                className="size-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Map className="size-5 text-white" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-white leading-none">
                  Site Survey
                </p>
                <p
                  className="text-[11px] font-medium leading-none mt-1"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Platform
                </p>
              </div>
            </div>

            {/* Headline */}
            <div className="mt-14 mb-10">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-5 text-[11px] font-semibold tracking-wide uppercase"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#c7d2fe",
                  letterSpacing: "0.06em",
                }}
              >
                <CheckCircle2 className="size-3" />
                Professional Edition
              </div>
              <h2 className="text-[36px] font-extrabold text-white leading-[1.15] mb-4">
                Survey smarter,
                <br />
                <span style={{ color: "#a5b4fc" }}>deliver faster.</span>
              </h2>
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: "rgba(255,255,255,0.5)", maxWidth: "300px" }}
              >
                The all-in-one platform for professional site survey teams. Capture, analyze, and report — all in one place.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-auto">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div
                    className="size-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <Icon className="size-4" style={{ color: "#c7d2fe" }} />
                  </div>
                  <span
                    className="text-[13px]"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>

            <p
              className="text-[11px] mt-10"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              © {new Date().getFullYear()} World Wide Associates E.E
            </p>
          </div>
        </div>

        {/* ── Right form panel ─────────────────────────────────────── */}
        <div className="flex-1 bg-white flex flex-col justify-center px-8 py-12 md:px-12">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 md:hidden">
            <div
              className="size-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #4338ca 0%, #6366f1 100%)",
              }}
            >
              <Map className="size-4 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-gray-900 leading-none">
                Site Survey Platform
              </p>
            </div>
          </div>

          <div className="max-w-[380px] w-full mx-auto">
            <div className="mb-8">
              <div className="mb-6">
                <img
                  src="https://dgsoft.b-cdn.net/media/cmnudo9vv0001d43bk8cyjncr/1776144697342-7ikwrx.webp"
                  alt="Site Survey Platform"
                  style={{ height: 100, width: "auto", display: "block" }}
                />
              </div>
              <h2
                className="text-[26px] font-extrabold leading-tight"
                style={{ color: "#111827" }}
              >
                Welcome back
              </h2>
              <p className="text-[14px] mt-1.5" style={{ color: "#6b7280" }}>
                Sign in to your workspace to continue
              </p>
            </div>

            {(showNotImported || showNoEmail) && (
              <div
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-5"
                style={{ background: "#fef3c7", border: "1px solid #fde68a" }}
              >
                <div className="text-[12px]" style={{ color: "#78350f" }}>
                  <p className="font-semibold">
                    {showNotImported ? "Δεν έχετε πρόσβαση" : "Λείπει το email"}
                  </p>
                  <p className="mt-0.5">
                    {showNotImported
                      ? "Ο λογαριασμός σας Microsoft δεν έχει εισαχθεί. Επικοινωνήστε με τον διαχειριστή."
                      : "Ο λογαριασμός Microsoft δεν επέστρεψε διεύθυνση email."}
                  </p>
                </div>
              </div>
            )}

            <LoginForm action={loginAction} showError={showInvalid} />

            {microsoftAuthEnabled && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#9ca3af" }}>ή</span>
                  <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
                </div>
                <form action={microsoftSignInAction}>
                  <button
                    type="submit"
                    className="w-full rounded-xl py-3 text-[14px] font-semibold transition-all hover:bg-gray-50 active:scale-[0.99] flex items-center justify-center gap-2.5"
                    style={{ background: "#fff", border: "1px solid #d1d5db", color: "#374151" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#7fba00" d="M12 1h10v10H12z" />
                      <path fill="#00a4ef" d="M1 12h10v10H1z" />
                      <path fill="#ffb900" d="M12 12h10v10H12z" />
                    </svg>
                    Σύνδεση με Microsoft 365
                  </button>
                </form>
              </>
            )}

            <p className="text-center text-[12px] mt-8" style={{ color: "#9ca3af" }}>
              Need access?{" "}
              <span style={{ color: "#6366f1", fontWeight: 600 }}>
                Contact your administrator
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
