import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"
import { s1Test } from "@/lib/s1"

export async function POST(req: Request) {
  await assertApiAccess(req)
  const result = await s1Test()
  return NextResponse.json(result)
}
