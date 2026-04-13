// Processing Engine
// Picks up PENDING records and delivers them to all active OUTBOUND bindings.

import { db } from "@/lib/db"
import { getConnector } from "@/lib/connectors"

// Renders a payloadTemplate by replacing {{field_name}} with canonical values
function renderTemplate(template: unknown, canonicalData: Record<string, unknown>): unknown {
  const json = JSON.stringify(template)
  const rendered = json.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = canonicalData[key]
    return val !== null && val !== undefined ? String(val) : ""
  })
  return JSON.parse(rendered)
}

export async function processingEngine(entityId: string): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Acquire lock
  const lock = await db.processingLock.findUnique({ where: { entityId } })
  if (lock?.isRunning && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  await db.processingLock.upsert({
    where: { entityId },
    create: { entityId, isRunning: true, lockAcquiredAt: new Date(), lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    update: { isRunning: true, lockAcquiredAt: new Date(), lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  })

  const job = await db.pipelineJob.create({
    data: { entityId, trigger: "MANUAL", status: "RUNNING" },
  })

  let processed = 0, succeeded = 0, failed = 0

  try {
    // Get active outbound bindings
    const outboundBindings = await db.systemBinding.findMany({
      where: {
        entityId,
        isActive: true,
        direction: { in: ["OUTBOUND", "BOTH"] },
      },
      include: {
        connection: true,
        fieldMaps: { include: { canonicalField: true } },
      },
    })

    if (outboundBindings.length === 0) {
      await finalizeJob(job.id, entityId, { processed: 0, succeeded: 0, failed: 0 })
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    // Process records in batches of 50
    const BATCH = 50
    while (true) {
      const records = await db.pipelineRecord.findMany({
        where: { entityId, status: "PENDING" },
        take: BATCH,
        orderBy: { receivedAt: "asc" },
      })

      if (records.length === 0) break

      for (const record of records) {
        processed++

        // Mark as processing
        await db.pipelineRecord.update({
          where: { id: record.id },
          data: { status: "PROCESSING" },
        })

        // Ensure delivery rows exist for all outbound bindings
        for (const binding of outboundBindings) {
          const exists = await db.recordDelivery.findFirst({
            where: { recordId: record.id, bindingId: binding.id },
          })
          if (!exists) {
            await db.recordDelivery.create({
              data: { recordId: record.id, bindingId: binding.id, status: "PENDING" },
            })
          }
        }

        const pendingDeliveries = await db.recordDelivery.findMany({
          where: { recordId: record.id, status: { in: ["PENDING", "FAILED"] }, nextRetryAt: { lte: new Date() } },
        })

        let recordSucceeded = true

        for (const delivery of pendingDeliveries) {
          const binding = outboundBindings.find((b) => b.id === delivery.bindingId)
          if (!binding) continue

          await db.recordDelivery.update({
            where: { id: delivery.id },
            data: { status: "DELIVERING", attempt: { increment: 1 } },
          })

          try {
            const connector = getConnector(binding.connection)
            const canonicalData = record.canonicalData as Record<string, unknown>

            let externalData: Record<string, unknown>
            if (binding.payloadTemplate) {
              // Template mode: render {{field_name}} placeholders and use as-is
              externalData = renderTemplate(binding.payloadTemplate, canonicalData) as Record<string, unknown>
            } else {
              // Field-mapping mode: build external payload from field maps
              externalData = {}
              for (const fm of binding.fieldMaps) {
                let value = canonicalData[fm.canonicalField.name] ?? null
                // Apply @map: transformation if present
                if (fm.transformation?.startsWith("@map:") && value !== null && value !== undefined) {
                  const tableName = fm.transformation.slice(5).trim()
                  const entry = await db.mappingEntry.findFirst({
                    where: { table: { name: tableName }, sourceValue: String(value) },
                  })
                  if (entry) value = entry.targetValue
                }
                externalData[fm.externalField] = value
              }
            }

            // Find existing external ID if we have one
            const pkField = binding.fieldMaps.find((fm) => fm.canonicalField.isPrimaryKey)
            const externalId = pkField ? String(canonicalData[pkField.canonicalField.name] ?? "") : undefined

            const result = await connector.writeRecord(
              binding.objectName,
              externalData,
              externalId || undefined,
              binding.outboundMethod || undefined,
            )

            await db.recordDelivery.update({
              where: { id: delivery.id },
              data: {
                status: "DELIVERED",
                externalId: result.externalId,
                deliveredAt: new Date(),
                errorMessage: null,
              },
            })
          } catch (err) {
            recordSucceeded = false
            const errorMessage = err instanceof Error ? err.message : String(err)
            const newAttempt = delivery.attempt + 1
            const isDead = newAttempt >= 3

            await db.recordDelivery.update({
              where: { id: delivery.id },
              data: {
                status: isDead ? "DEAD" : "FAILED",
                errorMessage,
                nextRetryAt: isDead ? null : new Date(Date.now() + Math.pow(2, newAttempt) * 60_000),
              },
            })
          }
        }

        // Determine final record status
        const allDeliveries = await db.recordDelivery.findMany({ where: { recordId: record.id } })
        const allDone = allDeliveries.every((d) => d.status === "DELIVERED" || d.status === "DEAD")
        const anyFailed = allDeliveries.some((d) => d.status === "FAILED" || d.status === "DEAD")
        const anyDelivered = allDeliveries.some((d) => d.status === "DELIVERED")

        const finalStatus = !anyFailed ? "COMPLETED" : anyDelivered ? "PARTIAL" : "FAILED"

        await db.pipelineRecord.update({
          where: { id: record.id },
          data: { status: finalStatus, processedAt: allDone ? new Date() : null },
        })

        if (recordSucceeded) succeeded++
        else failed++
      }
    }
  } finally {
    await finalizeJob(job.id, entityId, { processed, succeeded, failed })
  }

  return { processed, succeeded, failed }
}

async function finalizeJob(jobId: string, entityId: string, stats: { processed: number; succeeded: number; failed: number }) {
  await db.pipelineJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", ...stats, completedAt: new Date() },
  })
  await db.processingLock.update({
    where: { entityId },
    data: { isRunning: false, lastCompletedAt: new Date() },
  })
}
