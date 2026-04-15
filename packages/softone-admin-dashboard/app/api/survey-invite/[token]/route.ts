// Public API — no authentication required.
// GET  /api/survey-invite/[token]  → survey metadata + questions for that section
// POST /api/survey-invite/[token]  → submit answers, mark invitation completed, notify owner

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"
import { SoftwareType, WebCategory, DigitalToolType, IotTech } from "@prisma/client"

const SECTION_LABELS: Record<string, string> = {
  hardware_network: "Hardware & Network",
  software:         "Software",
  web_ecommerce:    "Web & E-commerce",
  compliance:       "Compliance",
  iot_ai:           "IoT & AI",
  voip:             "VoIP Telephony",
}

// Maps lowercase UI key → Prisma SurveySection enum value
const SECTION_ENUM: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software:         "SOFTWARE",
  web_ecommerce:    "WEB_ECOMMERCE",
  compliance:       "COMPLIANCE",
  iot_ai:           "IOT_AI",
  voip:             "VOIP",
}

async function resolveInvitation(token: string) {
  const invitation = await db.surveyInvitation.findUnique({
    where: { token },
    include: {
      survey: {
        include: {
          customer: { select: { id: true, name: true } },
          surveyor: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })
  return invitation
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const invitation = await resolveInvitation(token)

  if (!invitation) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 })
  }
  if (invitation.completedAt) {
    return NextResponse.json({ error: "This questionnaire has already been completed" }, { status: 409 })
  }

  const sectionEnum = SECTION_ENUM[invitation.sectionKey]
  if (!sectionEnum) {
    return NextResponse.json({ error: "Unknown section" }, { status: 400 })
  }

  // Fetch active questions for this section
  const questions = await db.surveyQuestion.findMany({
    where: { section: sectionEnum as never, isActive: true },
    orderBy: { order: "asc" },
  })

  // Resolve options for each question
  const resolved = await Promise.all(
    questions.map(async (q) => {
      let options: { id: string | number; label: string }[] = []

      if (q.optionsSource) {
        try {
          options = await resolveOptions(q.optionsSource)
        } catch {
          options = []
        }
      } else if (Array.isArray(q.options)) {
        options = (q.options as string[]).map((o) => ({ id: o, label: o }))
      }

      return {
        id: q.id,
        key: q.key,
        label: q.label,
        type: q.type,
        order: q.order,
        options,
      }
    }),
  )

  // Fetch existing answers so the form can be pre-filled if revisited
  const existingResults = await db.surveyResult.findMany({
    where: { surveyId: invitation.surveyId },
    include: { question: { select: { key: true } } },
  })
  const byKey: Record<string, string | null> = {}
  for (const r of existingResults) {
    byKey[r.question.key] = r.answerValue
  }

  return NextResponse.json({
    invitation: {
      id:         invitation.id,
      sectionKey: invitation.sectionKey,
      expiresAt:  invitation.expiresAt,
    },
    survey: {
      id:   invitation.survey.id,
      name: invitation.survey.name,
    },
    customer: {
      name: invitation.survey.customer.name,
    },
    sectionLabel: SECTION_LABELS[invitation.sectionKey] ?? invitation.sectionKey,
    questions: resolved,
    existingAnswers: byKey,
  })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const invitation = await resolveInvitation(token)

  if (!invitation) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 })
  }
  if (invitation.completedAt) {
    return NextResponse.json({ error: "Already completed" }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const { answers } = body as { answers?: Record<string, string> }

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "answers object is required" }, { status: 400 })
  }

  // Upsert each answer into SurveyResult
  const sectionEnum = SECTION_ENUM[invitation.sectionKey] as never
  const questions = await db.surveyQuestion.findMany({
    where: { section: sectionEnum, isActive: true },
    select: { id: true, key: true },
  })

  const validQuestions = questions.filter((q) => answers[q.key] !== undefined)

  const upserts = validQuestions.map((q) =>
    db.surveyResult.upsert({
      where: { surveyId_questionId: { surveyId: invitation.surveyId, questionId: q.id } },
      create: { surveyId: invitation.surveyId, questionId: q.id, answerValue: answers[q.key] },
      update: { answerValue: answers[q.key] },
    }),
  )

  const historyInserts = validQuestions.map((q) =>
    db.surveyResultHistory.create({
      data: {
        surveyId:     invitation.surveyId,
        questionId:   q.id,
        answerValue:  answers[q.key],
        changedBy:    invitation.email,
        changedByType: "CUSTOMER",
        invitationId: invitation.id,
      },
    }),
  )

  await db.$transaction([...upserts, ...historyInserts])

  // Mark invitation as completed
  await db.surveyInvitation.update({
    where: { id: invitation.id },
    data: { completedAt: new Date() },
  })

  // Count answered questions for the notification
  const answeredCount = Object.values(answers).filter(
    (v) => v !== "" && v !== "[]" && v !== null && v !== undefined,
  ).length

  // Send completion notification to the surveyor
  const { survey } = invitation
  const sectionLabel = SECTION_LABELS[invitation.sectionKey] ?? invitation.sectionKey
  const domain       = process.env.MAILGUN_DOMAIN ?? "dgsmart.gr"
  const siteUrl      = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const dashboardUrl = `${siteUrl}/site-survey`

  const html = buildCompletionEmail({
    surveyName:    survey.name,
    sectionLabel,
    customerName:  survey.customer.name ?? `Customer #${survey.customer.id}`,
    submitterEmail: invitation.email,
    answeredCount,
    totalCount:    questions.length,
    completedAt:   new Date(),
    dashboardUrl,
    domain,
  })

  await sendMail({
    to: survey.surveyor.email,
    subject: `✓ Survey completed — ${sectionLabel} | ${survey.name}`,
    html,
  }).catch(() => {
    // Don't fail the request if notification email fails
  })

  return NextResponse.json({ ok: true })
}

