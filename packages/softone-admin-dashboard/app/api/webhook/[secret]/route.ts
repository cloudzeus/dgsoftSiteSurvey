import { NextResponse, after } from "next/server"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import crypto from "crypto"

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params

  const endpoint = await db.webhookEndpoint.findUnique({
    where: { secret, isActive: true },
    include: {
      binding: {
        include: {
          entity: true,
          fieldMaps: { include: { canonicalField: true } },
          connection: true,
        },
      },
    },
  })

  if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rawBody = await req.text()

  // Verify Shopify HMAC signature if applicable
  if (endpoint.binding.connection.type === "SHOPIFY") {
    const creds = endpoint.binding.connection.credentials as Record<string, any>
    const webhookSecret = creds?.webhookSecret
    if (webhookSecret) {
      const hmac = req.headers.get("x-shopify-hmac-sha256")
      const computed = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("base64")
      if (hmac !== computed) return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let rawData: Record<string, unknown>
  try {
    rawData = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Map raw data to canonical form using field mappings
  const canonicalData: Record<string, unknown> = {}
  for (const fm of endpoint.binding.fieldMaps) {
    const value = getNestedValue(rawData, fm.externalField)
    canonicalData[fm.canonicalField.name] = value ?? null
  }

  // Extract source record ID from the canonical primary key field
  const pkField = endpoint.binding.fieldMaps.find((fm) => fm.canonicalField.isPrimaryKey)
  const sourceRecordId = pkField ? String(getNestedValue(rawData, pkField.externalField) ?? "") : undefined

  // Store in pipeline
  await db.pipelineRecord.create({
    data: {
      entityId: endpoint.binding.entityId,
      canonicalData: canonicalData as Prisma.InputJsonValue,
      rawData: rawData as Prisma.InputJsonValue,
      sourceSystem: endpoint.binding.connection.name,
      sourceRecordId: sourceRecordId || null,
      status: "PENDING",
    },
  })

  // Update endpoint stats
  await db.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: { lastReceivedAt: new Date(), totalReceived: { increment: 1 } },
  })

  // Trigger processing after response
  after(async () => {
    try {
      await triggerProcessing(endpoint.binding.entityId)
    } catch (err) {
      console.error("Webhook processing error:", err)
    }
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}

// Walk dot-notation paths like "customer.email" through a nested object
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

async function triggerProcessing(entityId: string) {
  const { processingEngine } = await import("@/lib/processing-engine")
  await processingEngine(entityId)
}
