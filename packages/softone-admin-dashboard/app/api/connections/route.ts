import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request) {
  await assertApiAccess(req)
  const connections = await db.connection.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bindings: true } } },
  })
  // Strip sensitive credentials before returning
  return NextResponse.json(connections.map(({ credentials, ...c }) => ({
    ...c,
    credentials: maskCredentials(c.type, credentials as Record<string, any>),
  })))
}

export async function POST(req: Request) {
  await assertApiAccess(req)
  const body = await req.json()

  const { name, type, baseUrl, credentials } = body
  if (!name || !type) return NextResponse.json({ error: "name and type required" }, { status: 400 })

  const connection = await db.connection.create({
    data: { name, type, baseUrl: baseUrl || null, credentials },
  })

  return NextResponse.json(connection, { status: 201 })
}

const SENSITIVE_PATTERN = /password|secret|token|apikey|accesskey|privatekey|bearer/i

function maskCredentials(_type: string, creds: Record<string, any>) {
  const masked: Record<string, any> = {}
  for (const [k, v] of Object.entries(creds)) {
    masked[k] = SENSITIVE_PATTERN.test(k) ? "••••••••" : v
  }
  return masked
}
