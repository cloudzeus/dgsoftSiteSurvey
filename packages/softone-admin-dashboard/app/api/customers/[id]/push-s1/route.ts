import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"
import { db } from "@/lib/db"
import { s1 } from "@/lib/s1"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertApiAccess(req)

  const { id } = await params
  const customer = await db.customer.findUnique({ where: { id: Number(id) } })

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }
  if (!customer.trdr) {
    return NextResponse.json({ error: "Customer has no TRDR — push not possible" }, { status: 400 })
  }

  // Build data — only non-null coordinate fields
  const data: Record<string, unknown> = {}
  if (customer.latitude  != null) data.LATITUDE  = customer.latitude
  if (customer.longitude != null) data.LONGITUDE = customer.longitude

  const res = await s1<{ success: boolean; error?: string }>("setData", {
    OBJECT: "CUSTOMER",
    FORM:   "",
    KEY:    customer.trdr,
    data:   { CUSTOMER: [data] },
  })

  if (!res.success) {
    return NextResponse.json({ error: res.error ?? "setData failed" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
