import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

// ─── Language rules ───────────────────────────────────────────────────────────

const LANGUAGE_RULES = `
ΚΑΝΟΝΕΣ ΓΛΩΣΣΑΣ — ακολούθησέ τους αυστηρά:
1. Γράφε αποκλειστικά σε επίσημα Νέα Ελληνικά με ορθή γραμματική και σύνταξη.
2. ΑΠΑΓΟΡΕΥΕΤΑΙ η ελληνικοποίηση αγγλικών λέξεων (π.χ. γράφε "διακομιστής" όχι "σέρβερ", "δρομολογητής" όχι "ρούτερ", "μεταγωγέας" όχι "σουίτς", "αντίγραφο ασφαλείας" όχι "μπάκαπ", "διαδίκτυο" όχι "ίντερνετ").
3. Τεχνικά ακρωνύμια και διεθνώς καθιερωμένοι όροι (ERP, CRM, GDPR, Wi-Fi, UPS, SEO, API, IoT, NIS2, ISO) γράφονται ως έχουν στα Λατινικά.
4. Το κείμενο απευθύνεται στον πελάτη — να είναι κατανοητό, περιεκτικό και να εξηγεί την αξία ή τον σκοπό.
5. Χρησιμοποίησε ενεργητική σύνταξη. Απόφυγε παθητική φωνή και γραφειοκρατική γλώσσα.
`.trim()

// ─── Next.js preferred stack — injected into WEB & SOFTWARE sections ──────────

const NEXTJS_STACK_RULES = `
ΠΡΟΤΙΜΗΤΕΟ ΤΕΧΝΟΛΟΓΙΚΟ ΠΛΑΙΣΙΟ — εφάρμοζε αυστηρά στις προτάσεις σου:
• Για ΟΠΟΙΑΔΗΠΟΤΕ web εφαρμογή, eshop, portal ή SaaS: το προτιμητέο framework είναι Next.js 16+ (App Router, Server Components, Server Actions, Turbopack).
• Next.js ecosystem: Tailwind CSS 4, shadcn/ui, Prisma ORM, NextAuth v5 / Auth.js, Vercel / self-hosted Node.js.
• Eshop/e-commerce: Medusa.js (headless commerce) + Next.js storefront, ή WooCommerce headless με Next.js frontend.
• CMS / content: Contentful, Sanity, Payload CMS — όλα με Next.js frontend.
• Real-time / WebSockets: Pusher, Ably, ή Next.js + Socket.io.
• Payments: Stripe (τυπικό), Viva Wallet (ελληνική αγορά) — ενσωμάτωση μέσω Next.js API routes / Server Actions.
• Email: Resend + React Email templates.
• Search: Algolia ή Meilisearch με Next.js.
• Analytics: Plausible (GDPR-compliant), Vercel Analytics.
• Maps: Leaflet ή Google Maps API με Next.js.
• AI features: Vercel AI SDK με Claude (Anthropic) ή OpenAI — native Next.js streaming.
• Hosting: Vercel (1η επιλογή), Railway, ή VPS με Docker + Nginx.
• ΠΟΤΕ μην προτείνεις: WordPress (εκτός αν ζητηθεί ρητά), PHP custom, jQuery-based stacks, ή Angular/Vue αν υπάρχει Next.js εναλλακτική.
• Αν υπάρχει απαίτηση για ERP/CRM ενοποίηση: χρησιμοποίησε Next.js API routes ως middleware layer.
`.trim()

// ─── Section expert personas ──────────────────────────────────────────────────

