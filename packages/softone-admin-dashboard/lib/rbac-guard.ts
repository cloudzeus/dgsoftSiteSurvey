// Request guards (imports auth).

import { auth } from "@/lib/auth"
import {
  apiPathToResource,
  getEffectivePerm,
  httpMethodToAction,
  type PermAction,
  type UserRole,
} from "@/lib/rbac-policy"
import type { ResourceKey } from "@/lib/rbac-resources"

export async function requireResourceAction(resource: ResourceKey, action: PermAction): Promise<void> {
  const session = await auth()
  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 })
  }
  const role = ((session.user as { role?: string }).role ?? "VIEWER") as UserRole
  if (role === "ADMIN") return

  const eff = await getEffectivePerm(role, resource)
  const key =
    action === "read"
      ? "canRead"
      : action === "add"
        ? "canAdd"
        : action === "edit"
          ? "canEdit"
          : "canDelete"
  if (!eff[key]) {
    throw new Response("Forbidden", { status: 403 })
  }
}

export async function assertApiAccess(req: Request): Promise<void> {
  const path = new URL(req.url).pathname
  if (path.startsWith("/api/auth")) return
  if (path.startsWith("/api/webhook")) return
  if (path.startsWith("/api/cron")) return

  const resource = apiPathToResource(path)
  if (!resource) {
    const session = await auth()
    if (!session?.user) throw new Response("Unauthorized", { status: 401 })
    return
  }
  const action = httpMethodToAction(req.method)
  await requireResourceAction(resource, action)
}
