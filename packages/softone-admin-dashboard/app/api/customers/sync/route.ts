import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"
import { syncCustomers } from "@/lib/customers-sync"

export async function POST(req: Request) {
  await assertApiAccess(req)
  try {
    const result = await syncCustomers()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
