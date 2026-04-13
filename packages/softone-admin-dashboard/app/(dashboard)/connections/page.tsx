import { db } from "@/lib/db"
import { checkRole } from "@/lib/permissions"
import { ConnectionsTable } from "@/components/connections/connections-table"
import { S1Inspector } from "@/components/softone/s1-inspector"

export const metadata = { title: "Connections" }
export const dynamic = "force-dynamic"

// Mask any credential key that looks like a secret regardless of connection type
const SENSITIVE_PATTERN = /password|secret|token|apikey|accesskey|privatekey|bearer/i

function maskCredentials(credentials: unknown): Record<string, any> {
  if (!credentials || typeof credentials !== "object") return {}
  const masked: Record<string, any> = {}
  for (const [k, v] of Object.entries(credentials as Record<string, any>)) {
    masked[k] = SENSITIVE_PATTERN.test(k) ? "••••••••" : v
  }
  return masked
}

export default async function ConnectionsPage() {
  const [connections, isAdmin] = await Promise.all([
    db.connection.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bindings: true } } },
    }),
    checkRole("ADMIN"),
  ])

  const safe = connections.map(({ credentials, ...c }) => ({
    ...c,
    credentials: maskCredentials(credentials),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Connections
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            Softone, Shopify, Magento, WooCommerce, Mailgun, Bunny CDN, OpenAI, DeepSeek and custom integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <S1Inspector />
          {!isAdmin && (
            <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
              Read-only
            </span>
          )}
        </div>
      </div>
      <ConnectionsTable connections={safe} isAdmin={isAdmin} />
    </div>
  )
}
