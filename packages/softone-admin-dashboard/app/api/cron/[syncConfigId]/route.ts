// Cron endpoint — call from external cron service or Vercel Cron
// Protected by CRON_SECRET header

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { triggerSyncForConfig } from "@softone/sync"
import { sendJobFailureAlert, sendDLQAlert } from "@/lib/alerts"
import { getActiveSoftoneClient } from "@/lib/active-connection"

const alertCallbacks = {
  onJobFailed: sendJobFailureAlert,
  onDLQCreated: sendDLQAlert,
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ syncConfigId: string }> }
) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { syncConfigId } = await params
  const client = await getActiveSoftoneClient()
  const result = await triggerSyncForConfig(db, syncConfigId, alertCallbacks, client)

  if ("skipped" in result) {
    return NextResponse.json({ message: "Already running, skipped" })
  }

  return NextResponse.json({ jobId: result.jobId })
}
