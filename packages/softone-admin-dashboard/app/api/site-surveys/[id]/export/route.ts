import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { SoftwareType, WebCategory, DigitalToolType, IotTech } from "@prisma/client"
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from "docx"

type Params = { params: Promise<{ id: string }> }

const SECTION_LABELS: Record<string, string> = {
  hardware_network: "Hardware & Network",
  software:         "Software",
  web_ecommerce:    "Web & E-commerce",
  compliance:       "Compliance",
  iot_ai:           "IoT & AI",
}

const SECTION_ENUM: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software:         "SOFTWARE",
  web_ecommerce:    "WEB_ECOMMERCE",
  compliance:       "COMPLIANCE",
  iot_ai:           "IOT_AI",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", SCHEDULED: "Scheduled", IN_PROGRESS: "In Progress",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
}

async function resolveOptions(source: string): Promise<{ id: number; label: string }[]> {
  const [model, filter] = source.split(":")
  switch (model) {
    case "software_vendor": {
      const rows = await db.softwareVendor.findMany({ orderBy: { name: "asc" } })
      return rows.map(r => ({ id: r.id, label: r.name }))
    }
    case "software_product": {
      const rows = await db.softwareProduct.findMany({
        where: filter ? { type: filter as SoftwareType } : undefined,
        include: { vendor: { select: { name: true } } },
        orderBy: { name: "asc" },
      })
      return rows.map(r => ({ id: r.id, label: `${r.name} (${r.vendor.name})` }))
    }
    case "web_platform": {
      const rows = await db.webPlatform.findMany({
        where: filter ? { category: filter as WebCategory } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map(r => ({ id: r.id, label: r.name }))
    }
    case "digital_tool": {
      const rows = await db.digitalTool.findMany({
        where: filter ? { type: filter as DigitalToolType } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map(r => ({ id: r.id, label: r.name }))
    }
    case "brand": {
      const rows = await db.brand.findMany({
        where: filter ? { categories: { array_contains: filter } } : undefined,
        orderBy: { name: "asc" },
      })
      return rows.map(r => ({ id: r.id, label: r.name }))
    }
    case "iot_category": {
      const rows = await db.iotCategory.findMany({ orderBy: { name: "asc" } })
      return rows.map(r => ({ id: r.id, label: r.name }))
    }
    case "iot_product": {
      const rows = await db.iotProduct.findMany({
        where: filter ? { technology: filter as IotTech } : undefined,
        include: { category: { select: { name: true } } },
        orderBy: { modelName: "asc" },
      })
      return rows.map(r => ({
        id: r.id,
        label: r.description ? `${r.modelName} — ${r.description}` : r.modelName,
      }))
    }
    default: return []
  }
}

interface DeviceEntry { brand: string; model: string; serial: string; location: string; ip: string }

function parseDevices(value: string | null | undefined): DeviceEntry[] {
  if (!value || value === "[]") return []
  try { const arr = JSON.parse(value); return Array.isArray(arr) ? arr : [] }
  catch { return [] }
}

function formatAnswer(
  answerValue: string | null | undefined,
  type: string,
  options: { id: number | string; label: string }[],
): string {
  if (type === "DEVICE_LIST") {
    const devices = parseDevices(answerValue)
    if (devices.length === 0) return "—"
    return devices.map((d, i) =>
      `#${i + 1}: ${[d.brand, d.model].filter(Boolean).join(" — ")}` +
      (d.serial   ? ` | S/N: ${d.serial}`   : "") +
      (d.location ? ` | ${d.location}`       : "") +
      (d.ip       ? ` | IP: ${d.ip}`         : "")
    ).join("\n")
  }

  if (answerValue === null || answerValue === undefined || answerValue === "") return "—"

  if (type === "BOOLEAN") {
    return answerValue === "true" ? "Yes" : answerValue === "false" ? "No" : "—"
  }

  if (type === "DROPDOWN") {
    const match = options.find(o => String(o.id) === String(answerValue))
    return match?.label ?? answerValue
  }

  if (type === "MULTI_SELECT") {
    try {
      const ids: (string | number)[] = JSON.parse(answerValue)
      if (!Array.isArray(ids) || ids.length === 0) return "—"
      const labels = ids.map(id => options.find(o => String(o.id) === String(id))?.label ?? String(id))
      return labels.join(", ")
    } catch {
      return answerValue
    }
  }

  return answerValue
}

// GET /api/site-surveys/:id/export
// Returns a Word (.docx) document with the full survey report.
export async function GET(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const surveyId = Number(id)

  // 1. Load survey with relations
  const survey = await db.siteSurvey.findUnique({
    where: { id: surveyId },
    include: {
      customer:  { select: { id: true, name: true } },
      surveyor:  { select: { id: true, name: true, email: true } },
    },
  })
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const sectionKeys: string[] = Array.isArray(survey.sections) ? survey.sections as string[] : []

  // 2. Load questions for the survey's sections
  const sectionEnums = sectionKeys.map(k => SECTION_ENUM[k]).filter(Boolean)
  const questions = await db.surveyQuestion.findMany({
    where: {
      isActive: true,
      ...(sectionEnums.length ? { section: { in: sectionEnums as any[] } } : {}),
    },
    orderBy: [{ section: "asc" }, { order: "asc" }],
  })

  // Resolve options for all questions
  const resolvedQuestions = await Promise.all(
    questions.map(async q => {
      let options: { id: number | string; label: string }[] = []
      if (q.optionsSource) {
        options = await resolveOptions(q.optionsSource)
      } else if (Array.isArray(q.options)) {
        options = (q.options as string[]).map(o => ({ id: o, label: o }))
      }
      return { ...q, options }
    })
  )

  // Dedupe
  const seen = new Set<number>()
  const dedupedQuestions = resolvedQuestions.filter(q => !seen.has(q.id) && !!seen.add(q.id))

  // 3. Load results
  const results = await db.surveyResult.findMany({
    where: { surveyId },
    include: { question: { select: { key: true } } },
  })
  const answerByKey: Record<string, string | null> = Object.fromEntries(
    results.map(r => [r.question.key, r.answerValue])
  )

  // 4. Build document
  const surveyDate = new Date(survey.date).toLocaleDateString("el-GR")
  const customerName = survey.customer?.name ?? `Customer #${survey.customerId}`
  const surveyorName = survey.surveyor?.name ?? survey.surveyor?.email ?? `Surveyor`
  const statusLabel = STATUS_LABELS[survey.status] ?? survey.status

  // Helper: thin border
  const thinBorder = {
    top:    { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    left:   { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    right:  { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  }

  // Info table
  const infoRows = [
    ["Customer",  customerName],
    ["Surveyor",  surveyorName],
    ["Date",      surveyDate],
    ["Status",    statusLabel],
    ...(survey.description ? [["Description", survey.description]] : []),
  ]

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: infoRows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { type: ShadingType.SOLID, color: "F3F4F6" },
            children: [new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 20, font: "Calibri" })],
            })],
          }),
          new TableCell({
            width: { size: 80, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            children: [new Paragraph({
              children: [new TextRun({ text: value, size: 20, font: "Calibri" })],
            })],
          }),
        ],
      })
    ),
  })

  // Build section content
  const sectionParagraphs: (Paragraph | Table)[] = []

  for (const sectionKey of sectionKeys) {
    const sectionEnum = SECTION_ENUM[sectionKey]
    const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
    const sectionQuestions = dedupedQuestions.filter(q => q.section === sectionEnum)

    if (sectionQuestions.length === 0) continue

    sectionParagraphs.push(
      new Paragraph({ text: "" }), // spacer
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: sectionLabel, font: "Calibri", color: "1E3A5F" })],
        spacing: { before: 320, after: 160 },
      }),
    )

    sectionQuestions.forEach((q, idx) => {
      const rawAnswer = answerByKey[q.key]

      if (q.type === "DEVICE_LIST") {
        const devices = parseDevices(rawAnswer)

        // Question label paragraph
        sectionParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}.  `, bold: true, size: 18, color: "4F46E5", font: "Calibri" }),
              new TextRun({ text: q.label, bold: true, size: 20, font: "Calibri" }),
            ],
            spacing: { before: 160, after: devices.length > 0 ? 80 : 0 },
          }),
        )

        if (devices.length === 0) {
          sectionParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: "No devices recorded", size: 18, font: "Calibri", color: "9CA3AF", italics: true })],
              spacing: { after: 120 },
            }),
          )
        } else {
          // Device table: header + one row per device
          const headerBg = "E0E7FF"
          const deviceTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Header row
              new TableRow({
                tableHeader: true,
                children: ["#", "Brand / Model", "Serial #", "Location", "IP Address"].map(h =>
                  new TableCell({
                    borders: thinBorder,
                    shading: { type: ShadingType.SOLID, color: headerBg },
                    children: [new Paragraph({
                      children: [new TextRun({ text: h, bold: true, size: 18, font: "Calibri", color: "3730A3" })],
                    })],
                  })
                ),
              }),
              // Device rows
              ...devices.map((d, di) =>
                new TableRow({
                  children: [
                    new TableCell({
                      borders: thinBorder,
                      children: [new Paragraph({ children: [new TextRun({ text: String(di + 1), size: 18, font: "Calibri", bold: true })] })],
                    }),
                    new TableCell({
                      borders: thinBorder,
                      children: [new Paragraph({ children: [new TextRun({ text: [d.brand, d.model].filter(Boolean).join(" — ") || "—", size: 18, font: "Calibri" })] })],
                    }),
                    new TableCell({
                      borders: thinBorder,
                      children: [new Paragraph({ children: [new TextRun({ text: d.serial || "—", size: 18, font: "Courier New" })] })],
                    }),
                    new TableCell({
                      borders: thinBorder,
                      children: [new Paragraph({ children: [new TextRun({ text: d.location || "—", size: 18, font: "Calibri" })] })],
                    }),
                    new TableCell({
                      borders: thinBorder,
                      children: [new Paragraph({ children: [new TextRun({ text: d.ip || "—", size: 18, font: "Courier New" })] })],
                    }),
                  ],
                })
              ),
            ],
          })
          sectionParagraphs.push(deviceTable, new Paragraph({ text: "", spacing: { after: 120 } }))
        }
        return
      }

      const answerText = formatAnswer(rawAnswer, q.type, q.options)
      const isAnswered = rawAnswer !== null && rawAnswer !== undefined && rawAnswer !== "" && rawAnswer !== "[]"

      sectionParagraphs.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 4, type: WidthType.PERCENTAGE },
                  borders: { ...thinBorder, right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" } },
                  shading: { type: ShadingType.SOLID, color: "EEF2FF" },
                  children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(idx + 1), bold: true, size: 18, color: "4F46E5", font: "Calibri" })],
                  })],
                }),
                new TableCell({
                  width: { size: 96, type: WidthType.PERCENTAGE },
                  borders: { ...thinBorder, left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" } },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: q.label, bold: true, size: 20, font: "Calibri" })],
                      spacing: { after: 80 },
                    }),
                    new Paragraph({
                      children: [new TextRun({
                        text: answerText,
                        size: 20,
                        font: "Calibri",
                        color: isAnswered ? "111827" : "9CA3AF",
                        italics: !isAnswered,
                      })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "", spacing: { after: 80 } }),
      )
    })
  }

  const doc = new Document({
    creator: "SoftOne Admin",
    title: survey.name,
    description: `Site Survey Report — ${customerName}`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: survey.name, font: "Calibri", color: "1E3A5F", size: 48, bold: true }),
          ],
          spacing: { after: 240 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Site Survey Report", font: "Calibri", size: 24, color: "6B7280" })],
          spacing: { after: 400 },
        }),
        infoTable,
        ...sectionParagraphs,
        new Paragraph({ text: "" }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Generated on ${new Date().toLocaleDateString("el-GR")}`, size: 16, color: "9CA3AF", font: "Calibri" })],
        }),
      ],
    }],
  })

  const nodeBuffer = await Packer.toBuffer(doc)
  const buffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength) as ArrayBuffer
  const filename = `survey-${survey.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${surveyDate.replace(/\//g, "-")}.docx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
