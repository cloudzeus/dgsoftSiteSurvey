import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"
import { s1Log } from "@/lib/s1-log"

export async function GET(req: Request) {
  await assertApiAccess(req)
  return NextResponse.json(s1Log.all())
}

export async function DELETE(req: Request) {
  await assertApiAccess(req)
  s1Log.clear()
  return NextResponse.json({ ok: true })
}
