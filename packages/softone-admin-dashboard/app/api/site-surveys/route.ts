import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

const SORTABLE = ["name", "date", "status", "createdAt"] as const
type SortField = typeof SORTABLE[number]

export async function GET(req: Request) {
  await assertApiAccess(req)

  const url    = new URL(req.url)
  const search = url.searchParams.get("q")?.trim() ?? ""
  const type   = url.searchParams.get("type") ?? "" // "SURVEY" | "PROJECT" | "" (all)
  const take   = Math.min(Number(url.searchParams.get("limit")  ?? 25), 500)
  const skip   = Number(url.searchParams.get("offset") ?? 0)
  const rawSort = url.searchParams.get("sort") ?? "date"
  const dir    = url.searchParams.get("dir") === "asc" ? "asc" : "desc"
  const sort: SortField = (SORTABLE as readonly string[]).includes(rawSort) ? rawSort as SortField : "date"

  const where = {
    ...(search ? { OR: [
      { name:              { contains: search } },
      { customer: { name: { contains: search } } },
      { surveyor: { name: { contains: search } } },
    ]} : {}),
    ...(type ? { type } : {}),
  }

  const [surveys, total] = await Promise.all([
    db.siteSurvey.findMany({
      where,
      orderBy: { [sort]: dir },
      take,
      skip,
      include: {
        customer:    { select: { id: true, name: true } },
        surveyor:    { select: { id: true, name: true, email: true } },
        invitations: {
          where:  { completedAt: { not: null } },
          select: { sectionKey: true, email: true, completedAt: true },
          orderBy: { completedAt: "desc" },
        },
      },
    }),
    db.siteSurvey.count({ where }),
  ])

  return NextResponse.json({ surveys, total })
}

export async function POST(req: Request) {
  await assertApiAccess(req)

  const body = await req.json()
  const { name, description, customerId, surveyorId, sections, status, type, date, branchIds } = body

  if (!name || !customerId) {
    return NextResponse.json({ error: "name and customerId are required" }, { status: 400 })
  }

  // Default surveyorId: find first user or use "system"
  let resolvedSurveyorId: string = surveyorId ?? "system"
  if (!surveyorId || surveyorId === "system") {
    const firstUser = await db.user.findFirst({ select: { id: true } })
    if (firstUser) resolvedSurveyorId = firstUser.id
  }

  const survey = await db.siteSurvey.create({
    data: {
      name,
      description: description ?? null,
      date: date ? new Date(date) : new Date(),
      customerId: Number(customerId),
      surveyorId: resolvedSurveyorId,
      branchIds: Array.isArray(branchIds) ? branchIds : [],
      sections: Array.isArray(sections) ? sections : [],
      status: status ?? "DRAFT",
      type: type ?? "SURVEY",
    },
    include: {
      customer: { select: { id: true, name: true } },
      surveyor: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(survey, { status: 201 })
}
