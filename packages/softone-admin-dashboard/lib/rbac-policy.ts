// RBAC policy + DB rows (imports db — do not import from proxy).

import { builtinPerm } from "@/lib/rbac-builtins"
import { db } from "@/lib/db"
import {
  ALL_RESOURCE_KEYS,
  type ResourceKey,
  RESOURCE_KEYS,
} from "@/lib/rbac-resources"

export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER"

export type PermAction = "read" | "add" | "edit" | "delete"

type PermFlags = { canRead: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean }

const full: PermFlags = {
  canRead: true,
  canAdd: true,
  canEdit: true,
  canDelete: true,
}

function rowToPerm(row: {
  canRead: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}): PermFlags {
  return {
    canRead: row.canRead,
    canAdd: row.canAdd,
    canEdit: row.canEdit,
    canDelete: row.canDelete,
  }
}

export async function getEffectivePerm(role: string, resource: ResourceKey): Promise<PermFlags> {
  if (role === "ADMIN") return full
  const row = await db.rolePermission.findUnique({
    where: { role_resource: { role, resource } },
  })
  if (row) return rowToPerm(row)
  return builtinPerm(role, resource)
}

export async function getReadableResourceKeysForRole(role: string): Promise<ResourceKey[]> {
  if (role === "ADMIN") return ALL_RESOURCE_KEYS

  const rows = await db.rolePermission.findMany({ where: { role } })
  const map = new Map(rows.map((r) => [r.resource, r]))

  const keys: ResourceKey[] = []
  for (const resource of RESOURCE_KEYS) {
    const row = map.get(resource)
    const eff = row ? rowToPerm(row) : builtinPerm(role, resource)
    if (eff.canRead) keys.push(resource)
  }
  return keys
}

function actionToKey(action: PermAction): keyof PermFlags {
  switch (action) {
    case "read":
      return "canRead"
    case "add":
      return "canAdd"
    case "edit":
      return "canEdit"
    case "delete":
      return "canDelete"
  }
}

export async function roleHasAction(
  role: string,
  resource: ResourceKey,
  action: PermAction,
): Promise<boolean> {
  if (role === "ADMIN") return true
  const eff = await getEffectivePerm(role, resource)
  return eff[actionToKey(action)]
}

export function httpMethodToAction(method: string): PermAction {
  const m = method.toUpperCase()
  if (m === "GET" || m === "HEAD") return "read"
  if (m === "POST") return "add"
  if (m === "PUT" || m === "PATCH") return "edit"
  if (m === "DELETE") return "delete"
  return "read"
}

export function apiPathToResource(pathname: string): ResourceKey | null {
  const rules: [RegExp, ResourceKey][] = [
    [/^\/api\/users(?:\/|$)/, "users"],
    [/^\/api\/roles(?:\/|$)/, "roles"],
    [/^\/api\/settings(?:\/|$)/, "settings"],
    [/^\/api\/sync-config(?:\/|$)/, "sync-configs"],
    [/^\/api\/connections(?:\/|$)/, "connections"],
    [/^\/api\/entities(?:\/|$)/, "entities"],
    [/^\/api\/mappings(?:\/|$)/, "mappings"],
    [/^\/api\/identity-maps(?:\/|$)/, "identity-maps"],
    [/^\/api\/jobs(?:\/|$)/, "jobs"],
    [/^\/api\/process(?:\/|$)/, "jobs"],
    [/^\/api\/data(?:\/|$)/, "data"],
    [/^\/api\/media(?:\/|$)/, "media"],
    [/^\/api\/import(?:\/|$)/, "import"],
    [/^\/api\/xml-feeds(?:\/|$)/, "xml-feeds"],
    [/^\/api\/softone(?:\/|$)/, "entities"],
    [/^\/api\/s1(?:\/|$)/, "entities"],
  ]
  for (const [re, resource] of rules) {
    if (re.test(pathname)) return resource
  }
  return null
}