const SECTION_EXPERTS: Record<string, string> = {
  HARDWARE_NETWORK: `Είσαι ανώτερος σύμβουλος πληροφορικής με 20+ χρόνια εμπειρία στις υποδομές εξοπλισμού και δικτύων επιχειρήσεων. Εξειδικεύεσαι σε διακομιστές, δρομολογητές, μεταγωγείς, τείχη προστασίας, UPS, δομημένη καλωδίωση και ασύρματα δίκτυα. Αξιολογείς υποδομές επιχειρήσεων και συντάσσεις εκθέσεις κατάστασης και προτάσεις αναβάθμισης.\n${LANGUAGE_RULES}`,

  SOFTWARE: `Είσαι ανώτερος σύμβουλος επιχειρησιακών εφαρμογών με 20+ χρόνια εμπειρία σε ERP, CRM, λογιστικά συστήματα και επαγγελματικό λογισμικό. Αξιολογείς λογισμικό, άδειες χρήσης, ενοποιήσεις συστημάτων και παραγωγικότητα. Συντάσσεις εκθέσεις κατάστασης και προτάσεις εκσυγχρονισμού. Για οποιοδήποτε web-facing module ή custom εφαρμογή, το προτιμητέο framework είναι Next.js 16+.\n${LANGUAGE_RULES}\n\n${NEXTJS_STACK_RULES}`,

  WEB_ECOMMERCE: `Είσαι ανώτερος σύμβουλος ψηφιακής παρουσίας και ηλεκτρονικού εμπορίου με 20+ χρόνια εμπειρία σε ιστοτόπους, ηλεκτρονικά καταστήματα, SEO, ψηφιακό μάρκετινγκ και ψηφιακές πληρωμές. Χρησιμοποιείς Next.js 16+ ως το βασικό framework για ΟΛΕΣ τις web εφαρμογές — eshop, portal, landing pages, B2B platforms. Αξιολογείς ψηφιακή παρουσία επιχειρήσεων και συντάσσεις εκθέσεις κατάστασης και στρατηγικές βελτίωσης.\n${LANGUAGE_RULES}\n\n${NEXTJS_STACK_RULES}`,

  IOT_AI: `Είσαι ανώτερος σύμβουλος ψηφιακού μετασχηματισμού με 20+ χρόνια εμπειρία σε συστήματα IoT, αυτοματισμούς και εφαρμογές τεχνητής νοημοσύνης για επιχειρήσεις. Αξιολογείς ψηφιακή ετοιμότητα και συντάσσεις εκθέσεις κατάστασης και προτάσεις εκσυγχρονισμού.\n${LANGUAGE_RULES}`,

  COMPLIANCE: `Είσαι ανώτερος σύμβουλος κανονιστικής συμμόρφωσης και ασφάλειας πληροφοριών με 20+ χρόνια εμπειρία σε GDPR, NIS2, ISO 27001 και κυβερνοασφάλεια. Αξιολογείς επίπεδο συμμόρφωσης επιχειρήσεων και συντάσσεις εκθέσεις κινδύνου και πλάνα αποκατάστασης.\n${LANGUAGE_RULES}`,
}

const SECTION_LABELS_GR: Record<string, string> = {
  HARDWARE_NETWORK: "Υποδομή & Δίκτυα",
  SOFTWARE: "Λογισμικό",
  WEB_ECOMMERCE: "Διαδίκτυο & E-commerce",
  COMPLIANCE: "Συμμόρφωση",
  IOT_AI: "IoT & Τεχνητή Νοημοσύνη",
}

const SECTION_ENUM_MAP: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software: "SOFTWARE",
  web_ecommerce: "WEB_ECOMMERCE",
  compliance: "COMPLIANCE",
  iot_ai: "IOT_AI",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAnswer(answerValue: string | null, type: string): string {
  if (!answerValue) return "Δεν απαντήθηκε"
  if (type === "BOOLEAN") return answerValue === "true" ? "Ναι" : "Όχι"
  if (type === "DEVICE_LIST") {
    try {
      const d = JSON.parse(answerValue)
      if (Array.isArray(d) && d.length) {
        return d.map((x: { brand?: string; model?: string; serial?: string; location?: string }) =>
          [x.brand, x.model].filter(Boolean).join(" ") + (x.serial ? ` (S/N: ${x.serial})` : "") + (x.location ? ` — ${x.location}` : "")
        ).join("; ")
      }
    } catch { /* ignore */ }
    return answerValue
  }
  if (type === "MULTI_SELECT") {
    try {
      const ids = JSON.parse(answerValue)
      return Array.isArray(ids) ? ids.join(", ") : answerValue
    } catch { return answerValue }
  }
  return answerValue
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .trim()
}

// ─── POST /api/site-surveys/:id/ai-analysis ───────────────────────────────────
// Body: { section?: string } — if omitted, analyses all survey sections.

