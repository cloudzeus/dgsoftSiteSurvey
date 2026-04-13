import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { z } from "zod"

const CompanySchema = z.object({
  companyName: z.string().default(""),
  companyLogo: z.string().optional(),
  address:     z.string().optional(),
  city:        z.string().optional(),
  zip:         z.string().optional(),
  country:     z.string().optional(),
  phone:       z.string().optional(),
  email:       z.string().optional(),
  website:     z.string().optional(),
  taxId:       z.string().optional(),
  taxOffice:   z.string().optional(),
})

export async function GET(req: Request) {
  await assertApiAccess(req)
  const settings = await db.appSettings.findUnique({ where: { id: "singleton" } })
  return NextResponse.json(settings ?? { id: "singleton", companyName: "" })
}

export async function PUT(req: Request) {
  await assertApiAccess(req)
  const body = await req.json()
  const parsed = CompanySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const settings = await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...parsed.data },
    update: parsed.data,
  })
  return NextResponse.json(settings)
}
