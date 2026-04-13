import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { SoftwareType, WebCategory, DigitalToolType, IotTech } from "@prisma/client"
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType,
  Footer, PageNumber, convertInchesToTwip,
} from "docx"

type Params = { params: Promise<{ id: string }> }

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "Calibri"

const SECTION_LABELS_GR: Record<string, string> = {
  HARDWARE_NETWORK: "Υποδομή & Δίκτυα",
  SOFTWARE:         "Λογισμικό",
  WEB_ECOMMERCE:    "Διαδίκτυο & E-commerce",
  COMPLIANCE:       "Συμμόρφωση",
  IOT_AI:           "IoT & Τεχνητή Νοημοσύνη",
}

const SECTION_COLORS: Record<string, string> = {
  HARDWARE_NETWORK: "0284C7",
  SOFTWARE:         "7C3AED",
  WEB_ECOMMERCE:    "2563EB",
  COMPLIANCE:       "BE123C",
  IOT_AI:           "0D9488",
}

const SECTION_ENUM_MAP: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software:         "SOFTWARE",
  web_ecommerce:    "WEB_ECOMMERCE",
  compliance:       "COMPLIANCE",
  iot_ai:           "IOT_AI",
}

const SECTION_ORDER = ["HARDWARE_NETWORK", "SOFTWARE", "WEB_ECOMMERCE", "COMPLIANCE", "IOT_AI"]

const SURVEY_STATUS_GR: Record<string, string> = {
  DRAFT: "Πρόχειρο", SCHEDULED: "Προγραμματισμένη", IN_PROGRESS: "Σε Εξέλιξη",
  COMPLETED: "Ολοκληρωμένη", CANCELLED: "Ακυρωμένη",
}

const PROPOSAL_STATUS_GR: Record<string, string> = {
  DRAFT: "Πρόχειρο", SENT: "Εστάλη", ACCEPTED: "Εγκρίθηκε", REJECTED: "Απορρίφθηκε",
}

// ─── Border Helpers ───────────────────────────────────────────────────────────

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
const thin = (c = "E2E8F0"): { style: typeof BorderStyle.SINGLE; size: number; color: string } => ({ style: BorderStyle.SINGLE, size: 4, color: c })
const thinBorders = { top: thin(), bottom: thin(), left: thin(), right: thin() }
const CM = (v: number) => Math.round(v * 567)

// ─── HTML → docx Paragraphs ───────────────────────────────────────────────────

function parseInlineHtml(html: string, size: number, color = "1F2937"): TextRun[] {
  if (!html) return []
  const src = html
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/<br\s*\/?>/gi, " ")

  const runs: TextRun[] = []
  const re = /<(\/?)(\w+)[^>]*>|([^<]+)/g
  let bold = false, italic = false, underline = false
  let m: RegExpExecArray | null

  while ((m = re.exec(src)) !== null) {
    if (m[3] !== undefined) {
      const t = m[3]
      if (t) runs.push(new TextRun({
        text: t, bold, italics: italic, underline: underline ? {} : undefined,
        size, font: FONT, color,
      }))
    } else {
      const closing = m[1] === "/"
      const tag = m[2].toLowerCase()
      if (tag === "b" || tag === "strong") bold = !closing
      else if (tag === "i" || tag === "em") italic = !closing
      else if (tag === "u") underline = !closing
    }
  }
  return runs
}

type HtmlBlock =
  | { kind: "text"; html: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }

function splitToBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = []
  let pos = 0
  const listRe = /<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = listRe.exec(html)) !== null) {
    if (m.index > pos) blocks.push({ kind: "text", html: html.slice(pos, m.index) })
    const items = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(x => x[1])
    blocks.push({ kind: m[1] as "ul" | "ol", items })
    pos = m.index + m[0].length
  }
  if (pos < html.length) blocks.push({ kind: "text", html: html.slice(pos) })
  return blocks
}

