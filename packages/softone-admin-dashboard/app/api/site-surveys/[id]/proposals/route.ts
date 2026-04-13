import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

interface ProposalRow {
  id: number
  surveyId: number
  title: string
  description: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

interface AssigneeRow { userId: string }
interface ResponseRow { requirementId: number; response: string | null }

const VALID_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"]

// ─── GET: fetch proposal for this survey ──────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const rows = await db.$queryRaw<ProposalRow[]>`
      SELECT id, surveyId, title, description, status, createdAt, updatedAt
      FROM SurveyProposal WHERE surveyId = ${surveyId} LIMIT 1
    `
    if (!rows.length) return NextResponse.json(null)

    const proposal = rows[0]

    const [assignees, responses] = await Promise.all([
      db.$queryRaw<AssigneeRow[]>`SELECT userId FROM ProposalAssignee WHERE proposalId = ${proposal.id}`,
      db.$queryRaw<ResponseRow[]>`SELECT requirementId, response FROM ProposalRequirementResponse WHERE proposalId = ${proposal.id}`,
    ])

    return NextResponse.json({
      ...proposal,
      assigneeIds: assignees.map(a => a.userId),
      responses,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ─── POST: create or update proposal for this survey ─────────────────────────

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const body = await req.json() as {
      title?: string
      description?: string
      status?: string
      assigneeIds?: string[]
      responses?: { requirementId: number; response: string }[]
    }

    const { title, description, status = "DRAFT", assigneeIds = [], responses = [] } = body

    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })
    if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 })

    // Check survey exists
    const surveys = await db.$queryRaw<{ id: number }[]>`SELECT id FROM SiteSurvey WHERE id = ${surveyId} LIMIT 1`
    if (!surveys.length) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

    // Upsert proposal
    const existing = await db.$queryRaw<{ id: number }[]>`
      SELECT id FROM SurveyProposal WHERE surveyId = ${surveyId} LIMIT 1
    `

    let proposalId: number
    const isNew = !existing.length

    if (!isNew) {
      proposalId = existing[0].id
      await db.$executeRaw`
        UPDATE SurveyProposal
        SET title = ${title.trim()},
            description = ${description?.trim() || null},
            status = ${status},
            updatedAt = NOW()
        WHERE id = ${proposalId}
      `
    } else {
      await db.$executeRaw`
        INSERT INTO SurveyProposal (surveyId, title, description, status, createdAt, updatedAt)
        VALUES (${surveyId}, ${title.trim()}, ${description?.trim() || null}, ${status}, NOW(), NOW())
      `
      const inserted = await db.$queryRaw<{ id: number }[]>`SELECT LAST_INSERT_ID() as id`
      proposalId = inserted[0].id
    }

    // Replace assignees
    await db.$executeRaw`DELETE FROM ProposalAssignee WHERE proposalId = ${proposalId}`
    for (const userId of assigneeIds) {
      if (userId) {
        await db.$executeRaw`
          INSERT INTO ProposalAssignee (proposalId, userId, createdAt)
          VALUES (${proposalId}, ${userId}, NOW())
        `
      }
    }

    // Upsert requirement responses
    for (const r of responses) {
      if (!r.requirementId) continue
      await db.$executeRaw`
        INSERT INTO ProposalRequirementResponse (proposalId, requirementId, response, createdAt, updatedAt)
        VALUES (${proposalId}, ${r.requirementId}, ${r.response?.trim() || null}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE response = VALUES(response), updatedAt = NOW()
      `
    }

    // Return full result
    const proposal = (await db.$queryRaw<ProposalRow[]>`
      SELECT id, surveyId, title, description, status, createdAt, updatedAt
      FROM SurveyProposal WHERE id = ${proposalId}
    `)[0]

    const [assignees, responseRows] = await Promise.all([
      db.$queryRaw<AssigneeRow[]>`SELECT userId FROM ProposalAssignee WHERE proposalId = ${proposalId}`,
      db.$queryRaw<ResponseRow[]>`SELECT requirementId, response FROM ProposalRequirementResponse WHERE proposalId = ${proposalId}`,
    ])

    return NextResponse.json({
      ...proposal,
      assigneeIds: assignees.map(a => a.userId),
      responses: responseRows,
    }, { status: isNew ? 201 : 200 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ─── DELETE: remove proposal ──────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const surveyId = parseInt(id, 10)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await db.$executeRaw`DELETE FROM SurveyProposal WHERE surveyId = ${surveyId}`
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
