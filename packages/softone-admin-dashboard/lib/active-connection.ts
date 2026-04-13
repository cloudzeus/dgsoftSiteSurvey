// Returns a SoftoneAPIClient using the active connection stored in the DB.
// Credentials are never read from env vars — always from SoftoneConnection table.

import { SoftoneAPIClient } from "@softone/sync"
import { db } from "@/lib/db"

export async function getActiveSoftoneClient(): Promise<SoftoneAPIClient> {
  const conn = await db.softoneConnection.findFirst({
    where: { isDefault: true, isActive: true },
  }) ?? await db.softoneConnection.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  })

  if (!conn) throw new Error("No active Softone connection found. Add one via the Connections page.")

  const cleanBase = conn.baseUrl.replace(/\/+$/, "").replace(/\/s1services$/i, "")
  return new SoftoneAPIClient({
    baseUrl: `${cleanBase}/s1services`,
    username: conn.username,
    password: conn.password,
    appId: conn.appId,
    company: conn.company,
    branch: conn.branch,
    module: conn.module,
    refId: conn.refId,
    sessionTtlHours: conn.sessionTtlHours,
  })
}
