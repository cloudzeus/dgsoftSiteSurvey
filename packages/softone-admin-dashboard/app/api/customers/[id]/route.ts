import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const customer = await db.customer.findUnique({ where: { id: Number(id) } })
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PATCH(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const body = await req.json()

  const customer = await db.customer.update({
    where: { id: Number(id) },
    data: sanitize(body),
  })
  return NextResponse.json(customer)
}

export async function DELETE(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  await db.customer.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

function sanitize(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  const set = (k: string, v: unknown) => { if (v !== undefined) data[k] = v }

  set("trdr",        body.trdr        != null ? Number(body.trdr)        : null)
  set("code",        (body.code        as string) || null)
  set("name",        (body.name        as string) || null)
  set("afm",         (body.afm         as string) || null)
  set("sotitle",     (body.sotitle     as string) || null)
  set("isprosp",     body.isprosp     != null ? Number(body.isprosp)     : 0)
  set("country",     body.country     != null ? Number(body.country)     : null)
  set("address",     (body.address     as string) || null)
  set("zip",         (body.zip         as string) || null)
  set("district",    (body.district    as string) || null)
  set("city",        (body.city        as string) || null)
  set("area",        (body.area        as string) || null)
  set("latitude",    body.latitude    != null ? parseFloat(String(body.latitude))    : null)
  set("longitude",   body.longitude   != null ? parseFloat(String(body.longitude))  : null)
  set("phone01",     (body.phone01     as string) || null)
  set("phone02",     (body.phone02     as string) || null)
  set("jobtype",     body.jobtype     != null ? Number(body.jobtype)     : null)
  set("jobtypetrd",  (body.jobtypetrd  as string) || null)
  set("trdpgroup",   body.trdpgroup   != null ? Number(body.trdpgroup)   : null)
  set("webpage",     (body.webpage     as string) || null)
  set("email",       (body.email       as string) || null)
  set("emailacc",    (body.emailacc    as string) || null)
  set("trdbusiness", body.trdbusiness != null ? Number(body.trdbusiness) : null)
  set("irsdata",     (body.irsdata     as string) || null)
  set("consent",           body.consent !== undefined ? Boolean(body.consent) : undefined)
  set("prjcs",             body.prjcs             != null ? Number(body.prjcs)             : null)
  set("remark",            (body.remark            as string) || null)
  set("registrationDate",  body.registrationDate  ? new Date(body.registrationDate  as string) : null)
  set("numberOfEmployees", body.numberOfEmployees != null ? Number(body.numberOfEmployees) : null)
  set("gemiCode",          (body.gemiCode          as string) || null)
  if (body.insdate !== undefined) set("insdate", body.insdate ? new Date(body.insdate as string) : null)
  if (body.upddate !== undefined) set("upddate", body.upddate ? new Date(body.upddate as string) : null)

  return data
}
