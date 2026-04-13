import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string; contactId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { id, contactId } = await params
  const customerId = parseInt(id, 10)
  const cid        = parseInt(contactId, 10)
  if (isNaN(customerId) || isNaN(cid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const { name, position, email, phone, mobile, address, zip, city, country, remarks } = await req.json()

    await db.$executeRaw`
      UPDATE CustomerContact
      SET name=${name ?? null}, position=${position ?? null}, email=${email ?? null},
          phone=${phone ?? null}, mobile=${mobile ?? null}, address=${address ?? null},
          zip=${zip ?? null}, city=${city ?? null}, country=${country ?? null},
          remarks=${remarks ?? null}, updatedAt=NOW()
      WHERE id=${cid} AND customerId=${customerId}
    `

    const [row] = await db.$queryRaw<object[]>`SELECT * FROM CustomerContact WHERE id = ${cid}`
    return NextResponse.json(row)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, contactId } = await params
  const customerId = parseInt(id, 10)
  const cid        = parseInt(contactId, 10)
  if (isNaN(customerId) || isNaN(cid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await db.$executeRaw`DELETE FROM CustomerContact WHERE id=${cid} AND customerId=${customerId}`
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
