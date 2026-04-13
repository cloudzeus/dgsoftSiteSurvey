import Link from "next/link"

export const metadata = { title: "Access denied" }

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: "var(--background)" }}>
      <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
        Access denied
      </h1>
      <p className="text-sm text-center max-w-md" style={{ color: "var(--foreground-muted)" }}>
        Your role does not include permission to open this area. Ask an administrator to update your access in{" "}
        <span className="font-medium">Roles &amp; permissions</span>.
      </p>
      <Link href="/dashboard" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
        Back to overview
      </Link>
    </div>
  )
}
