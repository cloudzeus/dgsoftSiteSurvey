import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"
import { SoftwareType, WebCategory, DigitalToolType, IotTech } from "@prisma/client"
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType,
  Footer, PageNumber, convertInchesToTwip, ImageRun,
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

// 4-color palette: RED, DARK, GRAY, MUTED
const RED   = "B8020B"
const DARK  = "1E293B"
const GRAY  = "4B5563"
const MUTED = "9CA3AF"

// All sections share the same red accent
const SECTION_COLORS: Record<string, string> = {
  HARDWARE_NETWORK: RED,
  SOFTWARE:         RED,
  WEB_ECOMMERCE:    RED,
  COMPLIANCE:       RED,
  IOT_AI:           RED,
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

// Greek uppercase without tonos (Ά→Α etc.)
function upperNoTonos(s: string): string {
  return s.toUpperCase()
    .replace(/Ά/g, "Α").replace(/Έ/g, "Ε").replace(/Ή/g, "Η")
    .replace(/Ί/g, "Ι").replace(/Ό/g, "Ο").replace(/Ύ/g, "Υ").replace(/Ώ/g, "Ω")
    .replace(/ΐ/g, "Ι").replace(/ΰ/g, "Υ")
}

// ─── HTML → docx Paragraphs ───────────────────────────────────────────────────

function parseInlineHtml(html: string, size: number, color = "1F2937"): TextRun[] {
  if (!html) return []
  const src = html
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/<br\s*\/?>/gi, " ")

  const runs: TextRun[] = []
  const re = /<(\/?)(\w+)[^>]*>|([^<]+)/g
  let bold = false, underline = false
  let m: RegExpExecArray | null

  while ((m = re.exec(src)) !== null) {
    if (m[3] !== undefined) {
      const t = m[3]
      if (t) runs.push(new TextRun({
        text: t, bold, underline: underline ? {} : undefined,
        size, font: FONT, color,
      }))
    } else {
      const closing = m[1] === "/"
      const tag = m[2].toLowerCase()
      if (tag === "b" || tag === "strong") bold = !closing
      else if (tag === "u") underline = !closing
      // <i>/<em> intentionally ignored — no italics
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
          children: [new TextRun({ text: "• ", bold: true, size, font: FONT, color: RED }), ...runs],
          spacing: { after: 60 },
          indent: { left: 360 },
        }))
      }
    } else if (block.kind === "ol") {
      block.items.forEach((item, i) => {
        const runs = parseInlineHtml(item, size, color)
        if (runs.length) paras.push(new Paragraph({
          children: [new TextRun({ text: `${i + 1}. `, bold: true, size, font: FONT, color: RED }), ...runs],
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
              text: upperNoTonos(title),
              color: "FFFFFF", bold: true, size: 22, font: FONT, characterSpacing: 60,
            })],
          })],
        })],
      })],
    }),
    new Paragraph({ text: "", spacing: { before: 0, after: 220 } }),
  ]
}