function htmlToParagraphs(html: string, opts: {
  size?: number; spacing?: number; indent?: number; color?: string
} = {}): Paragraph[] {
  if (!html || html.trim() === "" || html.trim() === "<br>") return []
  const size = opts.size ?? 20
  const spacing = opts.spacing ?? 120
  const color = opts.color ?? "1F2937"
  const h = html.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  const paras: Paragraph[] = []

  for (const block of splitToBlocks(h)) {
    if (block.kind === "ul") {
      for (const item of block.items) {
        const runs = parseInlineHtml(item, size, color)
        if (runs.length) paras.push(new Paragraph({
          children: [new TextRun({ text: "• ", bold: true, size, font: FONT, color: "2563EB" }), ...runs],
          spacing: { after: 60 },
          indent: { left: 360 },
        }))
      }
    } else if (block.kind === "ol") {
      block.items.forEach((item, i) => {
        const runs = parseInlineHtml(item, size, color)
        if (runs.length) paras.push(new Paragraph({
          children: [new TextRun({ text: `${i + 1}. `, bold: true, size, font: FONT, color: "2563EB" }), ...runs],
          spacing: { after: 60 },
          indent: { left: 360 },
        }))
      })
    } else {
      const parts = block.html.split(/<\/p>|<br\s*\/?>|<p[^>]*>/gi).map(p => p.trim()).filter(Boolean)
      for (const part of parts) {
        const runs = parseInlineHtml(part, size, color)
        if (runs.length) paras.push(new Paragraph({
          children: runs,
          spacing: { after: spacing },
          indent: opts.indent ? { left: opts.indent } : undefined,
        }))
      }
    }
  }
  return paras
}

// ─── Options Resolver ─────────────────────────────────────────────────────────

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
  try { const a = JSON.parse(value); return Array.isArray(a) ? a : [] }
  catch { return [] }
}

function formatAnswer(answerValue: string | null | undefined, type: string, options: { id: number | string; label: string }[]): string {
  if (type === "DEVICE_LIST") {
    const d = parseDevices(answerValue)
    if (!d.length) return "—"
    return d.map((x, i) =>
      `#${i + 1}: ${[x.brand, x.model].filter(Boolean).join(" — ")}` +
      (x.serial   ? ` | S/N: ${x.serial}` : "") +
      (x.location ? ` | ${x.location}`    : "") +
      (x.ip       ? ` | IP: ${x.ip}`      : "")
    ).join("\n")
  }
  if (!answerValue) return "—"
  if (type === "BOOLEAN")     return answerValue === "true" ? "Ναι" : "Όχι"
  if (type === "DROPDOWN")    return options.find(o => String(o.id) === answerValue)?.label ?? answerValue
  if (type === "MULTI_SELECT") {
    try {
      const ids: (string | number)[] = JSON.parse(answerValue)
      return ids.length ? ids.map(id => options.find(o => String(o.id) === String(id))?.label ?? String(id)).join(", ") : "—"
    } catch { return answerValue }
  }
  return answerValue
}

// ─── Document Element Builders ────────────────────────────────────────────────

function sectionDivider(title: string, bgColor: string): (Paragraph | Table)[] {
  return [
    new Paragraph({ text: "", spacing: { before: 480, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: bgColor },
          borders: noBorders,
          margins: { top: 110, bottom: 110, left: 220, right: 220 },
          children: [new Paragraph({
            children: [new TextRun({
              text: title.toUpperCase(),
              color: "FFFFFF", bold: true, size: 22, font: FONT, characterSpacing: 60,
            })],
          })],
        })],
      })],
    }),
    new Paragraph({ text: "", spacing: { before: 0, after: 220 } }),
  ]
}

