// Core job processor
// PENDING → IN_PROGRESS → COMPLETED / FAILED → DLQ
// Supports checkpointing for resume on failure
// Alert callbacks injected by the caller (dashboard) to keep the lib decoupled

import { PrismaClient } from "@prisma/client"
import { getSoftoneClient } from "./softone-api"
import type { JobCheckpoint, JobResult } from "./types"

function toLocalTableName(softoneName: string): string {
  return `softone_${softoneName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
}

async function upsertToLocalTable(
  prisma: PrismaClient,
  localTableName: string,
  localData: Record<string, unknown>,
  pkColumnName: string,
  syncConfigId: string
): Promise<void> {
  const rowData: Record<string, unknown> = {
    ...localData,
    _synced_at: new Date(),
    _sync_config_id: syncConfigId,
  }

  const sanitize = (k: string) => k.replace(/[^a-zA-Z0-9_]/g, "_")
  const cols = Object.keys(rowData).map((k) => `\`${sanitize(k)}\``).join(", ")
  const vals = Object.values(rowData)
  const placeholders = vals.map(() => "?").join(", ")
  const nonPkKeys = Object.keys(rowData).filter((k) => sanitize(k) !== sanitize(pkColumnName))
  const updateClause =
    nonPkKeys.length > 0
      ? nonPkKeys.map((k) => `\`${sanitize(k)}\` = VALUES(\`${sanitize(k)}\`)`).join(", ")
      : `\`_synced_at\` = VALUES(\`_synced_at\`)`

  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO \`${localTableName}\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
    ...vals
  )
}

export interface ProcessJobCallbacks {
  onJobFailed?: (opts: {
    jobId: string
    syncConfigId: string
    objectName: string
    tableName: string
    operation: string
    retryCount: number
    maxRetries: number
    errorMessage: string
  }) => Promise<void>

  onDLQCreated?: (opts: {
    dlqId: string
    originalJobId: string
    syncConfigId: string
    operation: string
    severity: string
    errorReason: string
  }) => Promise<void>
}

export async function processJob(
  prisma: PrismaClient,
  jobId: string,
  callbacks: ProcessJobCallbacks = {},
  clientOverride?: import("./softone-api").SoftoneAPIClient
): Promise<void> {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    include: { syncConfig: { include: { fieldMappings: true } } },
  })

  if (!job) throw new Error(`SyncJob ${jobId} not found`)

  await prisma.syncJob.update({
    where: { id: jobId },
    data: { status: "IN_PROGRESS", lastAttempt: new Date() },
  })

  const checkpoint: JobCheckpoint = job.checkpointData
    ? (JSON.parse(job.checkpointData) as JobCheckpoint)
    : { lastProcessedId: null, offset: 0, totalFetched: 0 }

  const result: JobResult = {
    successful: 0,
    failed: 0,
    skipped: 0,
    processedIds: [],
  }

  try {
    const client = clientOverride ?? getSoftoneClient()
    const { objectName, tableName, batchSize, filterClause } = job.syncConfig as typeof job.syncConfig & { filterClause?: string | null }

    const primaryKeyField = job.syncConfig.fieldMappings.find((f) => f.isPrimaryKey)

    // Fetch first batch to get totalCount, then loop through all pages
    let totalCount = 0
    let isFirstBatch = true

    while (true) {
      const { records, totalCount: fetchedTotal } = await client.fetchRecords(objectName, tableName, {
        batchSize,
        offset: checkpoint.offset,
        filter: filterClause ?? undefined,
      })

      // On first batch, record the total and update the job
      if (isFirstBatch) {
        totalCount = fetchedTotal
        isFirstBatch = false
        await prisma.syncJob.update({
          where: { id: jobId },
          data: { totalRecords: totalCount } as Record<string, unknown>,
        })
      }

      if (records.length === 0) break

      for (const softoneRecord of records) {
        try {
          if (!primaryKeyField) {
            result.skipped++
            checkpoint.offset++
            continue
          }

          const recordId = String(softoneRecord[primaryKeyField.softoneFieldName] ?? "")

          const localData: Record<string, unknown> = {}
          for (const mapping of job.syncConfig.fieldMappings) {
            if (!mapping.isSyncable) continue
            localData[mapping.localColumnName] = softoneRecord[mapping.softoneFieldName] ?? null
          }

          await prisma.syncAudit.create({
            data: {
              syncJobId: jobId,
              syncConfigId: job.syncConfigId,
              action: "FETCH",
              recordId,
              softoneData: JSON.stringify(softoneRecord),
              localData: JSON.stringify(localData),
              executedBy: "system",
            },
          })

          // Write to the dynamic MySQL table for PERSISTENT configs
          if ((job.syncConfig as any).usageType === "PERSISTENT") {
            const localTableName = toLocalTableName(tableName)
            await upsertToLocalTable(prisma, localTableName, localData, primaryKeyField.localColumnName, job.syncConfigId)
          }

          result.successful++
          result.processedIds.push(recordId)
          checkpoint.offset++
          checkpoint.totalFetched++
        } catch {
          result.failed++
          checkpoint.offset++
        }
      }

      // Update live progress after each batch
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          recordsProcessed: result.successful + result.failed + result.skipped,
          recordsSuccessful: result.successful,
          recordsFailed: result.failed,
          checkpointData: JSON.stringify(checkpoint),
        } as Record<string, unknown>,
      })

      // Stop when we've fetched everything
      if (totalCount > 0 && checkpoint.offset >= totalCount) break
      if (records.length < batchSize) break
    }

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: result.failed > 0 ? "PARTIAL_FAILURE" : "COMPLETED",
        recordsProcessed: result.successful + result.failed + result.skipped,
        recordsSuccessful: result.successful,
        recordsFailed: result.failed,
        completedAt: new Date(),
        checkpointData: null,
        processedRecords: JSON.stringify(result.processedIds),
      },
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))

    const updatedJob = await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        retryCount: { increment: 1 },
        errorMessage: error.message,
        errorStack: error.stack ?? null,
        checkpointData: JSON.stringify(checkpoint),
      },
    })

    // Fire failure alert (non-blocking — don't let email failure crash the job)
    callbacks.onJobFailed?.({
      jobId,
      syncConfigId: job.syncConfigId,
      objectName: job.syncConfig.objectName,
      tableName: job.syncConfig.tableName,
      operation: job.operation,
      retryCount: updatedJob.retryCount,
      maxRetries: updatedJob.maxRetries,
      errorMessage: error.message,
    }).catch(console.error)

    if (updatedJob.retryCount >= updatedJob.maxRetries) {
      const dlq = await moveToDLQ(
        prisma,
        jobId,
        job.syncConfigId,
        job.operation,
        error.message,
        "ERROR"
      )

      callbacks.onDLQCreated?.({
        dlqId: dlq.id,
        originalJobId: jobId,
        syncConfigId: job.syncConfigId,
        operation: job.operation,
        severity: "ERROR",
        errorReason: error.message,
      }).catch(console.error)
    }

    throw error
  }
}

async function moveToDLQ(
  prisma: PrismaClient,
  originalJobId: string,
  syncConfigId: string,
  operation: string,
  errorReason: string,
  severity: "WARNING" | "ERROR" | "CRITICAL"
) {
  return prisma.syncJobDLQ.create({
    data: {
      originalJobId,
      syncConfigId,
      operation,
      recordData: "{}",
      errorReason,
      severity,
      requiresManualReview: true,
    },
  })
}

// ─── Cron trigger with lock ───────────────────────────────────────────────────

export async function triggerSyncForConfig(
  prisma: PrismaClient,
  syncConfigId: string,
  callbacks: ProcessJobCallbacks = {},
  clientOverride?: import("./softone-api").SoftoneAPIClient
): Promise<{ jobId: string } | { skipped: true }> {
  let lock = await prisma.cronJobLock.findUnique({ where: { syncConfigId } })

  if (lock?.isRunning && lock.lockExpiresAt && lock.lockExpiresAt < new Date()) {
    await prisma.cronJobLock.update({
      where: { syncConfigId },
      data: { isRunning: false },
    })
    lock = await prisma.cronJobLock.findUnique({ where: { syncConfigId } })
  }

  if (lock?.isRunning) return { skipped: true }

  await prisma.cronJobLock.upsert({
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

  try {
    const job = await prisma.syncJob.create({
      data: { syncConfigId, operation: "FETCH", status: "PENDING" },
    })

    await processJob(prisma, job.id, callbacks, clientOverride)

    return { jobId: job.id }
  } finally {
    await prisma.cronJobLock.update({
      where: { syncConfigId },
      data: { isRunning: false, lastCompletedAt: new Date() },
    })
  }
}
