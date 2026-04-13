import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { getActiveSoftoneClient } from "@/lib/active-connection"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  await assertApiAccess(req)
  try {
    const conn = await db.softoneConnection.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })

    const client = await getActiveSoftoneClient()
    const { companyinfo } = await client.testConnection()

    return NextResponse.json({
      connected: true,
      companyinfo,
      url: conn?.baseUrl ?? null,
    })
  } catch (err: any) {
    return NextResponse.json(
      { connected: false, error: err.message },
      { status: 500 }
    )
  }
}
