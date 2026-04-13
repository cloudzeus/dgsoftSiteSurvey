"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import { processJob } from "@softone/sync"
import { sendJobFailureAlert, sendDLQAlert } from "@/lib/alerts"
import { getActiveSoftoneClient } from "@/lib/active-connection"

const alertCallbacks = {
  onJobFailed: sendJobFailureAlert,
  onDLQCreated: sendDLQAlert,
}

export async function retryJob(jobId: string) {
  await requireResourceAction("jobs", "edit")

  // Reset to PENDING so the processor picks it up cleanly
  await db.syncJob.update({
    where: { id: jobId },
    data: { status: "PENDING", retryCount: 0, errorMessage: null, errorStack: null },
  })

  const client = await getActiveSoftoneClient()
  await processJob(db, jobId, alertCallbacks, client)

  revalidatePath("/jobs")
}
