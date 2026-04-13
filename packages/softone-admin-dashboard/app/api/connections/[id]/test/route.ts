import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { getConnector } from "@/lib/connectors"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(req)
  console.log("[test/route] POST hit")
  console.log("[test/route] role ok")
  const { id } = await params
  console.log("[test/route] id →", id)

  const connection = await db.connection.findUnique({ where: { id } })
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 })
  console.log("[test/route] stored credentials →", JSON.stringify(connection.credentials))

  // Optional: caller may pass partial credentials — merge with stored ones (empty = keep stored)
  let credentials = connection.credentials as Record<string, any>
  try {
    const body = await req.json()
    console.log("[test/route] body credentials →", JSON.stringify(body?.credentials))
    if (body?.credentials && typeof body.credentials === "object") {
      const merged: Record<string, any> = { ...credentials }
      for (const [k, v] of Object.entries(body.credentials as Record<string, any>)) {
        const str = String(v ?? "").trim()
        if (str !== "") merged[k] = v
      }
      credentials = merged
    }
  } catch { /* no body is fine */ }

  console.log("[test/route] final credentials (no password) →", JSON.stringify({ ...credentials, password: "***" }))

  const connector = getConnector({ ...connection, credentials })
  const { ok, error, raw } = await connector.testConnection()
  console.log("[test/route] result →", { ok, error })

  await db.connection.update({
    where: { id },
    data: { lastTestedAt: new Date(), lastTestOk: ok },
  })

  return NextResponse.json({ ok, ...(error ? { error } : {}), ...(raw !== undefined ? { raw } : {}) })
}
