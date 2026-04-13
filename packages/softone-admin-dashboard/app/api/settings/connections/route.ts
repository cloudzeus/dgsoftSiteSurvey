import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { z } from "zod"

const ConnectionSchema = z.object({
  label:    z.string().min(1),
  baseUrl:  z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  appId:    z.string().min(1),
  company:  z.string().default(""),
  branch:   z.string().default(""),
  module:   z.string().default(""),
  refId:    z.string().default(""),
  isDefault: z.boolean().default(false),
  isActive:  z.boolean().default(true),
})

export async function GET(req: Request) {
  await assertApiAccess(req)
  const connections = await db.softoneConnection.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, label: true, baseUrl: true, username: true,
      appId: true, company: true, branch: true, module: true, refId: true,
      isDefault: true, isActive: true, lastTestedAt: true, lastTestOk: true,
      createdAt: true, updatedAt: true,
      // never return password in list
    },
  })
  return NextResponse.json(connections)
}

export async function POST(req: Request) {
  await assertApiAccess(req)
  const body = await req.json()
  const parsed = ConnectionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const data = parsed.data

  // If this is being set as default, clear existing default first
  if (data.isDefault) {
    await db.softoneConnection.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
  }

  const conn = await db.softoneConnection.create({ data: { ...data, name: data.label } })
  const { password: _, ...safe } = conn
  return NextResponse.json(safe, { status: 201 })
}
