/**
 * Proposal email notifications.
 * Called from the proposals API route on create or status change.
 */
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProposalEvent =
  | { type: "created"; proposalTitle: string }
  | { type: "status_changed"; proposalTitle: string; oldStatus: string; newStatus: string }

const STATUS_LABEL: Record<string, string> = {
  DRAFT:    "Draft",
  SENT:     "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    "#64748b",
  SENT:     "#0ea5e9",
  ACCEPTED: "#10b981",
  REJECTED: "#ef4444",
}

// ─── HTML email template ──────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  surveyName: string
  customerName: string
  proposalTitle: string
  event: ProposalEvent
  assigneeName: string
  surveyDate: string
  appUrl: string
}): string {
  const { surveyName, customerName, proposalTitle, event, assigneeName, surveyDate, appUrl } = opts

  const isNew = event.type === "created"
  const eventBadgeColor = isNew ? "#10b981" : STATUS_COLOR[event.type === "status_changed" ? event.newStatus : "DRAFT"]
  const eventBadgeText  = isNew ? "NEW PROPOSAL" : "STATUS UPDATE"

  const headlineHtml = isNew
    ? `A new proposal has been created for the site survey <strong>${surveyName}</strong>.`
    : `The proposal status for <strong>${surveyName}</strong> has been updated.`

  const changeBlockHtml = isNew
    ? `
      <tr>
        <td style="padding:0 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Proposal</p>
                <p style="margin:0;font-size:17px;font-weight:600;color:#1e293b;">${proposalTitle}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : (() => {
        const sc = event as Extract<ProposalEvent, { type: "status_changed" }>
        return `
      <tr>
        <td style="padding:0 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Proposal</p>
                <p style="margin:0 0 20px;font-size:17px;font-weight:600;color:#1e293b;">${proposalTitle}</p>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <span style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:600;background:${STATUS_COLOR[sc.oldStatus]}18;color:${STATUS_COLOR[sc.oldStatus]};border:1px solid ${STATUS_COLOR[sc.oldStatus]}40;">
                        ${STATUS_LABEL[sc.oldStatus] ?? sc.oldStatus}
                      </span>
                    </td>
                    <td style="padding:0 14px;vertical-align:middle;">
                      <span style="font-size:18px;color:#94a3b8;">→</span>
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;background:${STATUS_COLOR[sc.newStatus]}18;color:${STATUS_COLOR[sc.newStatus]};border:1px solid ${STATUS_COLOR[sc.newStatus]}40;">
                        ${STATUS_LABEL[sc.newStatus] ?? sc.newStatus}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
      })()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isNew ? "New Proposal" : "Proposal Update"} — ${surveyName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#1e293b;border-radius:16px 16px 0 0;padding:32px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Logo mark -->
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#b8020b;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                          <span style="font-size:20px;font-weight:800;color:#ffffff;line-height:40px;display:block;">D</span>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">DG Smart</span>
                          <br />
                          <span style="font-size:11px;color:#94a3b8;letter-spacing:0.05em;">Site Survey Platform</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.1em;background:${eventBadgeColor}30;color:${eventBadgeColor};border:1px solid ${eventBadgeColor}50;">
                      ${eventBadgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Red accent bar ── -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#b8020b 0%,#ef4444 100%);"></td>
          </tr>

          <!-- ── Card body ── -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 16px 16px;padding:0 0 8px;">

              <!-- Hero -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 40px 28px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#b8020b;">
                      ${customerName}
                    </p>
                    <h1 style="margin:0 0 14px;font-size:26px;font-weight:800;color:#1e293b;line-height:1.2;letter-spacing:-0.5px;">
                      ${surveyName}
                    </h1>
                    <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">
                      Hi <strong>${assigneeName}</strong>, ${headlineHtml}
                    </p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 40px 28px;">
                    <div style="height:1px;background:#e2e8f0;"></div>
                  </td>
                </tr>

                <!-- Change block -->
                ${changeBlockHtml}

                <!-- Meta row -->
                <tr>
                  <td style="padding:0 40px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:50%;padding-right:8px;">
                          <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;">
                            <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Survey Date</p>
                            <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${surveyDate}</p>
                          </div>
                        </td>
                        <td style="width:50%;padding-left:8px;">
                          <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;">
                            <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Customer</p>
                            <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${customerName}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${isNew ? `
                <!-- Attachment notice -->
                <tr>
                  <td style="padding:0 40px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef9f0;border-radius:12px;border:1px solid #fde68a;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="vertical-align:middle;padding-right:12px;">
                                <div style="width:36px;height:36px;background:#f59e0b20;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">📎</div>
                              </td>
                              <td style="vertical-align:middle;">
                                <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#92400e;">Proposal Document Attached</p>
                                <p style="margin:0;font-size:12px;color:#b45309;">The full proposal has been attached to this email as a Word document.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ""}

                <!-- CTA button -->
                <tr>
                  <td style="padding:0 40px 40px;text-align:center;">
                    <a href="${appUrl}/site-survey" style="display:inline-block;padding:14px 36px;background:#b8020b;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.02em;">
                      View in Platform →
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:24px 0 8px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
                DG Smart · Site Survey Platform
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                You are receiving this because you are assigned to this proposal.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}

// ─── Main notify function ─────────────────────────────────────────────────────

export async function notifyProposalAssignees(opts: {
  surveyId: number
  proposalId: number
  event: ProposalEvent
}) {
  const { surveyId, proposalId, event } = opts

  try {
    // 1. Get assignee emails
    const assignees = await db.$queryRaw<{ name: string | null; email: string }[]>`
      SELECT u.name, u.email
      FROM ProposalAssignee pa
      JOIN User u ON u.id = pa.userId
      WHERE pa.proposalId = ${proposalId}
        AND u.email IS NOT NULL AND u.email != ''
    `
    if (!assignees.length) return

    // 2. Get survey + customer info
    const surveys = await db.$queryRaw<{ name: string; date: Date; customerName: string | null }[]>`
      SELECT s.name, s.date, c.name AS customerName
      FROM SiteSurvey s
      JOIN Customer c ON c.id = s.customerId
      WHERE s.id = ${surveyId}
      LIMIT 1
    `
    if (!surveys.length) return
    const survey = surveys[0]

    const surveyDate = new Date(survey.date).toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric",
    })

    const appUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")

    // 3. Fetch the DOCX attachment (only on new proposal creation)
    let attachment: { filename: string; data: Buffer; contentType: string } | undefined
    if (event.type === "created") {
      try {
        const exportRes = await fetch(`${appUrl}/api/site-surveys/${surveyId}/proposals/export`, {
          headers: { Cookie: "" }, // internal call — no user cookie needed, route has no auth guard
        })
        if (exportRes.ok) {
          const buf = await exportRes.arrayBuffer()
          const disp = exportRes.headers.get("Content-Disposition") ?? ""
          const filename = disp.match(/filename="([^"]+)"/)?.[1] ?? "proposal.docx"
          attachment = {
            filename,
            data: Buffer.from(buf),
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }
        }
      } catch (e) {
        // Non-fatal — send email without attachment
        console.warn("[proposal-notify] DOCX fetch failed:", e)
      }
    }

    // 4. Send one email per assignee (personalised greeting)
    const isNew = event.type === "created"
    const subject = isNew
      ? `New Proposal: ${survey.name}`
      : `Proposal Update: ${survey.name} — ${STATUS_LABEL[(event as Extract<ProposalEvent, { type: "status_changed" }>).newStatus] ?? ""}`

    await Promise.allSettled(
      assignees.map(async (assignee) => {
        const html = buildEmailHtml({
          surveyName:    survey.name,
          customerName:  survey.customerName ?? "—",
          proposalTitle: event.proposalTitle,
          event,
          assigneeName:  assignee.name ?? assignee.email,
          surveyDate,
          appUrl,
        })

        await sendMail({
          to:          assignee.email,
          subject,
          html,
          from:        `DG Smart <noreply@${process.env.MAILGUN_DOMAIN}>`,
          attachments: attachment ? [attachment] : undefined,
        })
      })
    )
  } catch (e) {
    // Non-fatal — log but don't break the API response
    console.error("[proposal-notify] Failed to send notifications:", e)
  }
}
