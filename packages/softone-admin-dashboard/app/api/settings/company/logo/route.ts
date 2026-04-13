import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { bunnyUpload, bunnyDelete } from "@/lib/bunny"
import { toWebP } from "@/lib/image"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
const MAX_BYTES = 5 * 1024 * 1024

// POST /api/settings/company/logo — upload company logo
export async function POST(req: Request) {
  await assertApiAccess(req)

  const formData = await req.formData()
  const file = formData.get("logo")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be JPEG, PNG, WebP, or SVG" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 5 MB" }, { status: 400 })
  }

  const existing = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { companyLogo: true } })

  const raw = Buffer.from(await file.arrayBuffer())
  const { buffer, contentType, ext } = await toWebP(raw, file.type)
  const path = `company/logo.${ext}`

  const cdnUrl = await bunnyUpload(path, buffer, contentType)

  if (existing?.companyLogo && existing.companyLogo !== cdnUrl) {
    await bunnyDelete(existing.companyLogo)
  }

  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", companyName: "", companyLogo: cdnUrl },
    update: { companyLogo: cdnUrl },
  })

  return NextResponse.json({ url: cdnUrl })
}

// DELETE /api/settings/company/logo — remove company logo
export async function DELETE(req: Request) {
  await assertApiAccess(req)

  const existing = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { companyLogo: true } })
  if (existing?.companyLogo) await bunnyDelete(existing.companyLogo)

  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", companyName: "", companyLogo: null },
    update: { companyLogo: null },
  })

  return new Response(null, { status: 204 })
}
