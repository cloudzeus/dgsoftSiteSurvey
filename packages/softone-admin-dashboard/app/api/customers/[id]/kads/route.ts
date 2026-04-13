import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customerId = parseInt(id, 10)
  if (isNaN(customerId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const kads = await db.$queryRaw<
    { id: number; kadCode: string; kadDescription: string; kadType: string }[]
  >`
    SELECT id, kadCode, kadDescription, kadType
    FROM CompanyKad
    WHERE customerId = ${customerId}
    ORDER BY kadType ASC, kadCode ASC
  `

  return NextResponse.json(kads)
}