function subSectionHeader(label: string, color: string): (Paragraph | Table)[] {
  return [
    new Paragraph({ text: "", spacing: { before: 280, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 1, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { type: ShadingType.SOLID, color },
            children: [new Paragraph({ text: "" })],
          }),
          new TableCell({
            width: { size: 99, type: WidthType.PERCENTAGE },
            borders: { ...noBorders, bottom: thin("E2E8F0") },
            shading: { type: ShadingType.SOLID, color: "F8FAFC" },
            margins: { top: 80, bottom: 80, left: 180, right: 180 },
            children: [new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 24, font: FONT, color })],
            })],
          }),
        ],
      })],
    }),
    new Paragraph({ text: "", spacing: { before: 0, after: 120 } }),
  ]
}

function infoRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        borders: thinBorders,
        shading: { type: ShadingType.SOLID, color: "F8FAFC" },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true, size: 18, font: FONT, color: "374151" })],
        })],
      }),
      new TableCell({
        width: { size: 72, type: WidthType.PERCENTAGE },
        borders: thinBorders,
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({
          children: [new TextRun({
            text: value || "—",
            size: 18, font: FONT,
            color: value ? "111827" : "9CA3AF",
            italics: !value,
          })],
        })],
      }),
    ],
  })
}

// ─── GET /api/site-surveys/:id/proposals/export ───────────────────────────────

