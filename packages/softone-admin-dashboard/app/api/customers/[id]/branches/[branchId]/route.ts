import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string; branchId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { id, branchId } = await params
  const customerId = parseInt(id, 10)
  const bId = parseInt(branchId, 10)
  if (isNaN(customerId) || isNaN(bId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const {
      trdbranch, code, name, country, irsdata, address, areas, district, zip,
      latitude, longitude, phone1, phone2, email, emailacc, jobtype, jobtypetrd, remarks,
    } = await req.json()

    await db.$executeRaw`
      UPDATE TrdBranch SET
        trdbranch = ${trdbranch ?? null}, code = ${code ?? null}, name = ${name ?? null},
        country = ${country ?? null}, irsdata = ${irsdata ?? null},
        address = ${address ?? null}, areas = ${areas ?? null}, district = ${district ?? null},
        zip = ${zip ?? null}, latitude = ${latitude ?? null}, longitude = ${longitude ?? null},
        phone1 = ${phone1 ?? null}, phone2 = ${phone2 ?? null}, email = ${email ?? null},
        emailacc = ${emailacc ?? null}, jobtype = ${jobtype ?? null}, jobtypetrd = ${jobtypetrd ?? null},
        remarks = ${remarks ?? null}, updatedAt = NOW()
      WHERE id = ${bId} AND customerId = ${customerId}
    `

    const [branch] = await db.$queryRaw<object[]>`SELECT * FROM TrdBranch WHERE id = ${bId}`
    return NextResponse.json(branch)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, branchId } = await params
  const customerId = parseInt(id, 10)
  const bId = parseInt(branchId, 10)
  if (isNaN(customerId) || isNaN(bId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await db.$executeRaw`DELETE FROM TrdBranch WHERE id = ${bId} AND customerId = ${customerId}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
