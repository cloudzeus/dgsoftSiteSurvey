import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertApiAccess(_req)
  const { id } = await params
  const job = await db.syncJob.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      operation: true,
      totalRecords: true,
      recordsProcessed: true,
      recordsSuccessful: true,
      recordsFailed: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(job)
}
