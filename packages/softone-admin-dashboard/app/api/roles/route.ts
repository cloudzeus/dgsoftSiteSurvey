import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

// GET /api/roles — load all RolePermission rows
export async function GET(req: Request) {
  await assertApiAccess(req)

  const permissions = await db.rolePermission.findMany({
    orderBy: [{ role: "asc" }, { resource: "asc" }],
  })

  return NextResponse.json(permissions)
}

// PUT /api/roles — upsert a single (role, resource) row
// body: { role, resource, canRead, canAdd, canEdit, canDelete }
export async function PUT(req: Request) {
  await assertApiAccess(req)

  const body = await req.json()
  const { role, resource, canRead, canAdd, canEdit, canDelete } = body

  if (!role || !resource) {
    return NextResponse.json({ error: "role and resource are required" }, { status: 400 })
  }

  const validRoles = ["ADMIN", "OPERATOR", "VIEWER"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const permission = await db.rolePermission.upsert({
    where: { role_resource: { role, resource } },
    create: {
      role,
      resource,
      canRead: canRead ?? false,
      canAdd: canAdd ?? false,
      canEdit: canEdit ?? false,
      canDelete: canDelete ?? false,
    },
    update: {
      canRead: canRead ?? false,
      canAdd: canAdd ?? false,
      canEdit: canEdit ?? false,
      canDelete: canDelete ?? false,
    },
  })

  return NextResponse.json(permission)
}