// ─── Options resolver (exact copy of questions/route.ts logic) ───────────────

async function resolveOptions(
  source: string,
): Promise<{ id: number | string; label: string }[]> {
  const [model, filter] = source.split(":")
  switch (model) {
    case "software_vendor": {
      const rows = await db.softwareVendor.findMany({ orderBy: { name: "asc" } })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }
    case "software_product": {
      const rows = await db.softwareProduct.findMany({
        where: filter ? { type: filter as SoftwareType } : undefined,
        include: { vendor: { select: { name: true } } },
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: `${r.name} (${r.vendor.name})` }))
    }
    case "web_platform": {
      const rows = await db.webPlatform.findMany({
        where: filter ? { category: filter as WebCategory } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }
    case "digital_tool": {
      const rows = await db.digitalTool.findMany({
        where: filter ? { type: filter as DigitalToolType } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }
    case "brand": {
      const rows = await db.brand.findMany({
        where: filter ? { categories: { array_contains: filter } } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }
    case "iot_category": {
      const rows = await db.iotCategory.findMany({ orderBy: { name: "asc" } })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }
    case "iot_product": {
      const rows = await db.iotProduct.findMany({
        where: filter ? { technology: filter as IotTech } : undefined,
        include: { category: { select: { name: true } } },
        orderBy: { modelName: "asc" },
      })
      return rows.map((r) => ({
        id: r.id,
        label: r.description ? `${r.modelName} — ${r.description}` : r.modelName,
      }))
    }
    default:
      return []
  }
}

// ─── Completion notification email ────────────────────────────────────────────

function buildCompletionEmail(opts: {
  surveyName: string
  sectionLabel: string
  customerName: string
  submitterEmail: string
  answeredCount: number
  totalCount: number
  completedAt: Date
  dashboardUrl: string
  domain: string
}): string {
  const {
    surveyName, sectionLabel, customerName, submitterEmail,
    answeredCount, totalCount, completedAt, dashboardUrl, domain,
  } = opts

  const pct    = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0
  const timeStr = completedAt.toLocaleString("el-GR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Survey Completed</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

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
                    <span style="display:inline-block;background:#064e3b;color:#34d399;border:1px solid #065f46;border-radius:20px;padding:5px 14px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                      ✓ Completed
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Green accent bar ── -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#059669,#34d399,#059669);"></td>
          </tr>

          <!-- ── Hero ── -->
          <tr>
            <td style="background:#1a1d27;padding:40px 40px 32px;">
              <p style="margin:0 0 8px;color:#059669;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                Questionnaire Completed
              </p>
              <h1 style="margin:0 0 12px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">
                A customer has filled<br/>in the ${sectionLabel} survey
              </h1>
              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.6;">
                The questionnaire for <strong style="color:#e5e7eb;">${customerName}</strong> has been
                submitted. You can now review the answers in the platform and proceed with your assessment.
              </p>
            </td>
          </tr>

          <!-- ── Details cards ── -->
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
                    <p style="margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Submitted by</p>
                    <p style="margin:0;color:#f3f4f6;font-size:13px;font-weight:600;">${submitterEmail}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#111318;border:1px solid #2a2d3a;border-radius:12px;padding:16px 20px;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Completed at</p>
                    <p style="margin:0;color:#f3f4f6;font-size:13px;font-weight:600;">${timeStr}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Progress bar ── -->
          <tr>
            <td style="background:#1a1d27;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111318;border:1px solid #2a2d3a;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Completion rate</p>
                          <p style="margin:0 0 10px;color:#f3f4f6;font-size:13px;font-weight:700;">${answeredCount} of ${totalCount} questions answered (${pct}%)</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <!-- Progress bar -->
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1f2937;border-radius:99px;overflow:hidden;height:8px;">
                            <tr>
                              <td width="${pct}%" style="background:linear-gradient(90deg,#059669,#34d399);height:8px;border-radius:99px;"></td>
                              <td></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CTA ── -->
          <tr>
            <td style="background:#1a1d27;padding:0 40px 40px;text-align:center;">
              <a href="${dashboardUrl}"
                 style="display:inline-block;background:#b8020b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(184,2,11,0.4);">
                View answers in platform &nbsp;→
              </a>
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
              <p style="margin:0;color:#374151;font-size:11px;">
                DG Smart Platform · Automated notification
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
