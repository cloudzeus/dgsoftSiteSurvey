// Pure RBAC defaults (no DB) — safe for proxy / edge bundles.

import type { ResourceKey } from "@/lib/rbac-resources"

type PermFlags = { canRead: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean }

const full: PermFlags = {
  canRead: true,
  canAdd: true,
  canEdit: true,
  canDelete: true,
}

const none: PermFlags = {
  canRead: false,
  canAdd: false,
  canEdit: false,
  canDelete: false,
}

const readOnly: PermFlags = {
  canRead: true,
  canAdd: false,
  canEdit: false,
  canDelete: false,
}

export function builtinPerm(role: string, resource: ResourceKey): PermFlags {
  if (role === "ADMIN") return full
  if (role === "OPERATOR") {
    if (resource === "users" || resource === "roles" || resource === "settings") return none
    return full
  }
  if (role === "VIEWER") {
    const canSee = new Set<ResourceKey>([
      "dashboard",
      "monitoring",
      "jobs",
      "records",
      "data",
      "audit",
      "sync-configs",
      "dlq",
    ])
    return canSee.has(resource) ? readOnly : none
  }
  return none
}

export function builtinCanRead(role: string, resource: ResourceKey): boolean {
  return builtinPerm(role, resource).canRead
}

export function userCanReadResource(
  user: { role?: string | null; readResources?: string[] | null },
  resource: ResourceKey,
): boolean {
  const role = user.role ?? "VIEWER"
  if (role === "ADMIN") return true
  const list = user.readResources
  if (list && list.length > 0) return list.includes(resource)
  return builtinCanRead(role, resource)
}
