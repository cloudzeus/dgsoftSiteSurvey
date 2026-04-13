// RBAC helpers for API routes and server actions
// Roles: ADMIN > OPERATOR > VIEWER

import { auth } from "@/lib/auth"

export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER"

const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
}

function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Throw a 403 Response if the current session user doesn't have the required role.
 * Use at the top of API route handlers and server actions.
 */
export async function requireRole(role: UserRole): Promise<void> {
  const session = await auth()

  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 })
  }

  const userRole = ((session.user as { role?: UserRole }).role ?? "VIEWER") as UserRole

  if (!hasRole(userRole, role)) {
    throw new Response("Forbidden", { status: 403 })
  }
}

/**
 * Check role without throwing — useful for conditional UI rendering in server components.
 */
export async function checkRole(role: UserRole): Promise<boolean> {
  const session = await auth()
  if (!session?.user) return false
  const userRole = ((session.user as { role?: UserRole }).role ?? "VIEWER") as UserRole
  return hasRole(userRole, role)
}

export { assertApiAccess, requireResourceAction } from "@/lib/rbac-guard"