export async function GET(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params
  const surveyId = Number(id)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  // ── 1. Fetch all data ─────────────────────────────────────────────────────

  const survey = await db.siteSurvey.findUnique({
    where: { id: surveyId },
    include: {
      customer: {
        select: {
          id: true, name: true, afm: true, address: true, city: true, zip: true,
          phone01: true, phone02: true, email: true, webpage: true, jobtypetrd: true,
        },
      },
      surveyor: { select: { id: true, name: true, email: true } },
    },
  })
  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  const proposalRows = await db.$queryRaw<{
    id: number; title: string; description: string | null; status: string
  }[]>`SELECT id, title, description, status FROM SurveyProposal WHERE surveyId = ${surveyId} LIMIT 1`

  if (!proposalRows.length)
    return NextResponse.json({ error: "No proposal found — save a proposal first" }, { status: 404 })

  const proposal = proposalRows[0]

  const [assigneeRows, responseRows, requirements] = await Promise.all([
    db.$queryRaw<{ name: string | null; email: string }[]>`
      SELECT u.name, u.email FROM ProposalAssignee pa
      JOIN User u ON u.id = pa.userId WHERE pa.proposalId = ${proposal.id}
    `,
    db.$queryRaw<{ requirementId: number; response: string | null }[]>`
      SELECT requirementId, response FROM ProposalRequirementResponse WHERE proposalId = ${proposal.id}
    `,
    db.$queryRaw<{ id: number; section: string; title: string; description: string | null }[]>`
      SELECT id, section, title, description FROM ClientRequirement
      WHERE surveyId = ${surveyId} ORDER BY FIELD(section,'HARDWARE_NETWORK','SOFTWARE','WEB_ECOMMERCE','COMPLIANCE','IOT_AI'), id
    `,
  ])

  const responseMap: Record<number, string> = {}
  for (const r of responseRows) responseMap[r.requirementId] = r.response ?? ""

  // Survey questions + answers
  const sectionKeys: string[] = Array.isArray(survey.sections) ? survey.sections as string[] : []
  const sectionEnums = sectionKeys.map(k => SECTION_ENUM_MAP[k]).filter(Boolean)

  const questions = await db.surveyQuestion.findMany({
    where: { isActive: true, ...(sectionEnums.length ? { section: { in: sectionEnums as any[] } } : {}) },
    orderBy: [{ section: "asc" }, { order: "asc" }],
  })

  const resolvedQuestions = await Promise.all(questions.map(async q => {
    let options: { id: number | string; label: string }[] = []
    if (q.optionsSource) options = await resolveOptions(q.optionsSource)
    else if (Array.isArray(q.options)) options = (q.options as string[]).map(o => ({ id: o, label: o }))
    return { ...q, options }
  }))

  const seen = new Set<number>()
  const dedupedQ = resolvedQuestions.filter(q => !seen.has(q.id) && !!seen.add(q.id))

  const results = await db.surveyResult.findMany({
    where: { surveyId },
    include: { question: { select: { key: true } } },
  })
  const answerByKey: Record<string, string | null> = Object.fromEntries(results.map(r => [r.question.key, r.answerValue]))

  // ── 2. Build document elements ────────────────────────────────────────────

  const generatedDate = new Date().toLocaleDateString("el-GR")
  const surveyDate    = new Date(survey.date).toLocaleDateString("el-GR")
  const customerName  = survey.customer?.name ?? `#${survey.customerId}`
  const surveyorName  = survey.surveyor?.name ?? survey.surveyor?.email ?? "—"

  const els: (Paragraph | Table)[] = []

  // ── COVER PAGE ─────────────────────────────────────────────────────────────

  // Accent bar
  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.SOLID, color: "2563EB" },
        borders: noBorders,
        children: [new Paragraph({ text: "", spacing: { before: 60, after: 60 } })],
      })],
    })],
  }))

  els.push(new Paragraph({ text: "", spacing: { before: 0, after: CM(1.8) } }))

  // Title banner
  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.SOLID, color: "1B3A6B" },
        borders: noBorders,
        margins: { top: CM(1), bottom: CM(1), left: CM(1), right: CM(1) },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "ΤΕΧΝΙΚΗ & ΕΜΠΟΡΙΚΗ ΠΡΟΤΑΣΗ", color: "FFFFFF", bold: true, size: 56, font: FONT, characterSpacing: 80 })],
            spacing: { after: 260 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: proposal.title, color: "93C5FD", size: 34, font: FONT })],
          }),
        ],
      })],
    })],
  }))

  els.push(new Paragraph({ text: "", spacing: { before: 0, after: CM(0.9) } }))

  // Cover info strip — 4 cells
  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        // Customer
        new TableCell({
          width: { size: 34, type: WidthType.PERCENTAGE },
          borders: { ...noBorders, right: thin("BFDBFE") },
          shading: { type: ShadingType.SOLID, color: "EFF6FF" },
          margins: { top: 160, bottom: 160, left: 220, right: 220 },
          children: [
            new Paragraph({ children: [new TextRun({ text: "ΠΕΛΑΤΗΣ", bold: true, size: 15, font: FONT, color: "1D4ED8", characterSpacing: 60 })] }),
            new Paragraph({ children: [new TextRun({ text: customerName, bold: true, size: 28, font: FONT, color: "1E3A5F" })], spacing: { before: 60 } }),
          ],
        }),
        // Date
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          borders: { ...noBorders, right: thin("E5E7EB") },
          shading: { type: ShadingType.SOLID, color: "F9FAFB" },
          margins: { top: 160, bottom: 160, left: 220, right: 220 },
          children: [
            new Paragraph({ children: [new TextRun({ text: "ΗΜΕΡΟΜΗΝΙΑ", bold: true, size: 15, font: FONT, color: "6B7280", characterSpacing: 40 })] }),
            new Paragraph({ children: [new TextRun({ text: surveyDate, bold: true, size: 26, font: FONT, color: "374151" })], spacing: { before: 60 } }),
          ],
        }),
        // Status
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          borders: { ...noBorders, right: thin("E5E7EB") },
          shading: { type: ShadingType.SOLID, color: "F9FAFB" },
          margins: { top: 160, bottom: 160, left: 220, right: 220 },
          children: [
            new Paragraph({ children: [new TextRun({ text: "ΚΑΤΑΣΤΑΣΗ", bold: true, size: 15, font: FONT, color: "6B7280", characterSpacing: 40 })] }),
            new Paragraph({ children: [new TextRun({ text: PROPOSAL_STATUS_GR[proposal.status] ?? proposal.status, bold: true, size: 26, font: FONT, color: "374151" })], spacing: { before: 60 } }),
          ],
        }),
        // Surveyor
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          borders: noBorders,
          shading: { type: ShadingType.SOLID, color: "F9FAFB" },
          margins: { top: 160, bottom: 160, left: 220, right: 220 },
          children: [
            new Paragraph({ children: [new TextRun({ text: "ΤΕΧΝΙΚΟΣ", bold: true, size: 15, font: FONT, color: "6B7280", characterSpacing: 40 })] }),
            new Paragraph({ children: [new TextRun({ text: surveyorName, bold: true, size: 22, font: FONT, color: "374151" })], spacing: { before: 60 } }),
          ],
        }),
      ],
    })],
  }))

  els.push(new Paragraph({ text: "", spacing: { before: CM(2), after: 0 } }))
  els.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Εκδόθηκε: ${generatedDate}  |  ΕΜΠΙΣΤΕΥΤΙΚΟ ΕΓΓΡΑΦΟ`, size: 17, font: FONT, color: "9CA3AF", italics: true })],
  }))

  // Page break (use pageBreakBefore on next section's first element instead)
  els.push(new Paragraph({ text: "", pageBreakBefore: true, spacing: { before: 0, after: 0 } }))

  // ── SECTION 1: CUSTOMER & SURVEY INFO ─────────────────────────────────────

  els.push(...sectionDivider("Πληροφορίες Πελάτη & Έργου", "1B3A6B"))

  const custRows: TableRow[] = [
    infoRow("Επωνυμία", customerName),
  ]
  if (survey.customer?.afm)       custRows.push(infoRow("ΑΦΜ", survey.customer.afm))
  const addr = [survey.customer?.address, survey.customer?.city, survey.customer?.zip].filter(Boolean).join(", ")
  if (addr)                       custRows.push(infoRow("Διεύθυνση", addr))
  const phones = [survey.customer?.phone01, survey.customer?.phone02].filter(Boolean).join(" / ")
  if (phones)                     custRows.push(infoRow("Τηλέφωνο", phones))
  if (survey.customer?.email)     custRows.push(infoRow("Email", survey.customer.email))
  if (survey.customer?.webpage)   custRows.push(infoRow("Ιστοσελίδα", survey.customer.webpage))
  if (survey.customer?.jobtypetrd) custRows.push(infoRow("Κλάδος Δραστηριότητας", survey.customer.jobtypetrd))

  els.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: custRows }))

  els.push(new Paragraph({
    children: [new TextRun({ text: "Στοιχεία Έρευνας", bold: true, size: 22, font: FONT, color: "374151" })],
    spacing: { before: 280, after: 120 },
  }))

  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      infoRow("Τίτλος Έρευνας",    survey.name),
      infoRow("Ημερομηνία",        surveyDate),
      infoRow("Τεχνικός",          surveyorName),
      infoRow("Κατάσταση Έρευνας", SURVEY_STATUS_GR[survey.status] ?? survey.status),
      infoRow("Ενότητες",          sectionKeys.map(k => SECTION_LABELS_GR[SECTION_ENUM_MAP[k]] ?? k).join(", ")),
      ...(survey.description ? [infoRow("Σημειώσεις", survey.description)] : []),
    ],
  }))

  // ── SECTION 2: EXECUTIVE SUMMARY ──────────────────────────────────────────

  if (proposal.description?.trim()) {
    els.push(...sectionDivider("Εκτελεστική Σύνοψη", "1D4ED8"))
    const descParas = htmlToParagraphs(proposal.description, { size: 21, spacing: 160 })
    els.push(...(descParas.length ? descParas : [
      new Paragraph({ children: [new TextRun({ text: "—", size: 20, font: FONT, color: "9CA3AF", italics: true })] }),
    ]))
  }

  // ── SECTION 3: TECHNICAL SURVEY FINDINGS ──────────────────────────────────

  if (sectionKeys.length && dedupedQ.length) {
    els.push(...sectionDivider("Τεχνικά Ευρήματα Έρευνας", "0F172A"))

    for (const sectionKey of sectionKeys) {
      const secEnum  = SECTION_ENUM_MAP[sectionKey]
      const secLabel = SECTION_LABELS_GR[secEnum] ?? sectionKey
      const secColor = SECTION_COLORS[secEnum] ?? "374151"
      const qs       = dedupedQ.filter(q => q.section === secEnum)
      if (!qs.length) continue

      els.push(...subSectionHeader(secLabel, secColor))

      const headerBg = "EEF2FF"
      const qaRows: TableRow[] = [
        // Column headers
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: headerBg },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Ερώτηση", bold: true, size: 18, font: FONT, color: "4338CA" })] })],
            }),
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: headerBg },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Απάντηση", bold: true, size: 18, font: FONT, color: "4338CA" })] })],
            }),
          ],
        }),
        // Data rows
        ...qs.map((q, qi) => {
          const answerText = formatAnswer(answerByKey[q.key], q.type, q.options)
          const answered   = !!answerByKey[q.key]
          const rowBg      = qi % 2 === 0 ? "FFFFFF" : "FAFAFA"

          // For multi-line answers (DEVICE_LIST), split into multiple paragraphs
          const answerParas: Paragraph[] = answerText.split("\n").map((line, li, arr) =>
            new Paragraph({
              children: [new TextRun({
                text: line,
                size: 18, font: FONT,
                color: answered ? (li === 0 ? "111827" : "374151") : "9CA3AF",
                italics: !answered,
                bold: li === 0 && q.type === "DEVICE_LIST" && answered,
              })],
              spacing: { after: li < arr.length - 1 ? 60 : 0 },
            })
          )

          return new TableRow({
            children: [
              new TableCell({
                borders: thinBorders,
                shading: { type: ShadingType.SOLID, color: rowBg },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({
                  children: [new TextRun({ text: q.label, size: 18, font: FONT, color: "374151" })],
                })],
              }),
              new TableCell({
                borders: thinBorders,
                shading: { type: ShadingType.SOLID, color: rowBg },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: answerParas,
              }),
            ],
          })
        }),
      ]

      els.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: qaRows }))
    }
  }

  // ── SECTION 4: REQUIREMENTS & PROPOSED SOLUTIONS ──────────────────────────

  const grouped: Record<string, typeof requirements> = {}
  for (const r of requirements) {
    if (!grouped[r.section]) grouped[r.section] = []
    grouped[r.section].push(r)
  }
  const activeSections = SECTION_ORDER.filter(s => grouped[s]?.length)

  if (activeSections.length) {
    els.push(...sectionDivider("Απαιτήσεις Πελάτη & Προτεινόμενες Λύσεις", "1E3A5F"))

    for (const sec of activeSections) {
      const reqs     = grouped[sec]
      const secLabel = SECTION_LABELS_GR[sec] ?? sec
      const secColor = SECTION_COLORS[sec] ?? "374151"

      els.push(...subSectionHeader(secLabel, secColor))

      const reqRows: TableRow[] = [
        // Column headers with section color background
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: secColor },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: "Απαίτηση Πελάτη", bold: true, size: 18, font: FONT, color: "FFFFFF" })] })],
            }),
            new TableCell({
              width: { size: 62, type: WidthType.PERCENTAGE },
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: secColor },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: "Προτεινόμενη Λύση", bold: true, size: 18, font: FONT, color: "FFFFFF" })] })],
            }),
          ],
        }),
        // Requirement + response rows
        ...reqs.map((req, ri) => {
          const responseHtml = responseMap[req.id] ?? ""
          const responseParagraphs = htmlToParagraphs(responseHtml, { size: 18, spacing: 80 })
          const rowBg = ri % 2 === 0 ? "FFFFFF" : "FAFAFA"

          return new TableRow({
            children: [
              // Left: requirement
              new TableCell({
                borders: thinBorders,
                shading: { type: ShadingType.SOLID, color: rowBg },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: req.title, bold: true, size: 19, font: FONT, color: "1F2937" })],
                    spacing: { after: req.description ? 60 : 0 },
                  }),
                  ...(req.description ? [new Paragraph({
                    children: [new TextRun({ text: req.description, size: 17, font: FONT, color: "6B7280", italics: true })],
                  })] : []),
                ],
              }),
              // Right: proposed solution
              new TableCell({
                borders: thinBorders,
                shading: { type: ShadingType.SOLID, color: rowBg },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                children: responseParagraphs.length ? responseParagraphs : [
                  new Paragraph({
                    children: [new TextRun({ text: "Δεν έχει οριστεί απάντηση", size: 18, font: FONT, color: "9CA3AF", italics: true })],
                  }),
                ],
              }),
            ],
          })
        }),
      ]

      els.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: reqRows }))
    }
  }

  // ── SECTION 5: PROJECT TEAM ────────────────────────────────────────────────

  if (assigneeRows.length) {
    els.push(...sectionDivider("Ομάδα Έργου", "374151"))

    els.push(new Table({
      width: { size: 55, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: "1E3A5F" },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: "Όνομα", bold: true, size: 18, font: FONT, color: "FFFFFF" })] })],
            }),
            new TableCell({
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: "1E3A5F" },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: "Email", bold: true, size: 18, font: FONT, color: "FFFFFF" })] })],
            }),
          ],
        }),
        ...assigneeRows.map((a, ai) => new TableRow({
          children: [
            new TableCell({
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: ai % 2 === 0 ? "FFFFFF" : "F8FAFC" },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: a.name ?? "—", size: 18, font: FONT, color: "111827" })] })],
            }),
            new TableCell({
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: ai % 2 === 0 ? "FFFFFF" : "F8FAFC" },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: a.email, size: 18, font: FONT, color: "374151" })] })],
            }),
          ],
        })),
      ],
    }))
  }

  // ── Closing note ───────────────────────────────────────────────────────────

  els.push(
    new Paragraph({ text: "", spacing: { before: 480, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [new TableCell({
          borders: { ...noBorders, top: thin("E2E8F0") },
          shading: { type: ShadingType.SOLID, color: "F9FAFB" },
          margins: { top: 110, bottom: 110, left: 220, right: 220 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Το παρόν έγγραφο είναι εμπιστευτικό και απευθύνεται αποκλειστικά στον παραλήπτη.  ", size: 16, font: FONT, color: "9CA3AF", italics: true }),
              new TextRun({ text: `Εκδόθηκε: ${generatedDate}`, size: 16, font: FONT, color: "9CA3AF" }),
            ],
          })],
        })],
      })],
    }),
  )

  // ── 3. Assemble & pack ─────────────────────────────────────────────────────

  const doc = new Document({
    creator: "SoftOne Admin",
    title: proposal.title,
    description: `Τεχνική & Εμπορική Πρόταση — ${customerName}`,
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1.25),
            right:  convertInchesToTwip(1.25),
          },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 4 } },
            children: [
              new TextRun({ text: `${proposal.title}  |  `, size: 16, font: FONT, color: "9CA3AF" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT, color: "9CA3AF" }),
              new TextRun({ text: " / ", size: 16, font: FONT, color: "9CA3AF" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONT, color: "9CA3AF" }),
            ],
          })],
        }),
      },
      children: els,
    }],
  })

  const nodeBuffer = await Packer.toBuffer(doc)
  const buf = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength) as ArrayBuffer
  const filename = `proposal-${customerName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${surveyDate.replace(/\//g, "-")}.docx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
