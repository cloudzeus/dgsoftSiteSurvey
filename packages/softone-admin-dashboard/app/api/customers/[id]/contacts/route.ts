import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const customerId = parseInt(id, 10)
  if (isNaN(customerId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const contacts = await db.$queryRaw<{
      id: number; customerId: number; name: string | null; position: string | null
      email: string | null; phone: string | null; mobile: string | null
      address: string | null; zip: string | null; city: string | null
      country: string | null; remarks: string | null
    }[]>`
      SELECT id, customerId, name, position, email, phone, mobile, address, zip, city, country, remarks
      FROM CustomerContact
      WHERE customerId = ${customerId}
      ORDER BY createdAt ASC
    `
    return NextResponse.json(contacts)
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
    const { name, position, email, phone, mobile, address, zip, city, country, remarks } = await req.json()

    await db.$executeRaw`
      INSERT INTO CustomerContact (customerId, name, position, email, phone, mobile, address, zip, city, country, remarks, createdAt, updatedAt)
      VALUES (${customerId}, ${name ?? null}, ${position ?? null}, ${email ?? null}, ${phone ?? null}, ${mobile ?? null}, ${address ?? null}, ${zip ?? null}, ${city ?? null}, ${country ?? null}, ${remarks ?? null}, NOW(), NOW())
    `

    const [contact] = await db.$queryRaw<{ id: number }[]>`SELECT LAST_INSERT_ID() as id`
    const [row] = await db.$queryRaw<object[]>`SELECT * FROM CustomerContact WHERE id = ${contact.id}`

    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
