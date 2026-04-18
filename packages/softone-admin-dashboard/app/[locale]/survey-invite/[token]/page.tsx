// Public page — no authentication required.
// Renders the customer-facing questionnaire for a specific survey section.

import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { SurveyForm } from "./survey-form"
import { SoftwareType, WebCategory, DigitalToolType, IotTech } from "@prisma/client"

const SECTION_LABELS: Record<string, string> = {
  hardware_network: "Hardware & Network",
  software:         "Software",
  web_ecommerce:    "Web & E-commerce",
  compliance:       "Compliance",
  iot_ai:           "IoT & AI",
  voip:             "VoIP Telephony",
}

const SECTION_ENUM: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software:         "SOFTWARE",
  web_ecommerce:    "WEB_ECOMMERCE",
  compliance:       "COMPLIANCE",
  iot_ai:           "IOT_AI",
  voip:             "VOIP",
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function SurveyInvitePage({ params }: PageProps) {
  const { token } = await params

  const invitation = await db.surveyInvitation.findUnique({
    where: { token },
    include: {
      survey: {
        include: { customer: { select: { id: true, name: true } } },
      },
    },
  })

  // ── Expired ──
  if (!invitation) {
    return <ErrorScreen title="Link not found" message="This invitation link is invalid or does not exist." />
  }
  if (invitation.expiresAt < new Date()) {
    return <ErrorScreen title="Link expired" message="This invitation link expired. Please contact your DG Smart representative to request a new one." />
  }
  if (invitation.completedAt) {
    return (
      <SuccessScreen
        sectionLabel={SECTION_LABELS[invitation.sectionKey] ?? invitation.sectionKey}
        surveyName={invitation.survey.name}
      />
    )
  }

  // ── Fetch questions ──
  const sectionEnum = SECTION_ENUM[invitation.sectionKey]
  if (!sectionEnum) notFound()

  const questions = await db.surveyQuestion.findMany({
    where: { section: sectionEnum as never, isActive: true },
    orderBy: { order: "asc" },
  })

  // Resolve options
  const resolved = await Promise.all(
    questions.map(async (q) => {
      let options: { id: string | number; label: string }[] = []
      if (q.optionsSource) {
        options = await resolveOptions(q.optionsSource)
      } else if (Array.isArray(q.options)) {
        options = (q.options as string[]).map(o => ({ id: o, label: o }))
      }
      return { id: q.id, key: q.key, label: q.label, type: q.type as never, order: q.order, options }
    }),
  )

  // Existing answers
  const existingResults = await db.surveyResult.findMany({
    where: { surveyId: invitation.surveyId },
    include: { question: { select: { key: true } } },
  })
  const existingAnswers: Record<string, string | null> = {}
  for (const r of existingResults) {
    existingAnswers[r.question.key] = r.answerValue
  }

  const sectionLabel = SECTION_LABELS[invitation.sectionKey] ?? invitation.sectionKey
  const customerName = invitation.survey.customer.name

  const expiresIn = Math.ceil(
    (invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      {/* Top bar */}
      <div style={{ background: "#1a1d27", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div style={{ background: "#b8020b", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>D</span>
            </div>
            <div>
              <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>DG Smart</p>
              <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>IT Solutions</p>
            </div>
          </div>
          {/* Expiry badge */}
          <span style={{
            background: expiresIn <= 2 ? "#7f1d1d" : "#1a2744",
            color: expiresIn <= 2 ? "#fca5a5" : "#93c5fd",
            border: `1px solid ${expiresIn <= 2 ? "#991b1b" : "#1e3a8a"}`,
            borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700,
          }}>
            {expiresIn <= 0 ? "Expires today" : `Expires in ${expiresIn} day${expiresIn !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* Red accent line */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#b8020b,#ef4444,#b8020b)" }} />

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <p style={{ color: "#b8020b", fontSize: 11, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>
            {sectionLabel} Questionnaire
          </p>
          <h1 style={{ color: "#ffffff", fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 12 }}>
            {invitation.survey.name}
          </h1>
          {customerName && (
            <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 0 }}>
              Please complete the questionnaire below for{" "}
              <strong style={{ color: "#e5e7eb" }}>{customerName}</strong>.
              Your answers help us design the right IT solution for your infrastructure.
            </p>
          )}
        </div>

        {/* Form card */}
        <div style={{ background: "#1a1d27", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "32px" }}>
          {resolved.length === 0 ? (
            <p style={{ color: "#6b7280", textAlign: "center", padding: "48px 0", fontSize: 14 }}>
              No questions have been configured for this section yet.
            </p>
          ) : (
            <SurveyForm
              token={token}
              surveyName={invitation.survey.name}
              customerName={customerName}
              sectionLabel={sectionLabel}
              questions={resolved}
              existingAnswers={existingAnswers}
            />
          )}
        </div>

        {/* Footer note */}
        <p style={{ color: "#374151", fontSize: 12, textAlign: "center", marginTop: 32 }}>
          This questionnaire was sent by DG Smart · Your answers are kept confidential
        </p>
      </div>
    </div>
  )
}

// ─── Error screen ─────────────────────────────────────────────────────────────

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#0f1117" }}>
      <div style={{ background: "#1a1d27", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "48px 40px", maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ background: "#7f1d1d", borderRadius: 12, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <span style={{ color: "#fca5a5", fontSize: 22, fontWeight: 900 }}>!</span>
        </div>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{title}</h1>
        <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 0 }}>{message}</p>
      </div>
    </div>
  )
}

// ─── Already completed screen ─────────────────────────────────────────────────

function SuccessScreen({ sectionLabel, surveyName }: { sectionLabel: string; surveyName: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#0f1117" }}>
      <div style={{ background: "#1a1d27", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "48px 40px", maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ background: "#064e3b", border: "2px solid #065f46", borderRadius: "50%", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <span style={{ color: "#34d399", fontSize: 28, fontWeight: 900 }}>✓</span>
        </div>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Already submitted</h1>
        <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 0 }}>
          The <strong style={{ color: "#e5e7eb" }}>{sectionLabel}</strong> questionnaire for{" "}
          <strong style={{ color: "#e5e7eb" }}>{surveyName}</strong> has already been completed.
          Thank you for your response!
        </p>
      </div>
    </div>
  )
}

// ─── Options resolver (exact copy of questions/route.ts logic) ───────────────

async function resolveOptions(optionsSource: string): Promise<{ id: number | string; label: string }[]> {
  const [model, filter] = optionsSource.split(":")
  try {
    switch (model) {
      case "software_vendor": {
        const rows = await db.softwareVendor.findMany({ orderBy: { name: "asc" } })
        return rows.map(r => ({ id: r.id, label: r.name }))
      }
      case "software_product": {
        const rows = await db.softwareProduct.findMany({
          where: filter ? { type: filter as SoftwareType } : undefined,
          include: { vendor: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
        return rows.map(r => ({ id: r.id, label: `${r.name} (${r.vendor.name})` }))
      }
      case "web_platform": {
        const rows = await db.webPlatform.findMany({
          where: filter ? { category: filter as WebCategory } : undefined,
          orderBy: { name: "asc" },
        })
        return rows.map(r => ({ id: r.id, label: r.name }))
      }
      case "digital_tool": {
        const rows = await db.digitalTool.findMany({
          where: filter ? { type: filter as DigitalToolType } : undefined,
          orderBy: { name: "asc" },
        })
        return rows.map(r => ({ id: r.id, label: r.name }))
      }
      case "brand": {
        const rows = await db.brand.findMany({
          where: filter ? { categories: { array_contains: filter } } : undefined,
          orderBy: { name: "asc" },
        })
        return rows.map(r => ({ id: r.id, label: r.name }))
      }
      case "iot_category": {
        const rows = await db.iotCategory.findMany({ orderBy: { name: "asc" } })
        return rows.map(r => ({ id: r.id, label: r.name }))
      }
      case "iot_product": {
        const rows = await db.iotProduct.findMany({
          where: filter ? { technology: filter as IotTech } : undefined,
          include: { category: { select: { name: true } } },
          orderBy: { modelName: "asc" },
        })
        return rows.map(r => ({
          id: r.id,
          label: r.description ? `${r.modelName} — ${r.description}` : r.modelName,
        }))
      }
      default:
        return []
    }
  } catch {
    return []
  }
}
