import { NextResponse, after } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { processJob } from "@softone/sync"
import { sendJobFailureAlert, sendDLQAlert } from "@/lib/alerts"
import { getActiveSoftoneClient } from "@/lib/active-connection"

const alertCallbacks = {
  onJobFailed: sendJobFailureAlert,
  onDLQCreated: sendDLQAlert,
}

export async function GET(req: Request) {
  await assertApiAccess(req)
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const configId = searchParams.get("configId")
  const page = Number(searchParams.get("page") ?? "1")
  const pageSize = 20

  const where = {
    ...(status ? { status } : {}),
    ...(configId ? { syncConfigId: configId } : {}),
  }

  const [jobs, total] = await Promise.all([
    db.syncJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        syncConfig: { select: { objectName: true, tableName: true } },
      },
    }),
    db.syncJob.count({ where }),
  ])

  return NextResponse.json({ jobs, total, page, pageSize })
}

export async function POST(req: Request) {
  await assertApiAccess(req)

  const { syncConfigId } = (await req.json()) as { syncConfigId: string }
  if (!syncConfigId) {
    return NextResponse.json({ error: "syncConfigId required" }, { status: 400 })
  }

  // Check for an active lock
  let lock = await db.cronJobLock.findUnique({ where: { syncConfigId } })

  if (lock?.isRunning && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
    return NextResponse.json({ message: "Job already running" }, { status: 409 })
  }

  // Clear a stale expired lock
  if (lock?.isRunning) {
    await db.cronJobLock.update({ where: { syncConfigId }, data: { isRunning: false } })
  }

  // Acquire lock and create the job record before returning
  await db.cronJobLock.upsert({
    where: { syncConfigId },
    create: {
      syncConfigId,
      isRunning: true,
      lockAcquiredAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    update: {
      isRunning: true,
      lockAcquiredAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })

  const job = await db.syncJob.create({
    data: { syncConfigId, operation: "FETCH", status: "PENDING" },
  })

  const client = await getActiveSoftoneClient()

  // Process the job after the response is sent so the user gets the jobId immediately
  after(async () => {
    try {
      await processJob(db, job.id, alertCallbacks, client)
    } catch (err) {
      console.error(`Sync job ${job.id} failed:`, err)
    } finally {
      await db.cronJobLock.update({
        where: { syncConfigId },
        data: { isRunning: false, lastCompletedAt: new Date() },
      })
    }
  })

  return NextResponse.json({ jobId: job.id }, { status: 202 })
}
