import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"
import { s1 } from "@/lib/s1"

export async function GET(req: Request) {
  await assertApiAccess(req)

  const res = await s1<any>("GetTable", {
    TABLE: "country",
    FIELDS: "country,name",
    FILTER: "",
  })

  if (!res.success) {
    return NextResponse.json({ error: res.error ?? "GetTable failed" }, { status: 502 })
  }

  const cols = (res.model?.[0] ?? []).map((c: { name: string }) => c.name.toUpperCase())
  const rows = (res.data ?? []).map((values: unknown[]) =>
    Object.fromEntries(cols.map((col: string, i: number) => [col, values[i]]))
  )

  const countries = rows
    .filter((r: Record<string, unknown>) => r.COUNTRY != null && r.NAME != null)
    .map((r: Record<string, unknown>) => ({ id: Number(r.COUNTRY), name: String(r.NAME) }))
    .sort((a: { id: number; name: string }, b: { id: number; name: string }) => a.name.localeCompare(b.name))

  return NextResponse.json(countries)
}
