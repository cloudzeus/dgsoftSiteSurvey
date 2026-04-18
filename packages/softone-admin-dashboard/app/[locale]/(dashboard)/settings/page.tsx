import { db } from "@/lib/db"
import { SettingsClient } from "@/components/settings/settings-client"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [connections, company] = await Promise.all([
    db.softoneConnection.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, label: true, baseUrl: true, username: true,
        appId: true, company: true, branch: true, module: true, refId: true,
        isDefault: true, isActive: true, lastTestedAt: true, lastTestOk: true,
      },
    }),
    db.appSettings.findUnique({ where: { id: "singleton" } }),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Manage Softone API connections and company information.
        </p>
      </div>
      <SettingsClient
        initialConnections={connections}
        initialCompany={company ?? { id: "singleton", companyName: "", companyLogo: null, address: null, city: null, zip: null, country: null, phone: null, email: null, website: null, taxId: null, taxOffice: null }}
      />
    </div>
  )
}
