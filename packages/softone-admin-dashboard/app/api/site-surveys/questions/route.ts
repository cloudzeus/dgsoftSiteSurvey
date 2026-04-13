import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { MasterCategory, SoftwareType, WebCategory, DigitalToolType, IotTech } from "@prisma/client"

// Resolves optionsSource string → array of { id, label } from the matching master table.
// Format: "<model>" or "<model>:<filter>"
async function resolveOptions(source: string): Promise<{ id: number; label: string }[]> {
  const [model, filter] = source.split(":")

  switch (model) {
    case "software_vendor": {
      const rows = await db.softwareVendor.findMany({ orderBy: { name: "asc" } })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }

    case "software_product": {
      const rows = await db.softwareProduct.findMany({
        where: filter ? { type: filter as SoftwareType } : undefined,
        include: { vendor: { select: { name: true } } },
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: `${r.name} (${r.vendor.name})` }))
    }

    case "web_platform": {
      const rows = await db.webPlatform.findMany({
        where: filter ? { category: filter as WebCategory } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }

    case "digital_tool": {
      const rows = await db.digitalTool.findMany({
        where: filter ? { type: filter as DigitalToolType } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }

    case "brand": {
      const rows = await db.brand.findMany({
        where: filter ? { category: filter as MasterCategory } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }

    case "iot_category": {
      const rows = await db.iotCategory.findMany({ orderBy: { name: "asc" } })
      return rows.map((r) => ({ id: r.id, label: r.name }))
    }

    case "iot_product": {
      const rows = await db.iotProduct.findMany({
        where: filter ? { technology: filter as IotTech } : undefined,
        include: { category: { select: { name: true } } },
        orderBy: { modelName: "asc" },
      })
      return rows.map((r) => ({
        id: r.id,
        label: r.description ? `${r.modelName} — ${r.description}` : r.modelName,
      }))
    }

    default:
      return []
  }
}

// GET /api/site-surveys/questions?section=SOFTWARE
// Returns questions for a section with options resolved from master tables.
export async function GET(req: Request) {
  await assertApiAccess(req)

  const url     = new URL(req.url)
  const section = url.searchParams.get("section") ?? undefined

  const questions = await db.surveyQuestion.findMany({
    where: { isActive: true, ...(section ? { section: section as any } : {}) },
    orderBy: [{ section: "asc" }, { order: "asc" }],
  })

  const resolved = await Promise.all(
    questions.map(async (q) => {
      let options: { id: number | string; label: string }[] = []

      if (q.optionsSource) {
        options = await resolveOptions(q.optionsSource)
      } else if (Array.isArray(q.options)) {
        // Static JSON array — convert to { id, label } shape (id = the string value itself)
        options = (q.options as string[]).map((o) => ({ id: o, label: o }))
      }

      return { ...q, options }
    }),
  )

  return NextResponse.json(resolved)
}
