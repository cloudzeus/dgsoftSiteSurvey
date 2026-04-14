import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"

type Params = { params: Promise<{ id: string }> }

// ─── Email template ───────────────────────────────────────────────────────────

function buildSurveyMailHtml(opts: {
  surveyName: string
  customerName: string
  surveyDate: string
  status: string
  subject: string
  messageHtml: string
  withAttachment: boolean
  appUrl: string
}): string {
  const { surveyName, customerName, surveyDate, status, subject, messageHtml, withAttachment, appUrl } = opts

  const STATUS_COLOR: Record<string, string> = {
    DRAFT: "#64748b", SCHEDULED: "#f59e0b", IN_PROGRESS: "#3b82f6",
    COMPLETED: "#10b981", CANCELLED: "#ef4444",
  }
  const STATUS_LABEL: Record<string, string> = {
    DRAFT: "Draft", SCHEDULED: "Scheduled", IN_PROGRESS: "In Progress",
    COMPLETED: "Completed", CANCELLED: "Cancelled",
  }
  const statusColor = STATUS_COLOR[status] ?? "#64748b"
  const statusLabel = STATUS_LABEL[status] ?? status

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;border-radius:16px 16px 0 0;padding:32px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#b8020b;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                          <span style="font-size:20px;font-weight:800;color:#ffffff;line-height:40px;display:block;">D</span>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">DG Smart</span><br />
                          <span style="font-size:11px;color:#94a3b8;letter-spacing:0.05em;">Site Survey Platform</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.1em;background:${statusColor}30;color:${statusColor};border:1px solid ${statusColor}50;">
                      ${statusLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Red accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#b8020b 0%,#ef4444 100%);"></td>
          </tr>

          <!-- Card body -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 16px 16px;padding:0 0 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Hero -->
                <tr>
                  <td style="padding:36px 40px 24px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#b8020b;">
                      ${customerName}
                    </p>
                    <h1 style="margin:0 0 0;font-size:24px;font-weight:800;color:#1e293b;line-height:1.2;letter-spacing:-0.5px;">
                      ${surveyName}
                    </h1>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 40px 24px;">
                    <div style="height:1px;background:#e2e8f0;"></div>
                  </td>
                </tr>

                <!-- Message body -->
                <tr>
                  <td style="padding:0 40px 28px;">
                    <div style="font-size:15px;color:#334155;line-height:1.7;">
                      ${messageHtml}
                    </div>
                  </td>
                </tr>

                <!-- Meta cards -->
                <tr>
                  <td style="padding:0 40px 28px;">
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

                ${withAttachment ? `
                <!-- Attachment notice -->
                <tr>
                  <td style="padding:0 40px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef9f0;border-radius:12px;border:1px solid #fde68a;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="vertical-align:middle;padding-right:12px;">
                                <div style="width:36px;height:36px;background:#f59e0b20;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">📎</div>
                              </td>
                              <td style="vertical-align:middle;">
                                <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#92400e;">Survey Document Attached</p>
                                <p style="margin:0;font-size:12px;color:#b45309;">The full site survey has been attached to this email as a Word document.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ""}

                <!-- CTA -->
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

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">DG Smart · Site Survey Platform</p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">This email was sent via the DG Smart platform.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}

// ─── POST: send email ─────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let body: { to: string[]; subject: string; message: string; attachSurvey?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { to, subject, message, attachSurvey } = body
  if (!to?.length || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "to, subject and message are required" }, { status: 400 })
  }

  // Fetch survey + customer info for the email template
  const surveys = await db.$queryRaw<{ id: number; name: string; date: Date; status: string; customerName: string | null }[]>`
    SELECT s.id, s.name, s.date, s.status, c.name AS customerName
    FROM SiteSurvey s
    JOIN Customer c ON c.id = s.customerId
    WHERE s.id = ${surveyId}
    LIMIT 1
  `
  if (!surveys.length) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  const survey = surveys[0]
  const surveyDate = new Date(survey.date).toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  })
  const appUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")

  // Optionally fetch and attach the survey DOCX
  let attachment: { filename: string; data: Buffer; contentType: string } | undefined
  if (attachSurvey) {
    try {
      const exportRes = await fetch(`${appUrl}/api/site-surveys/${surveyId}/export`)
      if (exportRes.ok) {
        const buf = await exportRes.arrayBuffer()
        const disp = exportRes.headers.get("Content-Disposition") ?? ""
        const filename = disp.match(/filename="([^"]+)"/)?.[1] ?? `survey-${surveyId}.docx`
        attachment = {
          filename,
          data: Buffer.from(buf),
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
      }
    } catch (e) {
      console.warn("[send-email] survey export fetch failed:", e)
    }
  }

  const messageHtml = message.trim().replace(/\n/g, "<br>")

  const html = buildSurveyMailHtml({
    surveyName:    survey.name,
    customerName:  survey.customerName ?? "—",
    surveyDate,
    status:        survey.status,
    subject:       subject.trim(),
    messageHtml,
    withAttachment: !!attachment,
    appUrl,
  })

  try {
    const result = await sendMail({
      to,
      subject: subject.trim(),
      html,
      from: `DG Smart <noreply@${process.env.MAILGUN_DOMAIN}>`,
      attachments: attachment ? [attachment] : undefined,
    })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Mail send failed"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// ─── GET: load recipient options ──────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const surveys = await db.$queryRaw<{ customerId: number }[]>`
    SELECT customerId FROM SiteSurvey WHERE id = ${surveyId} LIMIT 1
  `
  if (!surveys.length) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  const { customerId } = surveys[0]

  const [users, customer, contacts] = await Promise.all([
    db.$queryRaw<{ id: string; name: string | null; email: string }[]>`
      SELECT id, name, email FROM User ORDER BY name ASC
    `,
    db.$queryRaw<{ email: string | null; emailacc: string | null; name: string | null }[]>`
      SELECT email, emailacc, name FROM Customer WHERE id = ${customerId} LIMIT 1
    `,
    db.$queryRaw<{ name: string | null; email: string | null; position: string | null }[]>`
      SELECT name, email, position FROM CustomerContact
      WHERE customerId = ${customerId} AND email IS NOT NULL AND email != ''
    `,
  ])

  return NextResponse.json({ users, customer: customer[0] ?? null, contacts })
}
