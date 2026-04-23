import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bunnyUpload } from "@/lib/bunny"
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType,
  Footer, PageNumber, convertInchesToTwip,
} from "docx"

type Params = { params: Promise<{ id: string }> }

const FONT      = "Calibri"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const DARK  = "1E293B"
const GRAY  = "4B5563"
const MUTED = "9CA3AF"
const LIGHT = "F8FAFC"

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
const thin = (c = "E2E8F0"): { style: typeof BorderStyle.SINGLE; size: number; color: string } =>
  ({ style: BorderStyle.SINGLE, size: 4, color: c })

const SECTION_ACCENT: Record<string, string> = {
  HARDWARE_NETWORK: "0369A1",
  SOFTWARE:         "6D28D9",
  WEB_ECOMMERCE:    "1D4ED8",
  IOT_AI:           "0F766E",
  COMPLIANCE:       "BE123C",
}

const GREEK_MAP: Record<string, string> = {
  α:"a",β:"v",γ:"g",δ:"d",ε:"e",ζ:"z",η:"i",θ:"th",ι:"i",κ:"k",λ:"l",μ:"m",
  ν:"n",ξ:"x",ο:"o",π:"p",ρ:"r",σ:"s",ς:"s",τ:"t",υ:"y",φ:"f",χ:"ch",ψ:"ps",ω:"o",
  Α:"A",Β:"V",Γ:"G",Δ:"D",Ε:"E",Ζ:"Z",Η:"I",Θ:"TH",Ι:"I",Κ:"K",Λ:"L",Μ:"M",
  Ν:"N",Ξ:"X",Ο:"O",Π:"P",Ρ:"R",Σ:"S",Τ:"T",Υ:"Y",Φ:"F",Χ:"CH",Ψ:"PS",Ω:"O",
}
function slugify(text: string): string {
  return text.split("").map(c => GREEK_MAP[c] ?? c).join("")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()
}
function upperNoTonos(s: string): string {
  return s.toUpperCase()
    .replace(/Ά/g,"Α").replace(/Έ/g,"Ε").replace(/Ή/g,"Η")
    .replace(/Ί/g,"Ι").replace(/Ό/g,"Ο").replace(/Ύ/g,"Υ").replace(/Ώ/g,"Ω")
}

function textToParagraphs(text: string, accent: string): Paragraph[] {
  if (!text?.trim()) return []
  const paras: Paragraph[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const isBullet  = trimmed.startsWith("•") || trimmed.startsWith("-")
    const numMatch  = trimmed.match(/^(\d+[\.\)])\s*/)
    if (isBullet) {
      paras.push(new Paragraph({
        children: [
          new TextRun({ text: "• ", bold: true, size: 20, font: FONT, color: accent }),
          new TextRun({ text: trimmed.slice(1).trim(), size: 20, font: FONT, color: DARK }),
        ],
        spacing: { after: 60 },
        indent: { left: 280 },
      }))
    } else if (numMatch) {
      paras.push(new Paragraph({
        children: [
          new TextRun({ text: numMatch[1] + " ", bold: true, size: 20, font: FONT, color: accent }),
          new TextRun({ text: trimmed.slice(numMatch[0].length), size: 20, font: FONT, color: DARK }),
        ],
        spacing: { after: 60 },
        indent: { left: 280 },
      }))
    } else {
      paras.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 20, font: FONT, color: DARK })],
        spacing: { after: 120 },
      }))
    }
  }
  return paras
}

function sectionHeader(title: string, accent: string): (Paragraph | Table)[] {
  return [
    new Paragraph({ text: "", spacing: { before: 560, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 1, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { type: ShadingType.SOLID, color: accent },
            children: [new Paragraph({ text: "" })],
          }),
          new TableCell({
            width: { size: 99, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { type: ShadingType.SOLID, color: accent },
            margins: { top: 140, bottom: 140, left: 220, right: 220 },
            children: [new Paragraph({
              children: [new TextRun({
                text: upperNoTonos(title),
                color: "FFFFFF", bold: true, size: 26, font: FONT, characterSpacing: 40,
              })],
            })],
          }),
        ],
      })],
    }),
    new Paragraph({ text: "", spacing: { before: 0, after: 200 } }),
  ]
}

function subHeading(text: string, accent: string): (Paragraph | Table)[] {
  return [
    new Paragraph({ text: "", spacing: { before: 320, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 1, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { type: ShadingType.SOLID, color: accent },
            children: [new Paragraph({ text: "" })],
          }),
          new TableCell({
            width: { size: 99, type: WidthType.PERCENTAGE },
            borders: { ...noBorders, bottom: thin("E2E8F0") },
            shading: { type: ShadingType.SOLID, color: LIGHT },
            margins: { top: 80, bottom: 80, left: 180, right: 180 },
            children: [new Paragraph({
              children: [new TextRun({ text, bold: true, size: 22, font: FONT, color: DARK })],
            })],
          }),
        ],
      })],
    }),
    new Paragraph({ text: "", spacing: { before: 0, after: 100 } }),
  ]
}