function subSectionHeader(label: string, _color?: string): (Paragraph | Table)[] {
  return [
    new Paragraph({ text: "", spacing: { before: 280, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 1, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { type: ShadingType.SOLID, color: RED },
            children: [new Paragraph({ text: "" })],
          }),
          new TableCell({
            width: { size: 99, type: WidthType.PERCENTAGE },
            borders: { ...noBorders, bottom: thin("E2E8F0") },
            shading: { type: ShadingType.SOLID, color: "F8FAFC" },
            margins: { top: 80, bottom: 80, left: 180, right: 180 },
            children: [new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 22, font: FONT, color: DARK })],
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
          children: [new TextRun({ text: label, bold: true, size: 18, font: FONT, color: GRAY })],
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
            color: value ? DARK : MUTED,
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

  // ── 1b. Fetch company settings + logo ────────────────────────────────────

  const appSettings = await db.appSettings.findUnique({ where: { id: "singleton" } })
  const company = {
    name:      appSettings?.companyName ?? "",
    address:   appSettings?.address ?? "",
    city:      appSettings?.city ?? "",
    zip:       appSettings?.zip ?? "",
    phone:     appSettings?.phone ?? "",
    email:     appSettings?.email ?? "",
    website:   appSettings?.website ?? "",
    taxId:     appSettings?.taxId ?? "",
    taxOffice: appSettings?.taxOffice ?? "",
    logoUrl:   appSettings?.companyLogo ?? null,
  }

  let logoBuffer: Buffer | null = null
  let logoType: string = "png"
  if (company.logoUrl) {
    try {
      const ext = company.logoUrl.split(".").pop()?.toLowerCase() ?? ""
      if (ext === "webp") logoType = "webp"
      else if (ext === "jpg" || ext === "jpeg") logoType = "jpg"
      else logoType = "png"
      const res = await fetch(company.logoUrl)
      if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer())
    } catch { /* no logo — skip */ }
  }

  // ── 2. Build document elements ────────────────────────────────────────────

  const generatedDate = new Date().toLocaleDateString("el-GR")
  const surveyDate    = new Date(survey.date).toLocaleDateString("el-GR")
  const customerName  = survey.customer?.name ?? `#${survey.customerId}`
  const surveyorName  = survey.surveyor?.name ?? survey.surveyor?.email ?? "—"

  const els: (Paragraph | Table)[] = []

  // ── HEADER: Company details (left) + Logo (right) ─────────────────────────

  const companyAddrLine = [company.address, company.city, company.zip].filter(Boolean).join(", ")
  const companyInfoChildren: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: company.name, bold: true, size: 24, font: FONT, color: DARK })],
      spacing: { after: 60 },
    }),
    ...(companyAddrLine ? [new Paragraph({
      children: [new TextRun({ text: `Δ/ΝΣΗ: ${companyAddrLine}`, size: 18, font: FONT, color: GRAY })],
      spacing: { after: 40 },
    })] : []),
    ...(company.phone ? [new Paragraph({
      children: [new TextRun({ text: `Τηλ: ${company.phone}`, size: 18, font: FONT, color: GRAY })],
      spacing: { after: 40 },
    })] : []),
    ...((company.taxId || company.taxOffice) ? [new Paragraph({
      children: [new TextRun({
        text: [company.taxId ? `Α.Φ.Μ: ${company.taxId}` : "", company.taxOffice ? `ΔΟΥ: ${company.taxOffice}` : ""].filter(Boolean).join("   "),
        size: 18, font: FONT, color: GRAY,
      })],
      spacing: { after: 40 },
    })] : []),
    ...((company.email || company.website) ? [new Paragraph({
      children: [new TextRun({
        text: [company.email, company.website].filter(Boolean).join("   "),
        size: 18, font: FONT, color: GRAY,
      })],
      spacing: { after: 0 },
    })] : []),
  ]

  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        // Left: company details
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders: thinBorders,
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: companyInfoChildren.length ? companyInfoChildren : [new Paragraph({ text: "" })],
        }),
        // Right: logo
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          borders: thinBorders,
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: logoBuffer
              ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 72 }, type: logoType as any })]
              : [new TextRun({ text: company.name, bold: true, size: 28, font: FONT, color: DARK })],
            spacing: { before: 60, after: 60 },
          })],
        }),
      ],
    })],
  }))

  // ── PROPOSAL REFERENCE STRIP ───────────────────────────────────────────────

  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.SOLID, color: "1E293B" },
        borders: noBorders,
        margins: { top: 80, bottom: 80, left: 200, right: 200 },
        children: [new Paragraph({
          children: [
            new TextRun({ text: "Αριθμός: ", bold: true, size: 18, font: FONT, color: MUTED }),
            new TextRun({ text: proposal.title, bold: true, size: 18, font: FONT, color: "FFFFFF" }),
            new TextRun({ text: "        Ημερ/νία: ", bold: true, size: 18, font: FONT, color: MUTED }),
            new TextRun({ text: surveyDate, bold: true, size: 18, font: FONT, color: "FFFFFF" }),
            new TextRun({ text: "        Κατάσταση: ", bold: true, size: 18, font: FONT, color: MUTED }),
            new TextRun({ text: PROPOSAL_STATUS_GR[proposal.status] ?? proposal.status, bold: true, size: 18, font: FONT, color: "FFFFFF" }),
          ],
        })],
      })],
    })],
  }))

  // ── CUSTOMER DETAILS (invoice style) ──────────────────────────────────────

  const custRows: TableRow[] = [infoRow("Επωνυμία", customerName)]
  const custAddr = [survey.customer?.address, survey.customer?.city, survey.customer?.zip].filter(Boolean).join(", ")
  if (custAddr)                        custRows.push(infoRow("Διεύθυνση", custAddr))
  const phones = [survey.customer?.phone01, survey.customer?.phone02].filter(Boolean).join(" / ")
  if (phones)                          custRows.push(infoRow("Τηλ.", phones))
  if (survey.customer?.afm)            custRows.push(infoRow("Α.Φ.Μ / Δ.Ο.Υ.", survey.customer.afm))
  if (survey.customer?.email)          custRows.push(infoRow("Email", survey.customer.email))
  if (survey.customer?.webpage)        custRows.push(infoRow("Ιστοσελίδα", survey.customer.webpage))
  if (survey.customer?.jobtypetrd)     custRows.push(infoRow("Κλάδος", survey.customer.jobtypetrd))
  custRows.push(infoRow("Τεχνικός", surveyorName))

  els.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: custRows }))

  // Proposal subject row
  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          borders: thinBorders,
          shading: { type: ShadingType.SOLID, color: "F8FAFC" },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: "Θέμα", bold: true, size: 18, font: FONT, color: GRAY })] })],
        }),
        new TableCell({
          width: { size: 72, type: WidthType.PERCENTAGE },
          borders: thinBorders,
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: proposal.title, bold: true, size: 18, font: FONT, color: DARK })] })],
        }),
      ],
    })],
  }))

  // ── SECTION 2: EXECUTIVE SUMMARY ──────────────────────────────────────────

  if (proposal.description?.trim()) {
    els.push(...sectionDivider("Εκτελεστική Σύνοψη", DARK))
    const descParas = htmlToParagraphs(proposal.description, { size: 21, spacing: 160 })
    els.push(...(descParas.length ? descParas : [
      new Paragraph({ children: [new TextRun({ text: "—", size: 20, font: FONT, color: MUTED })] }),
    ]))
  }

  // ── SECTION 3: TECHNICAL SURVEY FINDINGS ──────────────────────────────────

  if (sectionKeys.length && dedupedQ.length) {
    els.push(...sectionDivider("Τεχνικά Ευρήματα Έρευνας", DARK))

    for (const sectionKey of sectionKeys) {
      const secEnum  = SECTION_ENUM_MAP[sectionKey]
      const secLabel = SECTION_LABELS_GR[secEnum] ?? sectionKey
      const secColor = SECTION_COLORS[secEnum] ?? "374151"
      const qs       = dedupedQ.filter(q => q.section === secEnum)
      if (!qs.length) continue

      els.push(...subSectionHeader(secLabel, secColor))

      const headerBg = "F1F5F9"
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
              children: [new Paragraph({ children: [new TextRun({ text: "Ερώτηση", bold: true, size: 18, font: FONT, color: DARK })] })],
            }),
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: headerBg },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Απάντηση", bold: true, size: 18, font: FONT, color: DARK })] })],
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
                color: answered ? DARK : MUTED,
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
                  children: [new TextRun({ text: q.label, size: 18, font: FONT, color: GRAY })],
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

  // ── SECTION 4: REQUIREMENTS & PROPOSED SOLUTIONS (card style) ────────────

  const grouped: Record<string, typeof requirements> = {}
  for (const r of requirements) {
    if (!grouped[r.section]) grouped[r.section] = []
    grouped[r.section].push(r)
  }
  const activeSections = SECTION_ORDER.filter(s => grouped[s]?.length)

  if (activeSections.length) {
    els.push(...sectionDivider("Απαιτήσεις Πελάτη & Προτεινομενες Λυσεις", DARK))

    for (const sec of activeSections) {
      const reqs     = grouped[sec]
      const secLabel = SECTION_LABELS_GR[sec] ?? sec
      const secColor = SECTION_COLORS[sec] ?? "374151"

      for (const req of reqs) {
        const responseHtml = responseMap[req.id] ?? ""

        // ● Section label row (colored dot + label)
        els.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({
            children: [
              new TableCell({
                width: { size: 3, type: WidthType.PERCENTAGE },
                borders: noBorders,
                shading: { type: ShadingType.SOLID, color: secColor },
                children: [new Paragraph({ text: "" })],
              }),
              new TableCell({
                width: { size: 97, type: WidthType.PERCENTAGE },
                borders: { ...noBorders, bottom: thin("E2E8F0") },
                margins: { top: 60, bottom: 60, left: 180, right: 180 },
                children: [new Paragraph({
                  children: [new TextRun({
                    text: upperNoTonos(secLabel),
                    bold: true, size: 19, font: FONT, color: RED,
                  })],
                })],
              }),
            ],
          })],
        }))

        // Requirement title row (bordered, light bg)
        els.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({
            children: [new TableCell({
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: "F8FAFC" },
              margins: { top: 100, bottom: 100, left: 180, right: 180 },
              children: [new Paragraph({
                children: [new TextRun({
                  text: req.title,
                  bold: true, size: 22, font: FONT, color: "1E293B",
                })],
              })],
            })],
          })],
        }))

        // Description (if any)
        if (req.description?.trim()) {
          els.push(new Paragraph({
            children: [new TextRun({
              text: req.description,
              size: 18, font: FONT, color: GRAY,
            })],
            spacing: { before: 100, after: 80 },
            indent: { left: 200 },
          }))
        }

        // Proposed solution
        const solutionParas = htmlToParagraphs(responseHtml, { size: 19, spacing: 100, indent: 200 })
        if (solutionParas.length) {
          els.push(...solutionParas)
        } else {
          els.push(new Paragraph({
            children: [new TextRun({ text: "—", size: 18, font: FONT, color: MUTED })],
            spacing: { before: 80, after: 0 },
            indent: { left: 200 },
          }))
        }

        els.push(new Paragraph({ text: "", spacing: { before: 160, after: 0 } }))
      }
    }
  }

  // ── SECTION 5: PROJECT TEAM ────────────────────────────────────────────────

  if (assigneeRows.length) {
    els.push(...sectionDivider("Ομάδα Έργου", DARK))

    els.push(new Table({
      width: { size: 55, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: DARK },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: "Όνομα", bold: true, size: 18, font: FONT, color: "FFFFFF" })] })],
            }),
            new TableCell({
              borders: thinBorders,
              shading: { type: ShadingType.SOLID, color: DARK },
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
              children: [new Paragraph({ children: [new TextRun({ text: a.name ?? "—", size: 18, font: FONT, color: DARK })] })],
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
              new TextRun({ text: "Το παρόν έγγραφο είναι εμπιστευτικό και απευθύνεται αποκλειστικά στον παραλήπτη.  ", size: 16, font: FONT, color: MUTED }),
              new TextRun({ text: `Εκδόθηκε: ${generatedDate}`, size: 16, font: FONT, color: MUTED }),
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
              new TextRun({ text: `${proposal.title}  |  `, size: 16, font: FONT, color: MUTED }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT, color: MUTED }),
              new TextRun({ text: " / ", size: 16, font: FONT, color: MUTED }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONT, color: MUTED }),
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
