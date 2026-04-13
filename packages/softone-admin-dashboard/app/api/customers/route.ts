import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

const SORTABLE = ["trdr","code","name","afm","city","email","isprosp","insdate","upddate"] as const
type SortField = typeof SORTABLE[number]

export async function GET(req: Request) {
  await assertApiAccess(req)

  const url    = new URL(req.url)
  const search = url.searchParams.get("q")?.trim() ?? ""
  const take   = Math.min(Number(url.searchParams.get("limit")  ?? 25), 500)
  const skip   = Number(url.searchParams.get("offset") ?? 0)
  const rawSort = url.searchParams.get("sort") ?? "name"
  const dir    = url.searchParams.get("dir") === "desc" ? "desc" : "asc"
  const sort: SortField = (SORTABLE as readonly string[]).includes(rawSort) ? rawSort as SortField : "name"

  const where = search
    ? { OR: [
        { name:  { contains: search } },
        { code:  { contains: search } },
        { afm:   { contains: search } },
        { city:  { contains: search } },
        { email: { contains: search } },
      ]}
    : {}

  const [customers, total] = await Promise.all([
    db.customer.findMany({ where, orderBy: { [sort]: dir }, take, skip }),
    db.customer.count({ where }),
  ])

  return NextResponse.json({ customers, total })
}

export async function POST(req: Request) {
  await assertApiAccess(req)
  const body = await req.json()

  const customer = await db.customer.create({ data: sanitize(body) })
  return NextResponse.json(customer, { status: 201 })
}

function sanitize(body: Record<string, unknown>) {
  return {
    trdr:        body.trdr        != null ? Number(body.trdr)        : null,
    code:        (body.code        as string) || null,
    name:        (body.name        as string) || null,
    afm:         (body.afm         as string) || null,
    sotitle:     (body.sotitle     as string) || null,
    isprosp:     body.isprosp     != null ? Number(body.isprosp)     : 0,
    country:     body.country     != null ? Number(body.country)     : null,
    address:     (body.address     as string) || null,
    zip:         (body.zip         as string) || null,
    district:    (body.district    as string) || null,
    city:        (body.city        as string) || null,
    area:        (body.area        as string) || null,
    latitude:    body.latitude    != null ? parseFloat(String(body.latitude))    : null,
    longitude:   body.longitude   != null ? parseFloat(String(body.longitude))   : null,
    phone01:     (body.phone01     as string) || null,
    phone02:     (body.phone02     as string) || null,
    jobtype:     body.jobtype     != null ? Number(body.jobtype)     : null,
    jobtypetrd:  (body.jobtypetrd  as string) || null,
    trdpgroup:   body.trdpgroup   != null ? Number(body.trdpgroup)   : null,
    webpage:     (body.webpage     as string) || null,
    email:       (body.email       as string) || null,
    emailacc:    (body.emailacc    as string) || null,
    trdbusiness: body.trdbusiness != null ? Number(body.trdbusiness) : null,
    irsdata:     (body.irsdata     as string) || null,
    consent:           Boolean(body.consent),
    prjcs:             body.prjcs             != null ? Number(body.prjcs)             : null,
    remark:            (body.remark            as string) || null,
    registrationDate:  body.registrationDate  ? new Date(body.registrationDate  as string) : null,
    numberOfEmployees: body.numberOfEmployees != null ? Number(body.numberOfEmployees) : null,
    gemiCode:          (body.gemiCode          as string) || null,
    insdate:           body.insdate ? new Date(body.insdate as string) : null,
    upddate:           body.upddate ? new Date(body.upddate as string) : null,
  }
}
