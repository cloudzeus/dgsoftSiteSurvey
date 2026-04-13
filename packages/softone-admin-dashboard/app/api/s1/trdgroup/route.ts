import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"
import { s1 } from "@/lib/s1"

export async function GET(req: Request) {
  await assertApiAccess(req)

  const res = await s1<any>("GetTable", {
    TABLE: "TRDGROUP",
    FIELDS: "TRDGROUP,NAME",
    FILTER: "",
  })

  if (!res.success) {
    return NextResponse.json({ error: res.error ?? "GetTable failed" }, { status: 502 })
  }

  const cols = (res.model?.[0] ?? []).map((c: { name: string }) => c.name.toUpperCase())
  const rows = (res.data ?? []).map((values: unknown[]) =>
    Object.fromEntries(cols.map((col: string, i: number) => [col, values[i]]))
  )

  const groups = rows
    .filter((r: Record<string, unknown>) => r.TRDGROUP != null && r.NAME != null)
    .map((r: Record<string, unknown>) => ({ id: Number(r.TRDGROUP), name: String(r.NAME) }))
    .filter(((seen) => (g: { id: number }) => { if (seen.has(g.id)) return false; seen.add(g.id); return true })(new Set<number>()))
    .sort((a: { id: number; name: string }, b: { id: number; name: string }) => a.name.localeCompare(b.name))

  return NextResponse.json(groups)
}
