import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/import/bindings?connectionId={id}
// Returns all active INBOUND or BOTH bindings for a connection,
// each with its entity name and PipelineFields (used as mapping targets).
export async function GET(req: Request) {
  await assertApiAccess(req)
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const connectionId = searchParams.get("connectionId")
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 })

  const bindings = await db.systemBinding.findMany({
    where: {
      connectionId,
      isActive: true,
      direction: { in: ["INBOUND", "BOTH"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      entity: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          fields: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              label: true,
              dataType: true,
              isPrimaryKey: true,
              isRequired: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json(bindings)
}
