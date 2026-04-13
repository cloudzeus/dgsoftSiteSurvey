// Adaptive rate limiter backed by Prisma RateLimitTracker
// Throttles Softone API calls when limits are hit

import { PrismaClient } from "@prisma/client"
import type { RateLimitConfig } from "./types"

const DEFAULT_CONFIG: RateLimitConfig = {
  maxPerMinute: 60,
  maxPerHour: 1000,
  backoffMs: 5 * 60 * 1000, // 5 min
}

export async function checkRateLimit(
  prisma: PrismaClient,
  connectionId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<void> {
  const now = new Date()

  let tracker = await prisma.rateLimitTracker.findUnique({
    where: { connectionId },
  })

  if (!tracker) {
    tracker = await prisma.rateLimitTracker.create({
      data: { connectionId },
    })
  }

  // Throttled — check expiry
  if (tracker.isThrottled && tracker.throttleUntil) {
    if (tracker.throttleUntil > now) {
      const waitSec = Math.ceil(
        (tracker.throttleUntil.getTime() - now.getTime()) / 1000
      )
      throw new Error(
        `Rate limit active for ${connectionId}. Retry in ${waitSec}s.`
      )
    }
    // Throttle expired — reset
    await prisma.rateLimitTracker.update({
      where: { connectionId },
      data: { isThrottled: false, throttleUntil: null },
    })
  }

  // Reset per-minute counter
  const minuteAgo = new Date(now.getTime() - 60_000)
  const hourAgo = new Date(now.getTime() - 3_600_000)

  const resetData: Record<string, unknown> = {
    requestsThisMinute: { increment: 1 },
    requestsThisHour: { increment: 1 },
  }

  if (tracker.lastResetMinute < minuteAgo) {
    resetData.requestsThisMinute = 1
    resetData.lastResetMinute = now
  }
  if (tracker.lastResetHour < hourAgo) {
    resetData.requestsThisHour = 1
    resetData.lastResetHour = now
  }

  const updated = await prisma.rateLimitTracker.update({
    where: { connectionId },
    data: resetData as Parameters<typeof prisma.rateLimitTracker.update>[0]["data"],
  })

  if (
    updated.requestsThisMinute > config.maxPerMinute ||
    updated.requestsThisHour > config.maxPerHour
  ) {
    await handleThrottle(prisma, connectionId, config.backoffMs)
    throw new Error(
      `Rate limit exceeded for ${connectionId}. Backing off ${config.backoffMs / 1000}s.`
    )
  }
}

export async function handleThrottle(
  prisma: PrismaClient,
  connectionId: string,
  backoffMs: number = DEFAULT_CONFIG.backoffMs
): Promise<void> {
  await prisma.rateLimitTracker.update({
    where: { connectionId },
    data: {
      isThrottled: true,
      throttleUntil: new Date(Date.now() + backoffMs),
    },
  })
}
