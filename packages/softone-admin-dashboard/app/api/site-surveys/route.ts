import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

const SORTABLE = ["name", "date", "status", "createdAt"] as const
type SortField = typeof SORTABLE[number]

export async function GET(req: Request) {
  await assertApiAccess(req)

  const url    = new URL(req.url)
  const search = url.searchParams.get("q")?.trim() ?? ""
  const take   = Math.min(Number(url.searchParams.get("limit")  ?? 25), 500)
  const skip   = Number(url.searchParams.get("offset") ?? 0)
  const rawSort = url.searchParams.get("sort") ?? "date"
  const dir    = url.searchParams.get("dir") === "asc" ? "asc" : "desc"
  const sort: SortField = (SORTABLE as readonly string[]).includes(rawSort) ? rawSort as SortField : "date"

  const where = search
    ? { OR: [
        { name:              { contains: search } },
        { customer: { name: { contains: search } } },
        { surveyor: { name: { contains: search } } },
      ]}
    : {}

  const [surveys, total] = await Promise.all([
    db.siteSurvey.findMany({
      where,
      orderBy: { [sort]: dir },
      take,
      skip,
      include: {
        customer: { select: { id: true, name: true } },
        surveyor: { select: { id: true, name: true, email: true } },
      },
    }),
    db.siteSurvey.count({ where }),
  ])

  return NextResponse.json({ surveys, total })
}
