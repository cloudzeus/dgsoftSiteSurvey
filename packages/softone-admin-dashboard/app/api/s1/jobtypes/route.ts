import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"
import { s1 } from "@/lib/s1"

export async function GET(req: Request) {
  await assertApiAccess(req)

  const res = await s1<any>("GetTable", {
    TABLE: "JOBTYPE",
    FIELDS: "JOBTYPE,NAME",
    FILTER: "",
  })

  if (!res.success) {
    return NextResponse.json({ error: res.error ?? "GetTable failed" }, { status: 502 })
  }

  const cols = (res.model?.[0] ?? []).map((c: { name: string }) => c.name.toUpperCase())
  const rows = (res.data ?? []).map((values: unknown[]) =>
    Object.fromEntries(cols.map((col: string, i: number) => [col, values[i]]))
  )

  const seen = new Set<number>()
  const jobtypes = rows
    .filter((r: Record<string, unknown>) => r.JOBTYPE != null && r.NAME != null)
    .map((r: Record<string, unknown>) => ({ id: Number(r.JOBTYPE), name: String(r.NAME) }))
    .filter((j: { id: number; name: string }) => { if (seen.has(j.id)) return false; seen.add(j.id); return true })
    .sort((a: { id: number; name: string }, b: { id: number; name: string }) => a.name.localeCompare(b.name))

  return NextResponse.json(jobtypes)
}
