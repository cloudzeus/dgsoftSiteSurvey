import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let body: { to: string[]; subject: string; html: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { to, subject, html } = body
  if (!to?.length || !subject?.trim() || !html?.trim()) {
    return NextResponse.json({ error: "to, subject and html are required" }, { status: 400 })
  }

  // Verify the survey exists
  const rows = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM SiteSurvey WHERE id = ${surveyId} LIMIT 1
  `
  if (!rows.length) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  try {
    const result = await sendMail({ to, subject, html })
    return NextResponse.json({ ok: true, id: result.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Mail send failed"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// GET — return users + customer emails for the compose dialog
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
      SELECT name, email, position FROM CustomerContact WHERE customerId = ${customerId} AND email IS NOT NULL AND email != ''
    `,
  ])

  return NextResponse.json({ users, customer: customer[0] ?? null, contacts })
}
