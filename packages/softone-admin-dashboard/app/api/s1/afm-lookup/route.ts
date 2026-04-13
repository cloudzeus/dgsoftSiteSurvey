import { NextResponse } from "next/server"
import { assertApiAccess } from "@/lib/permissions"

export async function GET(req: Request) {
  await assertApiAccess(req)

  const { searchParams } = new URL(req.url)
  const afm = searchParams.get("afm")?.trim()
  if (!afm) return NextResponse.json({ error: "AFM is required" }, { status: 400 })

  let raw: Response
  try {
    raw = await fetch("https://vat.wwa.gr/afm2info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afm }),
    })
  } catch {
    return NextResponse.json({ error: "Could not reach AADE service" }, { status: 502 })
  }

  if (!raw.ok) {
    return NextResponse.json({ error: `AADE returned ${raw.status}` }, { status: 502 })
  }

  const data = await raw.json()
  const rec = data?.basic_rec
  if (!rec) {
    return NextResponse.json({ error: "No company found for this AFM" }, { status: 404 })
  }

  const street = str(rec.postal_address)
  const number = str(rec.postal_address_no)
  const address = [street, number].filter(Boolean).join(" ") || null

  return NextResponse.json({
    name:             str(rec.onomasia),
    sotitle:          str(rec.commer_title),
    address,
    zip:              str(rec.postal_zip_code),
    city:             str(rec.postal_area_description),
    irsdata:          str(rec.doy_descr),
    registrationDate: str(rec.regist_date),
    // raw components for structured geocoding (not written to form fields)
    _street:          street,
    _houseNumber:     number,
  })
}

function str(v: unknown): string | null {
  if (v == null || typeof v === "object") return null
  const s = String(v).trim()
  return s === "" ? null : s
}