export async function POST(req: Request, { params }: Params) {
  try {
  const { id } = await params
  const surveyId = Number(id)
  if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  // Optional: caller can request a single section key (e.g. "hardware_network")
  let requestedSection: string | null = null
  try {
    const body = await req.json() as { section?: string }
    requestedSection = body.section ?? null
  } catch { /* body is optional */ }

  // ── 1. Load survey + customer + results ──────────────────────────────────

  const survey = await db.siteSurvey.findUnique({
    where: { id: surveyId },
    include: {
      customer: {
        select: {
          name: true, afm: true, address: true, city: true, zip: true,
          phone01: true, email: true, webpage: true, jobtypetrd: true,
        },
      },
      surveyor: { select: { name: true, email: true } },
    },
  })
  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  let sectionKeys: string[] = Array.isArray(survey.sections) ? survey.sections as string[] : []
  if (!sectionKeys.length) return NextResponse.json({ error: "Survey has no sections" }, { status: 400 })

  // If a single section was requested, filter to just that one
  if (requestedSection) {
    sectionKeys = sectionKeys.filter(k => k === requestedSection)
    if (!sectionKeys.length) return NextResponse.json({ error: "Section not found in survey" }, { status: 400 })
  }

  const sectionEnums = sectionKeys.map(k => SECTION_ENUM_MAP[k]).filter(Boolean)

  // Load questions for this survey's sections
  const questions = await db.surveyQuestion.findMany({
    where: { isActive: true, section: { in: sectionEnums as any[] } },
    orderBy: [{ section: "asc" }, { order: "asc" }],
  })

  // Load answers
  const results = await db.surveyResult.findMany({
    where: { surveyId },
    include: { question: { select: { key: true, label: true, type: true } } },
  })
  const answerByKey: Record<string, { label: string; value: string; type: string }> = {}
  for (const r of results) {
    if (r.answerValue) {
      answerByKey[r.question.key] = {
        label: r.question.label,
        value: r.answerValue,
        type: r.question.type,
      }
    }
  }

  // ── 2. Load client requirements + company suggestions for this survey ───

  const allRequirements = await db.$queryRaw<{
    id: number; section: string; source: string; title: string; description: string | null
  }[]>`
    SELECT id, section, source, title, description FROM ClientRequirement
    WHERE surveyId = ${surveyId}
    ORDER BY FIELD(section,'HARDWARE_NETWORK','SOFTWARE','WEB_ECOMMERCE','COMPLIANCE','IOT_AI'), source, id
  `

  const requirements        = allRequirements.filter(r => r.source !== "COMPANY")
  const companySuggestions  = allRequirements.filter(r => r.source === "COMPANY")

  // ── 3. Load DeepSeek credentials ─────────────────────────────────────────

  const conn = await db.connection.findFirst({
    where: { type: "DEEPSEEK", isActive: true },
    select: { credentials: true },
  })
  if (!conn) return NextResponse.json({ error: "No active DeepSeek connection found" }, { status: 503 })

  const apiKey = (conn.credentials as Record<string, string>).apiKey

  // ── 4. Build context for each section ────────────────────────────────────

  const customerName   = survey.customer?.name ?? `Πελάτης #${survey.customerId}`
  const customerSector = survey.customer?.jobtypetrd ?? "Μη καθορισμένος κλάδος"
  const customerAddr   = [survey.customer?.city, survey.customer?.zip].filter(Boolean).join(", ")

  const ESTIMATION_SECTIONS = new Set(["SOFTWARE", "WEB_ECOMMERCE"])

  async function analyzeSection(sectionEnum: string): Promise<{
    section: string
    label: string
    currentSituation: string
    gaps: string
    proposals: string
    ideas: string
    estimation: string
    services: string
  }> {
    const qs    = questions.filter(q => q.section === sectionEnum)
    const label = SECTION_LABELS_GR[sectionEnum] ?? sectionEnum

    // Survey Q&A for this section
    const qaLines = qs.map(q => {
      const a = answerByKey[q.key]
      const answerText = a ? formatAnswer(a.value, a.type) : "Δεν απαντήθηκε"
      return `  • ${q.label}: ${answerText}`
    }).join("\n")

    // Customer requirements declared for this section
    const sectionReqs = requirements.filter(r => r.section === sectionEnum)
    const reqLines = sectionReqs.length
      ? sectionReqs.map((r, i) =>
          `  ${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`
        ).join("\n")
      : "  (Δεν έχουν καταχωρηθεί απαιτήσεις πελάτη για αυτή την ενότητα)"

    // Company suggestions (internal expert input) for this section
    const sectionCompSuggs = companySuggestions.filter(r => r.section === sectionEnum)
    const compSuggLines = sectionCompSuggs.length
      ? sectionCompSuggs.map((r, i) =>
          `  ${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`
        ).join("\n")
      : ""

    const contextBlock = [
      `=== ΣΤΟΙΧΕΙΑ ΕΠΙΧΕΙΡΗΣΗΣ ===`,
      `Επωνυμία: ${customerName}`,
      `Κλάδος: ${customerSector}`,
      ...(customerAddr ? [`Πόλη: ${customerAddr}`] : []),
      ``,
      `=== ΑΠΟΤΕΛΕΣΜΑΤΑ ΕΡΕΥΝΑΣ — ${label.toUpperCase()} ===`,
      qaLines || "  (Δεν συμπληρώθηκαν ερωτήσεις σε αυτή την ενότητα)",
      ``,
      `=== ΑΙΤΗΜΑΤΑ ΠΕΛΑΤΗ — ${label.toUpperCase()} ===`,
      reqLines,
      ...(compSuggLines ? [
        ``,
        `=== ΕΣΩΤΕΡΙΚΕΣ ΠΡΟΤΑΣΕΙΣ ΕΤΑΙΡΕΙΑΣ — ${label.toUpperCase()} ===`,
        `(Αυτές είναι οι δικές μας τεχνικές εκτιμήσεις που πρέπει να ενσωματωθούν στην ανάλυση και τις προτάσεις)`,
        compSuggLines,
      ] : []),
    ].join("\n")

    const systemPrompt = SECTION_EXPERTS[sectionEnum] ?? `Είσαι σύμβουλος πληροφορικής.\n${LANGUAGE_RULES}`
    const hasReqs      = sectionReqs.length > 0
    const hasCompSugg  = sectionCompSuggs.length > 0
    const hasEstimation = ESTIMATION_SECTIONS.has(sectionEnum)

    const intro = `Εταιρεία: «${customerName}» | Κλάδος: ${customerSector} | Τομέας: ${label}`

    // ── One focused DeepSeek call per ΤΜΗΜΑ — each gets its own token budget ──

    async function askDeepSeek(instruction: string, maxTokens: number, extraContext = ""): Promise<string> {
      const userMsg = [contextBlock, extraContext, "", instruction].filter(Boolean).join("\n\n")
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
          max_tokens: maxTokens,
          temperature: 0.75,
        }),
      })
      if (!res.ok) throw new Error(`DeepSeek (${sectionEnum}): ${await res.text()}`)
      const d = await res.json() as { choices: { message: { content: string } }[] }
      return d.choices?.[0]?.message?.content?.trim() ?? ""
    }

    // ΤΜΗΜΑ 1 — Current Situation (4 000 tokens)
    const currentSituation = stripMarkdown(await askDeepSeek([
      `${intro}`,
      `Γράψε ΕΚΤΕΝΗ ΠΕΡΙΓΡΑΦΗ ΤΡΕΧΟΥΣΑΣ ΚΑΤΑΣΤΑΣΗΣ (6-8 πλούσιες παραγράφους) για τον τομέα «${label}».`,
      `• Ξεκίνα με ολιστικό portrait: τι λειτουργεί καλά, ποια φιλοσοφία διέπει τη διαχείριση του τομέα.`,
      `• Περιέγραψε αναλυτικά κάθε στοιχείο που αποκάλυψε η έρευνα: εξοπλισμός, συστήματα, διαδικασίες, άνθρωποι.`,
      `• Αξιολόγησε επίπεδο ωριμότητας (χαμηλό/μεσαίο/υψηλό) με τεκμήρια.`,
      `• Επισήμανε ανακολουθίες ή παράδοξα από τα δεδομένα.`,
      `• Κλείσε με πρόταση-αφετηρία για το επόμενο βήμα.`,
      `Μόνο κείμενο παραγράφων — χωρίς τίτλους ενότητας.`,
    ].join("\n"), 4000))

    // ΤΜΗΜΑ 2 — Gaps & Weaknesses (3 500 tokens)
    const gaps = stripMarkdown(await askDeepSeek([
      `${intro}`,
      `Γράψε ΑΝΑΛΥΤΙΚΗ ΚΑΤΑΓΡΑΦΗ ΚΕΝΩΝ ΚΑΙ ΑΔΥΝΑΜΙΩΝ για τον τομέα «${label}» με έντονο εμπορικό τόνο.`,
      `Κατέγραψε 6-8 κενά/αδυναμίες σε αριθμημένη λίστα. Για ΚΑΘΕ ένα:`,
      `1. Τίτλος κενού — δυναμικός και σαφής`,
      `2. Τι ακριβώς λείπει ή λειτουργεί ελλιπώς — με συγκεκριμένα παραδείγματα`,
      `3. Ο επιχειρηματικός αντίκτυπος: χαμένα έσοδα, αυξημένο κόστος, ρίσκο, ανταγωνιστικό μειονέκτημα`,
      `4. Η επείγουσα ανάγκη αντιμετώπισης — τι συμβαίνει αν δεν γίνει τίποτα`,
      hasReqs ? `5. Σύνδεση με δηλωμένο αίτημα πελάτη όπου αρμόζει.` : ``,
      `Ύφος: επαγγελματικό αλλά πειστικό — ο αναγνώστης να αισθάνεται την ανάγκη αλλαγής. Μόνο αριθμημένη λίστα.`,
    ].filter(Boolean).join("\n"), 3500))

    // ΤΜΗΜΑ 3 — Proposals (5 000 tokens — largest, include all reqs + comp suggestions)
    const isWebSoftware = sectionEnum === "WEB_ECOMMERCE" || sectionEnum === "SOFTWARE"
    const proposals = stripMarkdown(await askDeepSeek([
      `${intro}`,
      ``,
      `Τα δεδομένα εισόδου χωρίζονται σε τρεις πηγές — αντιμετώπισέ τες ξεχωριστά:`,
      `[Α] ΑΙΤΗΜΑΤΑ ΠΕΛΑΤΗ (από τα «ΑΙΤΗΜΑΤΑ ΠΕΛΑΤΗ» στο context) — αυτά είναι η υψηλότερη προτεραιότητα, πρέπει να απαντηθούν ένα-ένα.`,
      `[Β] ΠΡΟΤΑΣΕΙΣ ΕΤΑΙΡΕΙΑΣ (από τις «ΕΣΩΤΕΡΙΚΕΣ ΠΡΟΤΑΣΕΙΣ ΕΤΑΙΡΕΙΑΣ» στο context) — αυτά είναι η δική μας τεχνογνωσία που προτείνουμε εμείς.`,
      `[Γ] ΑΝΑΛΥΣΗ (από τα κενά/αδυναμίες που εντοπίστηκαν) — επιπλέον ευκαιρίες που αξίζει να καλυφθούν.`,
      ``,
      `Γράψε ΑΝΑΛΥΤΙΚΕΣ ΠΡΟΤΕΙΝΟΜΕΝΕΣ ΒΕΛΤΙΩΣΕΙΣ για τον τομέα «${label}».`,
      `Παρουσίασε τουλάχιστον 7-9 συγκεκριμένες βελτιώσεις σε αριθμημένη λίστα.`,
      hasReqs ? `ΥΠΟΧΡΕΩΤΙΚΟ: Πρώτα απάντησε ΟΛΑ τα αιτήματα [Α] — σημείωσε σαφώς «[Α]» στον τίτλο κάθε σχετικής πρότασης.` : ``,
      hasCompSugg ? `ΥΠΟΧΡΕΩΤΙΚΟ: Ενσωμάτωσε ΟΛΕΣ τις εσωτερικές προτάσεις [Β] — σημείωσε «[Β]» στον τίτλο. Αναπτύξτε τες πλήρως.` : ``,
      `Πρόσθεσε 2-3 επιπλέον βελτιώσεις [Γ] από δική σου ανάλυση κενών.`,
      isWebSoftware ? `ΤΕΧΝΟΛΟΓΙΑ: Για web/software προτάσεις χρησιμοποίησε αποκλειστικά Next.js 16+ ecosystem (Next.js, Tailwind CSS, Prisma, NextAuth, Vercel, Stripe/Viva Wallet, Medusa.js για eshop, Resend για email, Plausible για analytics). Εξήγησε ΓΙΑΤΙ κάθε εργαλείο επιλέγεται.` : ``,
      `Κάθε πρόταση να περιλαμβάνει:`,
      `• Τίτλο δράσης [με πηγή Α/Β/Γ]`,
      `• Τι ακριβώς προτείνεται — τεχνολογία, εργαλείο, διαδικασία (με τεχνική ακρίβεια αλλά κατανοητή γλώσσα)`,
      `• Αναμενόμενο αποτέλεσμα/όφελος για την εταιρεία`,
      `• Ενδεικτικό χρονοδιάγραμμα (π.χ. «1-2 μήνες», «άμεσα»)`,
      `• Προτεραιότητα: ΚΡΙΣΙΜΗ / ΥΨΗΛΗ / ΜΕΣΑΙΑ`,
      `Μόνο αριθμημένη λίστα — χωρίς εισαγωγή.`,
    ].filter(Boolean).join("\n"), 5000))

    // ΤΜΗΜΑ 4 — Upgrade Ideas (3 000 tokens)
    const ideas = stripMarkdown(await askDeepSeek([
      `${intro}`,
      `Γράψε ΙΔΕΕΣ ΓΙΑ ΑΝΑΒΑΘΜΙΣΗ ΚΑΙ ΕΚΣΥΓΧΡΟΝΙΣΜΟ για τον τομέα «${label}».`,
      `Παρουσίασε 5-6 φουτουριστικές αλλά ρεαλιστικές ιδέες σε αριθμημένη λίστα.`,
      `Αυτές είναι η επόμενη φάση — υπερβαίνουν τις τρέχουσες ανάγκες.`,
      `Κάθε ιδέα:`,
      `• Τίτλος & τι είναι`,
      `• Γιατί ταιριάζει ΕΙΔΙΚΑ σε αυτή την εταιρεία και τον κλάδο της`,
      `• Ποια ανταγωνιστικά πλεονεκτήματα δημιουργεί`,
      `• Σύνδεση με τάσεις της ελληνικής/ευρωπαϊκής αγοράς`,
      `Να ανοίγουν τον ορίζοντα χωρίς να φαίνονται ανέφικτες. Μόνο αριθμημένη λίστα.`,
    ].join("\n"), 3000))

    // ΤΜΗΜΑ 5 — Per-proposal effort estimates (6 000 tokens, only for SOFTWARE & WEB_ECOMMERCE)
    // Outputs structured per-proposal estimates; the unified project plan is built later in to-proposal.
    const estimation = hasEstimation
      ? stripMarkdown(await askDeepSeek([
          `${intro}`,
          `Παρακάτω οι προτεινόμενες βελτιώσεις για τον τομέα «${label}»:`,
          `---`,
          proposals.slice(0, 3500),
          `---`,
          ``,
          `Δημιούργησε ΔΟΜΗΜΕΝΗ ΕΚΤΙΜΗΣΗ ΕΡΓΟΥ για κάθε πρόταση.`,
          `Ανάπτυξη με Claude Code (Anthropic AI) — ωριαία €60, ελληνική αγορά 2024-2025.`,
          ``,
          `Για ΚΑΘΕ πρόταση (ίδιος αριθμός με τη λίστα):`,
          `[Αρ.] [Τίτλος — ακριβώς ίδιος]`,
          `• Πολυπλοκότητα: Απλό / Μεσαίο / Σύνθετο`,
          `• Φάση υλοποίησης: [Έναρξη / Μέση φάση / Τελική φάση / Standalone]`,
          `• Εκτ. ώρες: [X]–[Y] ώρες`,
          `• Κόστος (€60/ώρα): €[X.XXX]–€[Y.YYY]`,
          `• Εξαρτάται από: [Αρ. πρότασης ή "Καμία"]`,
          `• Παραδοτέο: [Τι ακριβώς παραλαμβάνει η εταιρεία — συγκεκριμένο, δοκιμάσιμο]`,
          ``,
          `Στο τέλος ΣΥΝΟΛΟ:`,
          `• Σύνολο ωρών: [X]–[Y] ώρες`,
          `• Συνολικό κόστος (€60/ώρα): €[X.XXX]–€[Y.YYY]`,
          `• Εκτ. διάρκεια τομέα: [X] μήνες`,
        ].join("\n"), 6000))
      : ""

    // ΤΜΗΜΑ 6 — APIs & Services (only for SOFTWARE, WEB_ECOMMERCE, IOT_AI)
    const SERVICES_SECTIONS = new Set(["SOFTWARE", "WEB_ECOMMERCE", "IOT_AI"])
    const services = SERVICES_SECTIONS.has(sectionEnum)
      ? stripMarkdown(await askDeepSeek([
          `${intro}`,
          `Δημιούργησε λίστα ΤΡΙΤΩΝ ΕΦΑΡΜΟΓΩΝ, APIs και ΥΠΗΡΕΣΙΩΝ που χρειάζεται αυτή η εταιρεία για τον τομέα «${label}».`,
          `Βασίσου στο Next.js ecosystem και τα αιτήματα/προτάσεις που έχουν καταγραφεί.`,
          `Για ΚΑΘΕ υπηρεσία:`,
          `[Αρ.] [Όνομα υπηρεσίας / Εφαρμογής]`,
          `• Πάροχος: [εταιρεία]`,
          `• Σκοπός: [τι κάνει — 1 πρόταση]`,
          `• Κόστος: [€X/μήνα ή €X ανά χρήση — να είναι ρεαλιστικά τιμολόγια 2024-2025]`,
          `• Πλάνο: [Free / Starter / Pro / Enterprise — ποιο αρμόζει]`,
          ``,
          `Συμπερίλαβε: hosting, email, πληρωμές, CDN, analytics, monitoring, email marketing, AI APIs, storage, maps, SMS/push κ.α. όπου αρμόζει.`,
          `Μόνο υπηρεσίες που ΠΡΑΓΜΑΤΙΚΑ χρειάζεται αυτή η εταιρεία — όχι γενικές προτάσεις.`,
          `Αριθμημένη λίστα, 6-12 υπηρεσίες.`,
        ].join("\n"), 3000))
      : ""

    return {
      section: sectionEnum,
      label,
      currentSituation,
      gaps,
      proposals,
      ideas,
      estimation,
      services,
    }
  }

  // ── 4. Analyze all sections (sequentially to respect rate limits) ─────────

  const analyses: Awaited<ReturnType<typeof analyzeSection>>[] = []

  for (const sectionKey of sectionKeys) {
    const sectionEnum = SECTION_ENUM_MAP[sectionKey]
    if (!sectionEnum) continue
    try {
      const result = await analyzeSection(sectionEnum)
      analyses.push(result)
    } catch (e) {
      analyses.push({
        section: sectionEnum,
        label: SECTION_LABELS_GR[sectionEnum] ?? sectionEnum,
        currentSituation: `Σφάλμα κατά την ανάλυση: ${String(e)}`,
        gaps: "",
        proposals: "",
        ideas: "",
        estimation: "",
        services: "",
      })
    }
  }

  // Build section → customer requirement map for proposal wiring
  const requirementsBySection: Record<string, { id: number; title: string; description: string | null }[]> = {}
  for (const r of requirements) {
    if (!requirementsBySection[r.section]) requirementsBySection[r.section] = []
    requirementsBySection[r.section].push({ id: r.id, title: r.title, description: r.description })
  }

  // Build section → company suggestion map (distinct from customer requirements)
  const companySuggestionsBySection: Record<string, { id: number; title: string; description: string | null }[]> = {}
  for (const r of companySuggestions) {
    if (!companySuggestionsBySection[r.section]) companySuggestionsBySection[r.section] = []
    companySuggestionsBySection[r.section].push({ id: r.id, title: r.title, description: r.description })
  }

  return NextResponse.json({
    surveyId,
    customerName,
    surveyName: survey.name,
    generatedAt: new Date().toISOString(),
    analyses,
    requirementsBySection,
    companySuggestionsBySection,
  })
  } catch (e) {
    console.error("[ai-analysis]", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
