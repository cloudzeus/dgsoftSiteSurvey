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

// ─── Section expert personas ──────────────────────────────────────────────────

const SECTION_EXPERTS: Record<string, string> = {
  HARDWARE_NETWORK: `Είσαι ανώτερος σύμβουλος πληροφορικής με 20+ χρόνια εμπειρία στις υποδομές εξοπλισμού και δικτύων επιχειρήσεων. Εξειδικεύεσαι σε διακομιστές, δρομολογητές, μεταγωγείς, τείχη προστασίας, UPS, δομημένη καλωδίωση και ασύρματα δίκτυα. Αξιολογείς υποδομές επιχειρήσεων και συντάσσεις εκθέσεις κατάστασης και προτάσεις αναβάθμισης.\n${LANGUAGE_RULES}`,

  SOFTWARE: `Είσαι ανώτερος σύμβουλος επιχειρησιακών εφαρμογών με 20+ χρόνια εμπειρία σε ERP, CRM, λογιστικά συστήματα και επαγγελματικό λογισμικό. Αξιολογείς λογισμικό, άδειες χρήσης, ενοποιήσεις συστημάτων και παραγωγικότητα. Συντάσσεις εκθέσεις κατάστασης και προτάσεις εκσυγχρονισμού.\n${LANGUAGE_RULES}`,

  WEB_ECOMMERCE: `Είσαι ανώτερος σύμβουλος ψηφιακής παρουσίας και ηλεκτρονικού εμπορίου με 20+ χρόνια εμπειρία σε ιστοτόπους, ηλεκτρονικά καταστήματα, SEO, ψηφιακό μάρκετινγκ και ψηφιακές πληρωμές. Αξιολογείς ψηφιακή παρουσία επιχειρήσεων και συντάσσεις εκθέσεις κατάστασης και στρατηγικές βελτίωσης.\n${LANGUAGE_RULES}`,

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
    const currentSituation = await askDeepSeek([
      `${intro}`,
      `Γράψε ΕΚΤΕΝΗ ΠΕΡΙΓΡΑΦΗ ΤΡΕΧΟΥΣΑΣ ΚΑΤΑΣΤΑΣΗΣ (6-8 πλούσιες παραγράφους) για τον τομέα «${label}».`,
      `• Ξεκίνα με ολιστικό portrait: τι λειτουργεί καλά, ποια φιλοσοφία διέπει τη διαχείριση του τομέα.`,
      `• Περιέγραψε αναλυτικά κάθε στοιχείο που αποκάλυψε η έρευνα: εξοπλισμός, συστήματα, διαδικασίες, άνθρωποι.`,
      `• Αξιολόγησε επίπεδο ωριμότητας (χαμηλό/μεσαίο/υψηλό) με τεκμήρια.`,
      `• Επισήμανε ανακολουθίες ή παράδοξα από τα δεδομένα.`,
      `• Κλείσε με πρόταση-αφετηρία για το επόμενο βήμα.`,
      `Μόνο κείμενο παραγράφων — χωρίς τίτλους ενότητας.`,
    ].join("\n"), 4000)

    // ΤΜΗΜΑ 2 — Gaps & Weaknesses (3 500 tokens)
    const gaps = await askDeepSeek([
      `${intro}`,
      `Γράψε ΑΝΑΛΥΤΙΚΗ ΚΑΤΑΓΡΑΦΗ ΚΕΝΩΝ ΚΑΙ ΑΔΥΝΑΜΙΩΝ για τον τομέα «${label}».`,
      `Κατέγραψε 6-9 κενά/αδυναμίες σε μορφή αριθμημένης λίστας. Για ΚΑΘΕ ένα:`,
      `1. Τίτλος κενού`,
      `2. Τι ακριβώς λείπει ή λειτουργεί ελλιπώς`,
      `3. Ποια δεδομένα της έρευνας το αποδεικνύουν`,
      `4. Ο επιχειρηματικός κίνδυνος: οικονομικό κόστος, ασφάλεια, ανταγωνιστικότητα ή νομικό ρίσκο`,
      hasReqs ? `5. Σύνδεση με αίτημα πελάτη αν αρμόζει.` : ``,
      `Μόνο λίστα — χωρίς εισαγωγικό ή συμπέρασμα.`,
    ].filter(Boolean).join("\n"), 3500)

    // ΤΜΗΜΑ 3 — Proposals (5 000 tokens — largest, include all reqs + comp suggestions)
    const proposals = await askDeepSeek([
      `${intro}`,
      `Γράψε ΑΝΑΛΥΤΙΚΕΣ ΠΡΟΤΕΙΝΟΜΕΝΕΣ ΒΕΛΤΙΩΣΕΙΣ για τον τομέα «${label}».`,
      `Παρουσίασε τουλάχιστον 7-9 συγκεκριμένες και εφαρμόσιμες βελτιώσεις σε αριθμημένη λίστα.`,
      hasReqs ? `ΥΠΟΧΡΕΩΤΙΚΟ: Ξεκίνα από τα αιτήματα του πελάτη — αντιμετώπισέ τα ένα-ένα.` : ``,
      hasCompSugg ? `ΥΠΟΧΡΕΩΤΙΚΟ: Ενσωμάτωσε ΟΛΕΣ τις εσωτερικές προτάσεις εταιρείας (βλ. πιο πάνω) — αναπτύξτε τες πλήρως.` : ``,
      `Κάθε πρόταση να περιλαμβάνει:`,
      `• Τίτλο δράσης`,
      `• Τι ακριβώς προτείνεται — τεχνολογία, εργαλείο, διαδικασία (με τεχνική ακρίβεια αλλά κατανοητή γλώσσα)`,
      `• Αναμενόμενο αποτέλεσμα/όφελος για την εταιρεία`,
      `• Ενδεικτικό χρονοδιάγραμμα (π.χ. «1-2 μήνες», «άμεσα»)`,
      `• Προτεραιότητα: ΚΡΙΣΙΜΗ / ΥΨΗΛΗ / ΜΕΣΑΙΑ`,
      `Μόνο αριθμημένη λίστα — χωρίς εισαγωγή.`,
    ].filter(Boolean).join("\n"), 5000)

    // ΤΜΗΜΑ 4 — Upgrade Ideas (3 000 tokens)
    const ideas = await askDeepSeek([
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
    ].join("\n"), 3000)

    // ΤΜΗΜΑ 5 — Per-proposal effort estimates (6 000 tokens, only for SOFTWARE & WEB_ECOMMERCE)
    // Outputs structured per-proposal estimates; the unified project plan is built later in to-proposal.
    const estimation = hasEstimation
      ? await askDeepSeek([
          `${intro}`,
          `Παρακάτω οι προτεινόμενες βελτιώσεις για τον τομέα «${label}»:`,
          `---`,
          proposals.slice(0, 3500),
          `---`,
          ``,
          `Δημιούργησε ΔΟΜΗΜΕΝΗ ΕΚΤΙΜΗΣΗ ΕΡΓΟΥ για κάθε πρόταση.`,
          `Ανάπτυξη με Claude Code (Anthropic AI) — ωριαία €60-80, ελληνική αγορά 2024-2025.`,
          ``,
          `Για ΚΑΘΕ πρόταση (ίδιος αριθμός με τη λίστα):`,
          `[Αρ.] [Τίτλος — ακριβώς ίδιος]`,
          `• Πολυπλοκότητα: Απλό / Μεσαίο / Σύνθετο`,
          `• Φάση υλοποίησης: [Έναρξη / Μέση φάση / Τελική φάση / Standalone]`,
          `• Εκτ. ώρες (Claude Code): [X]–[Y] ώρες`,
          `• Κόστος: €[X.XXX]–€[Y.YYY]`,
          `• Εξαρτάται από: [Αρ. πρότασης ή "Καμία"]`,
          `• Παραδοτέο: [Τι ακριβώς παραλαμβάνει η εταιρεία — συγκεκριμένο, δοκιμάσιμο]`,
          ``,
          `Στο τέλος ΣΥΝΟΛΟ:`,
          `• Σύνολο ωρών: [X]–[Y] ώρες`,
          `• Συνολικό κόστος: €[X.XXX]–€[Y.YYY]`,
          `• Παραδοσιακή ανάπτυξη: ~€[Z.ZZZ]–€[W.WWW] (εξοικονόμηση [X]%)`,
          `• Εκτ. διάρκεια τομέα: [X] μήνες`,
        ].join("\n"), 6000)
      : ""

    return {
      section: sectionEnum,
      label,
      currentSituation,
      gaps,
      proposals,
      ideas,
      estimation,
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
