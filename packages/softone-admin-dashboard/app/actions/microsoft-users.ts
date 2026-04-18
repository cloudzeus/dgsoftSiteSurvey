"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { listTenantUsers, type GraphUser } from "@/lib/microsoft-graph"

async function requireAdmin(): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Δεν είστε συνδεδεμένος")
  const u = session.user as { role?: string }
  if (u.role !== "ADMIN") throw new Error("Απαιτείται ρόλος Διαχειριστή")
}

export interface TenantUserRow {
  graphId: string
  email: string
  displayName: string | null
  jobTitle: string | null
  mobilePhone: string | null
  officeLocation: string | null
  accountEnabled: boolean
  alreadyImported: boolean
}

export async function listMicrosoftTenantUsers(): Promise<
  | { ok: true; users: TenantUserRow[] }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin()
    const tenantUsers = await listTenantUsers()

    const emails = tenantUsers
      .map((u) => (u.mail ?? u.userPrincipalName)?.toLowerCase())
      .filter((e): e is string => Boolean(e))
    const existing = await db.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    })
    const existingSet = new Set(existing.map((e) => e.email.toLowerCase()))

    const rows: TenantUserRow[] = tenantUsers
      .map((u: GraphUser): TenantUserRow | null => {
        const email = (u.mail ?? u.userPrincipalName ?? "").toLowerCase()
        if (!email) return null
        return {
          graphId: u.id,
          email,
          displayName: u.displayName,
          jobTitle: u.jobTitle,
          mobilePhone: u.mobilePhone ?? u.businessPhones?.[0] ?? null,
          officeLocation: u.officeLocation,
          accountEnabled: u.accountEnabled,
          alreadyImported: existingSet.has(email),
        }
      })
      .filter((r): r is TenantUserRow => r !== null)
      .sort((a, b) => (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email, "el"))

    return { ok: true, users: rows }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function importMicrosoftUsers(
  emails: string[],
  role: "ADMIN" | "OPERATOR" | "VIEWER" = "VIEWER",
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    if (emails.length === 0) return { ok: true, created: 0, skipped: 0 }

    const tenantUsers = await listTenantUsers()
    const byEmail = new Map<string, GraphUser>()
    for (const u of tenantUsers) {
      const e = (u.mail ?? u.userPrincipalName ?? "").toLowerCase()
      if (e) byEmail.set(e, u)
    }

    let created = 0
    let skipped = 0

    for (const rawEmail of emails) {
      const email = rawEmail.toLowerCase()
      const graphUser = byEmail.get(email)
      if (!graphUser) { skipped++; continue }

      const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
      if (existing) { skipped++; continue }

      await db.user.create({
        data: {
          email,
          name: graphUser.displayName,
          role,
          jobPosition: graphUser.jobTitle,
          mobile: graphUser.mobilePhone ?? graphUser.businessPhones?.[0] ?? null,
          city: graphUser.officeLocation,
          // No password — these users sign in via Microsoft SSO only.
        },
      })
      created++
    }

    revalidatePath("/users")
    return { ok: true, created, skipped }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
