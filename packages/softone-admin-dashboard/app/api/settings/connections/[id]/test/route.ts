import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { SoftoneAPIClient } from "@softone/sync"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  const conn = await db.softoneConnection.findUnique({ where: { id } })
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const client = new SoftoneAPIClient({
      baseUrl: `${conn.baseUrl}/s1services`,
      username: conn.username,
      password: conn.password,
      appId: conn.appId,
      company: conn.company,
      branch: conn.branch,
      module: conn.module,
      refId: conn.refId,
    })

    const { companyinfo } = await client.testConnection()

    await db.softoneConnection.update({
      where: { id: conn.id },
      data: { lastTestedAt: new Date(), lastTestOk: true },
    })

    return NextResponse.json({ ok: true, companyinfo })
  } catch (err: any) {
    await db.softoneConnection.update({
      where: { id: conn.id },
      data: { lastTestedAt: new Date(), lastTestOk: false },
    })
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 })
  }
}