// ─── POST /api/site-surveys/:id/ai-analysis/export ────────────────────────────

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const surveyId = Number(id)
    if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

    const body = await req.json() as {
      customerName: string
      surveyName: string
      generatedAt: string
      analyses: {
        section: string
        label: string
        currentSituation: string
        gaps: string
        proposals: string
        ideas: string
      }[]
    }

    if (!body.analyses?.length) {
      return NextResponse.json({ error: "No analyses provided" }, { status: 400 })
    }

    const survey = await db.siteSurvey.findUnique({
      where: { id: surveyId },
      include: { customer: { select: { id: true, name: true } } },
    })
    if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })
    if (!survey.customer) return NextResponse.json({ error: "Survey has no customer" }, { status: 400 })

    const appSettings = await db.appSettings.findUnique({ where: { id: "singleton" } })
    const companyName = appSettings?.companyName ?? ""

    const generatedDate = new Date(body.generatedAt).toLocaleDateString("el-GR")
    const els: (Paragraph | Table)[] = []

    // ── Cover header ────────────────────────────────────────────────────────

    els.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: DARK },
          borders: noBorders,
          margins: { top: 280, bottom: 280, left: 300, right: 300 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "ΑΝΑΛΥΣΗ ΤΕΧΝΙΚΗΣ ΕΡΕΥΝΑΣ", bold: true, size: 36, font: FONT, color: "FFFFFF", characterSpacing: 60 })],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "Έκθεση Αξιολόγησης & Προτάσεις Αναβάθμισης", size: 22, font: FONT, color: "C0C8D8" })],
              spacing: { after: 120 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Πελάτης: ", size: 20, font: FONT, color: MUTED }),
                new TextRun({ text: body.customerName, bold: true, size: 20, font: FONT, color: "FFFFFF" }),
                new TextRun({ text: "     Ημερομηνία: ", size: 20, font: FONT, color: MUTED }),
                new TextRun({ text: generatedDate, bold: true, size: 20, font: FONT, color: "FFFFFF" }),
              ],
            }),
          ],
        })],
      })],
    }))

    els.push(new Paragraph({ text: "", spacing: { before: 480, after: 0 } }))

    // ── Per-section analyses ────────────────────────────────────────────────

    for (const analysis of body.analyses) {
      const accent = SECTION_ACCENT[analysis.section] ?? "0078D4"
      els.push(...sectionHeader(analysis.label, accent))
      if (analysis.currentSituation?.trim()) {
        els.push(...subHeading("Τρέχουσα Κατάσταση", accent))
        els.push(...textToParagraphs(analysis.currentSituation, accent))
      }
      if (analysis.gaps?.trim()) {
        els.push(...subHeading("Εντοπισμένα Κενά & Αδυναμίες", accent))
        els.push(...textToParagraphs(analysis.gaps, accent))
      }
      if (analysis.proposals?.trim()) {
        els.push(...subHeading("Προτεινόμενες Βελτιώσεις", accent))
        els.push(...textToParagraphs(analysis.proposals, accent))
      }
      if (analysis.ideas?.trim()) {
        els.push(...subHeading("Ιδέες για Αναβάθμιση", accent))
        els.push(...textToParagraphs(analysis.ideas, accent))
      }
    }

    // ── Footer note ─────────────────────────────────────────────────────────

    els.push(
      new Paragraph({ text: "", spacing: { before: 560, after: 0 } }),
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
                new TextRun({ text: "Το παρόν έγγραφο δημιουργήθηκε αυτόματα με τεχνητή νοημοσύνη βάσει των αποτελεσμάτων της τεχνικής έρευνας.  ", size: 16, font: FONT, color: MUTED }),
                new TextRun({ text: `Εκδόθηκε: ${generatedDate}`, size: 16, font: FONT, color: MUTED }),
              ],
            })],
          })],
        })],
      }),
    )

    // ── Build DOCX ──────────────────────────────────────────────────────────

    const doc = new Document({
      creator: companyName || "SoftOne Admin",
      title: `Ανάλυση AI — ${body.customerName}`,
      description: `Έκθεση αξιολόγησης AI για ${body.surveyName}`,
      styles: { default: { document: { run: { font: FONT, size: 20 } } } },
      sections: [{
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1.2),
              right:  convertInchesToTwip(1.2),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 4 } },
              children: [
                new TextRun({ text: `${body.customerName}  |  Ανάλυση AI  |  `, size: 16, font: FONT, color: MUTED }),
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

    // ── Upload to Bunny + create File record ────────────────────────────────

    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`
    const customerSlug = slugify(body.customerName)
    const filename = `ai-analysis_${customerSlug}_${ts}.docx`
    const bunnyPath = `site-surveys/${surveyId}/${filename}`

    const cdnUrl = await bunnyUpload(bunnyPath, nodeBuffer, DOCX_MIME)

    await db.file.create({
      data: {
        customerId: survey.customer.id,
        surveyId,
        section: "ai-analysis",
        type: "ai-analysis-export",
        name: filename,
        cdnUrl,
        bunnyPath,
        mimeType: DOCX_MIME,
        size: nodeBuffer.byteLength,
        uploadedBy: "system",
      },
    })

    return NextResponse.json({ cdnUrl, filename })
  } catch (e) {
    console.error("[ai-analysis/export]", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
