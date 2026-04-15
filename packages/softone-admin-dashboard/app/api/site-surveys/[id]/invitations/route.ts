import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"

const SECTION_LABELS: Record<string, string> = {
  hardware_network: "Hardware & Network",
  software:         "Software",
  web_ecommerce:    "Web & E-commerce",
  compliance:       "Compliance",
  iot_ai:           "IoT & AI",
  voip:             "VoIP Telephony",
}

// ─── POST /api/site-surveys/[id]/invitations ──────────────────────────────────
// Creates a time-limited invitation link and sends it to the given email.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid survey id" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const { email, sectionKey } = body as { email?: string; sectionKey?: string }

  if (!email || !sectionKey) {
    return NextResponse.json({ error: "email and sectionKey are required" }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

  const survey = await db.siteSurvey.findUnique({
    where: { id: surveyId },
    include: {
      customer: { select: { id: true, name: true } },
      surveyor: { select: { id: true, name: true, email: true } },
    },
  })
  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  // Token: 32 random bytes → 64 hex chars
  const token     = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invitation = await db.surveyInvitation.create({
    data: { surveyId, sectionKey, token, email, expiresAt },
  })

  const siteUrl      = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const inviteUrl    = `${siteUrl}/survey-invite/${token}`
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const expiryStr    = expiresAt.toLocaleDateString("el-GR", {
    day: "2-digit", month: "long", year: "numeric",
  })
  const customerName = survey.customer.name ?? `Customer #${survey.customer.id}`
  const surveyorName = survey.surveyor.name ?? survey.surveyor.email
  const domain       = process.env.MAILGUN_DOMAIN ?? "dgsmart.gr"

  const html = buildInvitationEmail({
    surveyName: survey.name,
    sectionLabel,
    customerName,
    surveyorName,
    inviteUrl,
    expiryStr,
    domain,
  })

  await sendMail({
    to: email,
    subject: `Questionnaire Request — ${sectionLabel} | ${survey.name}`,
    html,
    replyTo: survey.surveyor.email,
  })

  return NextResponse.json({ ok: true, invitation: { id: invitation.id, token, expiresAt } })
}

// ─── GET /api/site-surveys/[id]/invitations ───────────────────────────────────
// Lists all invitations for a survey (dashboard use).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid survey id" }, { status: 400 })

  const invitations = await db.surveyInvitation.findMany({
    where: { surveyId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ invitations })
}

// ─── Email template ───────────────────────────────────────────────────────────

function buildInvitationEmail(opts: {
  surveyName: string
  sectionLabel: string
  customerName: string
  surveyorName: string
  inviteUrl: string
  expiryStr: string
  domain: string
}): string {
  const { surveyName, sectionLabel, customerName, surveyorName, inviteUrl, expiryStr, domain } = opts

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Questionnaire Request</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1117;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#1a1d27;border-radius:16px 16px 0 0;padding:32px 40px 28px;border-bottom:1px solid #2a2d3a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Logo mark -->
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#b8020b;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                          <span style="color:#fff;font-size:20px;font-weight:900;line-height:40px;">D</span>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">DG Smart</span><br/>
                          <span style="color:#6b7280;font-size:11px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">IT Solutions</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background:#1e3a5f;color:#60a5fa;border:1px solid #1e40af;border-radius:20px;padding:5px 14px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                      Survey Request
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Red accent bar ── -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#b8020b,#ef4444,#b8020b);"></td>
          </tr>

          <!-- ── Hero ── -->
          <tr>
            <td style="background:#1a1d27;padding:40px 40px 32px;">
              <p style="margin:0 0 8px;color:#b8020b;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                ${sectionLabel} Questionnaire
              </p>
              <h1 style="margin:0 0 12px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">
                We need your input<br/>for our IT assessment
              </h1>
              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.6;">
                As part of our site survey for <strong style="color:#e5e7eb;">${customerName}</strong>, we are gathering
                information about your <strong style="color:#e5e7eb;">${sectionLabel}</strong> infrastructure.
                Please take a few minutes to complete the questionnaire below — your answers will help us
                design the right solution for your needs.
              </p>
            </td>
          </tr>

          <!-- ── Survey info cards ── -->
          <tr>
            <td style="background:#1a1d27;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="48%" style="background:#111318;border:1px solid #2a2d3a;border-radius:12px;padding:16px 20px;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Survey</p>
                    <p style="margin:0;color:#f3f4f6;font-size:13px;font-weight:600;">${surveyName}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#111318;border:1px solid #2a2d3a;border-radius:12px;padding:16px 20px;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Section</p>
                    <p style="margin:0;color:#f3f4f6;font-size:13px;font-weight:600;">${sectionLabel}</p>
                  </td>
                </tr>
                <tr><td colspan="3" style="height:10px;"></td></tr>
                <tr>
                  <td width="48%" style="background:#111318;border:1px solid #2a2d3a;border-radius:12px;padding:16px 20px;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Requested by</p>
                    <p style="margin:0;color:#f3f4f6;font-size:13px;font-weight:600;">${surveyorName}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#92400e;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⏳ Expires on</p>
                    <p style="margin:0;color:#78350f;font-size:13px;font-weight:700;">${expiryStr}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── What to expect section ── -->
          <tr>
            <td style="background:#1a1d27;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111318;border:1px solid #2a2d3a;border-radius:12px;padding:20px 24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;color:#e5e7eb;font-size:13px;font-weight:700;">What to expect</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;line-height:1.5;">
                          <span style="color:#b8020b;font-weight:700;margin-right:8px;">→</span>
                          A short questionnaire about your <strong style="color:#d1d5db;">${sectionLabel}</strong> setup
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;line-height:1.5;">
                          <span style="color:#b8020b;font-weight:700;margin-right:8px;">→</span>
                          No login required — the link gives you direct access
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;line-height:1.5;">
                          <span style="color:#b8020b;font-weight:700;margin-right:8px;">→</span>
                          Your answers are saved automatically as you go
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;line-height:1.5;">
                          <span style="color:#b8020b;font-weight:700;margin-right:8px;">→</span>
                          Takes approximately 5–10 minutes to complete
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CTA button ── -->
          <tr>
            <td style="background:#1a1d27;padding:0 40px 40px;text-align:center;">
              <a href="${inviteUrl}"
                 style="display:inline-block;background:#b8020b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(184,2,11,0.4);">
                Start the questionnaire &nbsp;→
              </a>
              <p style="margin:16px 0 0;color:#4b5563;font-size:11px;">
                Or copy this link into your browser:<br/>
                <a href="${inviteUrl}" style="color:#6b7280;word-break:break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="background:#1a1d27;padding:0 40px;">
              <hr style="border:none;border-top:1px solid #2a2d3a;margin:0;" />
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#13151e;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;color:#374151;font-size:11px;">
                This request was sent by DG Smart on behalf of your account manager.
              </p>
              <p style="margin:0;color:#374151;font-size:11px;">
                If you did not expect this email, you can safely ignore it.
                &nbsp;·&nbsp;
                <a href="mailto:platform@${domain}?subject=unsubscribe" style="color:#374151;">Unsubscribe</a>
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
