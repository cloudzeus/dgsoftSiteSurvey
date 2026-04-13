// Alert emails sent via Mailgun when sync jobs fail or DLQ items are added
// Recipients default to TEAMS_BOOKING_EMAILS env var

import { sendMail } from "./mail"

const DEFAULT_RECIPIENT =
  process.env.TEAMS_BOOKING_EMAILS ?? process.env.MAILGUN_DOMAIN

function recipient(): string {
  const r = DEFAULT_RECIPIENT
  if (!r) throw new Error("No alert recipient configured (TEAMS_BOOKING_EMAILS)")
  return r
}

// ─── Job failure alert ────────────────────────────────────────────────────────

export async function sendJobFailureAlert(opts: {
  jobId: string
  syncConfigId: string
  objectName: string
  tableName: string
  operation: string
  retryCount: number
  maxRetries: number
  errorMessage: string
}): Promise<void> {
  const isFinal = opts.retryCount >= opts.maxRetries
  const subject = isFinal
    ? `[SOFTONE] Job FAILED permanently — ${opts.objectName}/${opts.tableName}`
    : `[SOFTONE] Job failed (retry ${opts.retryCount}/${opts.maxRetries}) — ${opts.objectName}/${opts.tableName}`

  await sendMail({
    to: recipient(),
    subject,
    html: `
      <div style="font-family:sans-serif;font-size:13px;color:#1a1a1a;max-width:600px">
        <h2 style="font-size:16px;margin-bottom:4px">
          Sync Job ${isFinal ? "Failed Permanently" : "Failed"}
        </h2>
        <p style="color:#666;font-size:12px;margin-top:0">
          ${new Date().toISOString()}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600;width:140px">Object</td><td style="padding:4px 8px">${opts.objectName}</td></tr>
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600">Table</td><td style="padding:4px 8px">${opts.tableName}</td></tr>
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600">Operation</td><td style="padding:4px 8px">${opts.operation}</td></tr>
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600">Retries</td><td style="padding:4px 8px">${opts.retryCount} / ${opts.maxRetries}</td></tr>
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600">Job ID</td><td style="padding:4px 8px;font-family:monospace">${opts.jobId}</td></tr>
          <tr>
            <td style="padding:4px 8px;background:#f5f5f5;font-weight:600;vertical-align:top">Error</td>
            <td style="padding:4px 8px;color:#c0392b;font-family:monospace;word-break:break-all">${opts.errorMessage}</td>
          </tr>
        </table>
        ${
          isFinal
            ? `<div style="margin-top:16px;padding:10px 14px;background:#fff3cd;border-left:4px solid #f0ad4e;border-radius:4px;font-size:12px">
                <strong>This job has moved to the Dead Letter Queue</strong> and requires manual review.
               </div>`
            : `<p style="font-size:12px;color:#666;margin-top:12px">The job will be retried automatically on the next cron trigger.</p>`
        }
      </div>
    `,
  })
}

// ─── DLQ alert ────────────────────────────────────────────────────────────────

export async function sendDLQAlert(opts: {
  dlqId: string
  originalJobId: string
  syncConfigId: string
  operation: string
  severity: string
  errorReason: string
}): Promise<void> {
  await sendMail({
    to: recipient(),
    subject: `[SOFTONE] Dead Letter Queue — ${opts.severity} — ${opts.operation}`,
    html: `
      <div style="font-family:sans-serif;font-size:13px;color:#1a1a1a;max-width:600px">
        <h2 style="font-size:16px;margin-bottom:4px;color:#c0392b">
          Dead Letter Queue Item — ${opts.severity}
        </h2>
        <p style="color:#666;font-size:12px;margin-top:0">${new Date().toISOString()}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600;width:140px">DLQ ID</td><td style="padding:4px 8px;font-family:monospace">${opts.dlqId}</td></tr>
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600">Original Job</td><td style="padding:4px 8px;font-family:monospace">${opts.originalJobId}</td></tr>
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600">Operation</td><td style="padding:4px 8px">${opts.operation}</td></tr>
          <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:600">Severity</td><td style="padding:4px 8px;color:#c0392b;font-weight:700">${opts.severity}</td></tr>
          <tr>
            <td style="padding:4px 8px;background:#f5f5f5;font-weight:600;vertical-align:top">Reason</td>
            <td style="padding:4px 8px;font-family:monospace;word-break:break-all">${opts.errorReason}</td>
          </tr>
        </table>
        <div style="margin-top:16px;padding:10px 14px;background:#fdecea;border-left:4px solid #c0392b;border-radius:4px;font-size:12px">
          <strong>Action required:</strong> Log into the Softone Sync dashboard and review the Dead Letter Queue.
        </div>
      </div>
    `,
  })
}

// ─── Daily summary ────────────────────────────────────────────────────────────

export async function sendDailySummary(opts: {
  totalJobs: number
  successful: number
  failed: number
  dlqCount: number
  recordsProcessed: number
}): Promise<void> {
  const successRate =
    opts.totalJobs > 0
      ? Math.round((opts.successful / opts.totalJobs) * 100)
      : 100

  await sendMail({
    to: recipient(),
    subject: `[SOFTONE] Daily Sync Summary — ${successRate}% success`,
    html: `
      <div style="font-family:sans-serif;font-size:13px;color:#1a1a1a;max-width:600px">
        <h2 style="font-size:16px;margin-bottom:4px">Daily Sync Summary</h2>
        <p style="color:#666;font-size:12px;margin-top:0">${new Date().toISOString().slice(0, 10)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 8px;background:#f5f5f5;font-weight:600;width:160px">Total jobs run</td><td style="padding:6px 8px">${opts.totalJobs}</td></tr>
          <tr><td style="padding:6px 8px;background:#f5f5f5;font-weight:600;color:#27ae60">Successful</td><td style="padding:6px 8px;color:#27ae60;font-weight:600">${opts.successful}</td></tr>
          <tr><td style="padding:6px 8px;background:#f5f5f5;font-weight:600;color:#c0392b">Failed</td><td style="padding:6px 8px;color:#c0392b;font-weight:600">${opts.failed}</td></tr>
          <tr><td style="padding:6px 8px;background:#f5f5f5;font-weight:600">DLQ items</td><td style="padding:6px 8px">${opts.dlqCount}</td></tr>
          <tr><td style="padding:6px 8px;background:#f5f5f5;font-weight:600">Records processed</td><td style="padding:6px 8px">${opts.recordsProcessed.toLocaleString()}</td></tr>
        </table>
        <div style="margin-top:16px;padding:10px 14px;background:${successRate >= 95 ? "#d4edda" : "#fff3cd"};border-left:4px solid ${successRate >= 95 ? "#28a745" : "#f0ad4e"};border-radius:4px;font-size:12px">
          <strong>Success rate: ${successRate}%</strong>
          ${successRate < 95 ? " — some jobs need attention." : " — all good."}
        </div>
      </div>
    `,
  })
}
