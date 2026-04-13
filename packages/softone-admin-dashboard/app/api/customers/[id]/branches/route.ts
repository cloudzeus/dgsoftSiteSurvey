import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const customerId = parseInt(id, 10)
  if (isNaN(customerId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const branches = await db.$queryRaw<object[]>`
      SELECT id, customerId, trdbranch, code, name, country, irsdata, address, areas, district, zip,
             latitude, longitude, phone1, phone2, email, emailacc, jobtype, jobtypetrd, remarks
      FROM TrdBranch
      WHERE customerId = ${customerId}
      ORDER BY name ASC
    `
    return NextResponse.json(branches)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const customerId = parseInt(id, 10)
  if (isNaN(customerId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const {
      trdbranch, code, name, country, irsdata, address, areas, district, zip,
      latitude, longitude, phone1, phone2, email, emailacc, jobtype, jobtypetrd, remarks,
    } = await req.json()

    await db.$executeRaw`
      INSERT INTO TrdBranch (customerId, trdbranch, code, name, country, irsdata, address, areas, district, zip, latitude, longitude, phone1, phone2, email, emailacc, jobtype, jobtypetrd, remarks, createdAt, updatedAt)
      VALUES (${customerId}, ${trdbranch ?? null}, ${code ?? null}, ${name ?? null}, ${country ?? null}, ${irsdata ?? null}, ${address ?? null}, ${areas ?? null}, ${district ?? null}, ${zip ?? null}, ${latitude ?? null}, ${longitude ?? null}, ${phone1 ?? null}, ${phone2 ?? null}, ${email ?? null}, ${emailacc ?? null}, ${jobtype ?? null}, ${jobtypetrd ?? null}, ${remarks ?? null}, NOW(), NOW())
    `

    const [row] = await db.$queryRaw<{ id: number }[]>`SELECT LAST_INSERT_ID() as id`
    const [branch] = await db.$queryRaw<object[]>`SELECT * FROM TrdBranch WHERE id = ${row!.id}`

    return NextResponse.json(branch, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
