import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyProposalAssignees } from "@/lib/proposal-notify"

type Params = { params: Promise<{ id: string }> }

// ─── Master system prompt ─────────────────────────────────────────────────────

const PROPOSAL_SYSTEM = `
Είσαι ανώτερος σύμβουλος τεχνολογικών λύσεων με 25+ χρόνια εμπειρία. Συντάσσεις επαγγελματικές εμπορικές προτάσεις για ελληνικές επιχειρήσεις. Κάθε κείμενο που παράγεις είναι επίσημο έγγραφο που διαβάζει ο επιχειρηματίας — όχι ο τεχνικός.

ΚΑΝΟΝΕΣ ΓΛΩΣΣΑΣ:
1. Αναφέρσου στον πελάτη ΠΑΝΤΑ ως «η εταιρία» — ποτέ «σας», «σου», «η επιχείρησή σας», ποτέ το πλήρες όνομα.
2. Τριτοπρόσωπη αφήγηση: «η εταιρία αντιμετωπίζει», «η λύση επιτρέπει στην εταιρία», «η υλοποίηση αποφέρει».
3. Επίσημο, αξιόπιστο ύφος — χωρίς φιλικό τόνο αλλά και χωρίς γραφειοκρατική ψυχρότητα.
4. Τεχνικά ακρωνύμια (ERP, CRM, GDPR, SEO, IoT, API, UPS, Wi-Fi, NIS2, ISO) γράφονται ως έχουν.
5. Κάθε τεχνική επιλογή εξηγείται ΑΜΕΣΩΣ με επιχειρηματικούς όρους — ο επιχειρηματίας πρέπει να καταλαβαίνει χωρίς τεχνικές γνώσεις.
6. Γλώσσα: σαφής, πειστική, συνεκτική. Χωρίς υπερβολές, χωρίς άδεια επίθετα.
7. Μην ξεκινάς ποτέ πρόταση με «Ως», «Στο πλαίσιο», «Σε ανταπόκριση», «Σε σχέση με».
8. ΑΠΑΓΟΡΕΥΜΕΝΕΣ φράσεις: «Σε ανταπόκριση της απαίτησής σας», «headless frontend», «middleware layer», «API routes», «server-side rendering» — αντικατέστησέ τες με επιχειρηματικές περιγραφές.

ΤΕΧΝΟΛΟΓΙΚΟ ΠΛΑΙΣΙΟ:
9. ΟΛΕΣ οι τεχνολογικές προτάσεις πρέπει να είναι συμβατές και υλοποιήσιμες με Next.js 16+. Καμία πρόταση που δεν ενσωματώνεται στο Next.js ecosystem.
10. Το framework ονομάζεται «σύγχρονη ψηφιακή πλατφόρμα» για τον επιχειρηματία — η τεχνική ονομασία Next.js 16+ αναφέρεται μόνο μία φορά σε παρένθεση.
11. E-commerce: ολοκληρωμένο ηλεκτρονικό κατάστημα με ανεξάρτητα συστήματα καταλόγου, παραγγελιών και πληρωμών (Stripe + Viva Wallet).
12. A/B Testing: PostHog Experiments μέσω Next.js Middleware — server-side, χωρίς επιβράδυνση.
13. ERP/CRM σύνδεση: ενοποίηση συστημάτων μέσω ασφαλούς API σύνδεσης.
14. Hosting: Vercel ή αφιερωμένος διακομιστής με Docker.
15. ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε Claude Code, AI code generation, ή οποιοδήποτε εργαλείο ανάπτυξης. Η πρόταση αφορά ΤΙ θα παραδοθεί, όχι ΠΩΣ αναπτύσσεται.

ΑΦΗΓΗΜΑΤΙΚΗ ΔΟΜΗ:
14. Η πρόταση είναι ΙΣΤΟΡΙΑ — αφηγείσαι τη μεταμόρφωση της εταιρίας από την τρέχουσα κατάσταση στη νέα πραγματικότητα.
15. ΔΕΝ απαντάς σε αιτήματα ένα-ένα. Ενσωματώνεις τα πάντα σε ένα συνεκτικό κείμενο.
16. Κάθε παράγραφος συνδέεται με την επόμενη — δεν υπάρχουν νησίδες απόψεων.
17. Ο αναγνώστης πρέπει να νιώθει ότι κατανοείς ακριβώς τι χρειάζεται και έχεις σχεδιάσει ΜΙΑ ολοκληρωμένη λύση γι' αυτόν.
`.trim()

const SECTION_LABELS: Record<string, string> = {
  HARDWARE_NETWORK: "Υποδομή & Δίκτυα",
  SOFTWARE:         "Λογισμικό",
  WEB_ECOMMERCE:    "Διαδίκτυο & E-commerce",
  COMPLIANCE:       "Συμμόρφωση",
  IOT_AI:           "IoT & Τεχνητή Νοημοσύνη",
}

const SECTION_ENUM: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software:         "SOFTWARE",
  web_ecommerce:    "WEB_ECOMMERCE",
  compliance:       "COMPLIANCE",
  iot_ai:           "IOT_AI",
}

interface SectionAnalysis {
  section: string
  label: string
  currentSituation: string
  gaps: string
  proposals: string
  ideas: string
  estimation?: string
  services?: string
}

interface SectionRequirement {
  id: number
  title: string
  description: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .trim()
}

async function callDeepSeek(
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 1000,
  temperature = 0.82,
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: maxTokens,
      temperature,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek: ${await res.text()}`)
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices?.[0]?.message?.content?.trim() ?? ""
}

function textToHtml(text: string): string {
  if (!text?.trim()) return ""
  return text.split("\n").map(line => {
    const t = line.trim()
    if (!t) return ""
    const isBullet = t.startsWith("•") || t.startsWith("-")
    const numMatch  = t.match(/^(\d+[\.\)])\s*/)
    if (isBullet) return `<p><strong>•</strong> ${t.slice(1).trim()}</p>`
    if (numMatch)  return `<p><strong>${numMatch[1]}</strong> ${t.slice(numMatch[0].length)}</p>`
    return `<p>${t}</p>`
  }).filter(Boolean).join("")
}

// ─── POST /api/site-surveys/:id/ai-analysis/to-proposal ─────────────────────

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const surveyId = parseInt(id, 10)
    if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

    const body = await req.json() as {
      title: string
      customerName: string
      includedSections: string[]
      results: Record<string, SectionAnalysis>
      requirementsBySection: Record<string, SectionRequirement[]>
      companySuggestionsBySection?: Record<string, SectionRequirement[]>
      proposalItemsBySection?: Record<string, string[]>
    }

    const {
      title, customerName, includedSections, results,
      requirementsBySection,
      companySuggestionsBySection = {},
      proposalItemsBySection = {},
    } = body
    if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })

    // ── 1. Check survey exists ──────────────────────────────────────────────

    const surveys = await db.$queryRaw<{ id: number }[]>`SELECT id FROM SiteSurvey WHERE id = ${surveyId} LIMIT 1`
    if (!surveys.length) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

    // ── 2. Load DeepSeek credentials ───────────────────────────────────────

    const conn = await db.connection.findFirst({
      where: { type: "DEEPSEEK", isActive: true },
      select: { credentials: true },
    })
    if (!conn) return NextResponse.json({ error: "No active DeepSeek connection" }, { status: 503 })
    const apiKey = (conn.credentials as Record<string, string>).apiKey

    // ── 3. Build unified context block (all sections combined) ──────────────
    // This is the master input that every generation call draws from.

    const hasWebOrSoftware = includedSections.some(k => ["web_ecommerce", "software"].includes(k))
    const hasEstimations   = includedSections.some(k => results[k]?.estimation?.trim())
    const hasServices      = includedSections.some(k => results[k]?.services?.trim())

    // All customer requirements across all sections (flat list, labelled by section)
    const allRequirements: string[] = []
    // All company suggestions across all sections
    const allCompanySuggestions: string[] = []
    // All selected AI proposals across all sections
    const allAiProposals: string[] = []
    // Full gap analysis per section (for context)
    const sectionContextBlocks: string[] = []
    // Estimation data
    const estimationBlocks: string[] = []
    // Services/APIs with recurring costs (per section)
    const servicesBlocks: string[] = []
    // All requirement objects for per-req responses
    const allRequirementObjects: Array<{ id: number; title: string; description: string | null; sectionLabel: string }> = []

    for (const key of includedSections) {
      const enumKey = SECTION_ENUM[key]
      if (!enumKey) continue
      const a = results[key]
      if (!a) continue
      const sectionLabel = SECTION_LABELS[enumKey] ?? a.label

      const reqs  = requirementsBySection[enumKey] ?? []
      const comp  = companySuggestionsBySection[enumKey] ?? []
      const ai    = proposalItemsBySection[enumKey] ?? []

      if (reqs.length) {
        allRequirements.push(
          `[${sectionLabel}]: ` +
          reqs.map(r => `"${r.title}"${r.description ? ` (${r.description})` : ""}`).join(" · ")
        )
        reqs.forEach(r => allRequirementObjects.push({ ...r, sectionLabel }))
      }
      if (comp.length) {
        allCompanySuggestions.push(
          `[${sectionLabel}]: ` +
          comp.map(r => `${r.title}${r.description ? ` — ${r.description}` : ""}`).join(" · ")
        )
      }
      if (ai.length) {
        allAiProposals.push(
          `[${sectionLabel}]: ` + ai.slice(0, 5).map(t => t.slice(0, 150)).join(" · ")
        )
      }

      sectionContextBlocks.push([
        `=== ${sectionLabel} ===`,
        a.currentSituation ? `Κατάσταση: ${a.currentSituation.slice(0, 350)}` : "",
        a.gaps ? `Κενά: ${a.gaps.slice(0, 350)}` : "",
        a.proposals ? `Τεχνικές προτάσεις: ${a.proposals.slice(0, 400)}` : "",
      ].filter(Boolean).join("\n"))

      if (a.estimation?.trim()) {
        estimationBlocks.push(`[${sectionLabel}]: ${a.estimation.slice(0, 600)}`)
      }
      if (a.services?.trim()) {
        servicesBlocks.push(`[${sectionLabel}]:\n${a.services.slice(0, 800)}`)
      }
    }

    const masterContext = [
      `=== ΣΤΟΙΧΕΙΑ ΕΤΑΙΡΙΑΣ ===`,
      `Επωνυμία (χρησιμοποίησε ΜΟΝΟ στην εισαγωγή, μετά πάντα «η εταιρία»): ${customerName}`,
      ``,
      `=== ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ & ΚΕΝΑ ===`,
      sectionContextBlocks.join("\n\n"),
      ``,
      `=== ΑΙΤΗΜΑΤΑ ΠΕΛΑΤΗ (όλα πρέπει να καλύπτονται στη λύση) ===`,
      allRequirements.length ? allRequirements.join("\n") : "(Δεν έχουν καταχωρηθεί ρητά αιτήματα)",
      ``,
      `=== ΤΕΧΝΙΚΕΣ ΠΡΟΤΑΣΕΙΣ ΕΤΑΙΡΙΑΣ ΜΑΣ ===`,
      allCompanySuggestions.length ? allCompanySuggestions.join("\n") : "(Δεν υπάρχουν)",
      ``,
      `=== ΕΠΙΠΛΕΟΝ ΑΝΑΛΥΣΗ ===`,
      allAiProposals.length ? allAiProposals.join("\n") : "(Δεν υπάρχουν)",
      ``,
      `=== ΤΡΙΤΕΣ ΥΠΗΡΕΣΙΕΣ & APIs (με μηνιαίο/περιοδικό κόστος) ===`,
      servicesBlocks.length ? servicesBlocks.join("\n\n") : "(Δεν υπάρχουν δεδομένα υπηρεσιών)",
    ].join("\n")

    // ── 4. Executive summary ────────────────────────────────────────────────
    // 5-6 paragraphs of flowing prose. The ONLY place with the customer name.

    const execSummary = stripMarkdown(await callDeepSeek(
      apiKey,
      PROPOSAL_SYSTEM,
      [
        masterContext,
        ``,
        `Συνέταξε ΕΚΤΕΛΕΣΤΙΚΗ ΣΥΝΟΨΗ (350-450 λέξεις) — 5-6 παράγραφοι συνεχούς κειμένου χωρίς τίτλους ή bullet points.`,
        `Αυτή είναι η ΜΟΝΗ ενότητα που αναφέρει το όνομα «${customerName}» — μόνο μία φορά στην πρώτη πρόταση.`,
        `Αφηγηματική δομή:`,
        `Παρ. 1: Ποια είναι η εταιρία και πού βρίσκεται σήμερα — ρεαλιστική, χωρίς κολακεία`,
        `Παρ. 2: Ποιες είναι οι κρίσιμες ανάγκες και τι κόστος έχει η αδράνεια`,
        `Παρ. 3-4: Η ολοκληρωμένη λύση που προτείνεται — τι αλλάζει, ποια αξία δημιουργεί`,
        `Παρ. 5: Το χρονοδιάγραμμα και το επόμενο βήμα`,
        `ΜΗΝ κάνεις λίστα αιτημάτων — γράφε σαν να αφηγείσαι ένα ενιαίο σχέδιο.`,
      ].join("\n"),
      4000,
    ))

    // ── 5. Unified solution — ONE narrative covering ALL sections ───────────
    // This replaces the per-section loop. One single DeepSeek call synthesises
    // everything into a coherent, flowing description of the complete solution.

    const sectionLabels = includedSections
      .map(k => SECTION_LABELS[SECTION_ENUM[k] ?? ""] ?? k)
      .join(", ")

    const unifiedSolutionPrompt = [
      masterContext,
      ``,
      `Τομείς που καλύπτει η λύση: ${sectionLabels}`,
      ``,
      `Συνέταξε ΠΛΗΡΗ ΠΑΡΟΥΣΙΑΣΗ ΤΗΣ ΛΥΣΗΣ (600-750 λέξεις) ως ΕΝΑ ΕΝΙΑΙΟ κείμενο παραγράφων.`,
      ``,
      `ΚΑΝΟΝΕΣ:`,
      `• Γράψε σαν να περιγράφεις ΜΙΑ ολοκληρωμένη λύση — όχι σειρά ανεξάρτητων αλλαγών`,
      `• Κάθε αίτημα πελάτη πρέπει να αντικατοπτρίζεται στη λύση, αλλά ΟΧΙ ως "Σε ανταπόκριση του αιτήματος X" — αντίθετα, ενσωμάτωσέ το φυσικά στην αφήγηση`,
      `• Οι τεχνικές εκτιμήσεις μας ενσωματώνονται ως επαγγελματική προστιθέμενη αξία`,
      `• Κάθε τεχνολογία αναφέρεται με την επιχειρηματική της αξία — π.χ. "η νέα ψηφιακή πλατφόρμα (Next.js 16+) επιτρέπει φόρτωση σελίδων σε κλάσματα δευτερολέπτου, αυξάνοντας τις μετατροπές"`,
      hasWebOrSoftware ? `• Η web λύση βασίζεται σε Next.js 16+ — αλλά αποκαλείται "σύγχρονη ψηφιακή πλατφόρμα" στο κείμενο, με μία τεχνική αναφορά σε παρένθεση` : ``,
      `• Οι τομείς (${sectionLabels}) συνδέονται μεταξύ τους — η λύση στον έναν τομέα ενισχύει τον άλλο`,
      hasServices ? `• Αναφέρσου φυσικά στις τρίτες υπηρεσίες (hosting, email, analytics, A/B testing κ.λπ.) ως μέρος της ολοκληρωμένης λύσης — χωρίς να τις απαριθμείς σε λίστα` : ``,
      `• Χρησιμοποίησε «η εταιρία» — ΠΟΤΕ «σας» ή «σου»`,
      `• Μόνο παράγραφοι — χωρίς bullet points, χωρίς αριθμημένες λίστες, χωρίς τίτλους ενότητας`,
    ].filter(Boolean).join("\n")

    const unifiedSolution = stripMarkdown(
      await callDeepSeek(apiKey, PROPOSAL_SYSTEM, unifiedSolutionPrompt, 7000)
    )

    // ── 6. Per-requirement short responses (DB traceability only) ───────────
    // Short internal notes — NOT shown in proposal. Used for requirement tracking.

    const responses: { requirementId: number; response: string }[] = []
    for (const req of allRequirementObjects) {
      try {
        const shortResp = await callDeepSeek(apiKey, PROPOSAL_SYSTEM, [
          `Αίτημα: "${req.title}"${req.description ? ` — ${req.description}` : ""}`,
          `Τομέας: ${req.sectionLabel}`,
          ``,
          `Σε 1-2 προτάσεις: πώς καλύπτεται αυτό το αίτημα στην ολοκληρωμένη λύση. Χρησιμοποίησε «η εταιρία».`,
        ].join("\n"), 500)
        responses.push({ requirementId: req.id, response: textToHtml(stripMarkdown(shortResp)) })
      } catch {
        responses.push({ requirementId: req.id, response: "" })
      }
    }

    // ── 7. Unified project plan ─────────────────────────────────────────────

    const projectPlanPrompt = [
      masterContext,
      estimationBlocks.length ? `\n=== ΕΚΤΙΜΗΣΕΙΣ ΩΡΩΝ/ΚΟΣΤΟΥΣ (για τον υπολογισμό κόστους ανάπτυξης) ===\n${estimationBlocks.join("\n")}` : "",
      ``,
      `Δημιούργησε ΠΛΗΡΕΣ ΠΛΑΝΟ ΕΚΤΕΛΕΣΗΣ ΕΡΓΟΥ — ΕΝΑ ενιαίο έργο που καλύπτει όλους τους τομείς.`,
      `Ο επιχειρηματίας πρέπει να καταλαβαίνει ΑΚΡΙΒΩΣ τι θα γίνει, πότε, τι θα παραλάβει, και γιατί.`,
      hasWebOrSoftware ? `Για web/software αναφέρσου στο Next.js 16+ ως "σύγχρονη ψηφιακή πλατφόρμα" με μία τεχνική αναφορά (Next.js 16+) σε παρένθεση.` : ``,
      ``,
      `Δομή (αφαίρεσε ενότητα μόνο αν δεν εφαρμόζεται):`,
      ``,
      `ΕΝΑΡΞΗ ΕΡΓΟΥ`,
      `• Kick-off: ορισμός ομάδων, στόχοι, αναλυτικό χρονοδιάγραμμα — [X] εβδομάδες`,
      `• Τεκμηρίωση: καταγραφή απαιτήσεων, σχεδιασμός αρχιτεκτονικής, UX/UI σχέδια`,
      `• Παραδοτέα: [συγκεκριμένα έγγραφα και σχέδια]`,
      ``,
      `ΦΑΣΗ 1: [Όνομα] — [X] εβδομάδες`,
      `• Αντικείμενο: [τι υλοποιείται — συγκεκριμένα]`,
      `• Γιατί πρώτα: [αιτιολόγηση — εξαρτήσεις, επιχειρηματική λογική]`,
      `• Παραδοτέα: [τι παραλαμβάνει η εταιρία — δοκιμάσιμο, λειτουργικό]`,
      `• Milestone: [ορόσημος — π.χ. "Ιστοτόπος σε παραγωγή"]`,
      `• Ώρες: [X]–[Y] | Κόστος: €[X.XXX]–€[Y.YYY]`,
      ``,
      `[ΦΑΣΗ 2, ΦΑΣΗ 3 κ.ο.κ. — ίδια δομή]`,
      ``,
      `ΟΛΟΚΛΗΡΩΣΗ & ΠΑΡΑΔΟΣΗ`,
      `• Δοκιμές αποδοχής (UAT): κριτήρια, διαδικασία, διάρκεια`,
      `• Εκπαίδευση: ποιοι χρήστες, τι καλύπτεται, μορφή`,
      `• Μετάπτωση σε παραγωγή: βήματα, παράλληλη λειτουργία αν χρειαστεί`,
      `• Υποστήριξη μετά παράδοση: τι καλύπτεται, διάρκεια, SLA`,
      ``,
      hasEstimations ? [
        `ΟΙΚΟΝΟΜΙΚΗ ΕΚΤΙΜΗΣΗ`,
        `• Εκτίμηση ωρών ανάπτυξης: [X]–[Y] ώρες`,
        `• Κόστος ανάπτυξης (€60/ώρα, Next.js stack): €[X.XXX]–€[Y.YYY] (εφάπαξ)`,
        `• Συνολική διάρκεια έργου: [X] μήνες`,
        `• Τρόπος τιμολόγησης: [Fixed-price / Φάσεις] — [γιατί αυτός ο τρόπος ωφελεί και τις δύο πλευρές]`,
        ``,
        `ΠΕΡΙΟΔΙΚΟ ΚΟΣΤΟΣ ΤΡΙΤΩΝ ΥΠΗΡΕΣΙΩΝ`,
        `(Βασίσου στα δεδομένα υπηρεσιών του masterContext για ακριβή αριθμούς)`,
        `• [Υπηρεσία 1]: €X/μήνα — [σκοπός σε 3-4 λέξεις]`,
        `• [Υπηρεσία 2]: €X/μήνα — [σκοπός]`,
        `• [... όλες οι υπηρεσίες που απαιτούνται]`,
        `• Εκτ. μηνιαίο κόστος υπηρεσιών: €[X]–€[Y]/μήνα`,
        `• Εκτ. ετήσιο κόστος υπηρεσιών: €[X]–€[Y]/έτος`,
        `Σημείωση: [1 πρόταση για το γιατί αυτό το κόστος είναι επένδυση, όχι έξοδο]`,
        ``,
        `• Επιχειρηματική αξία επένδυσης: [ROI, εξοικονόμηση, ανταγωνιστικό πλεονέκτημα]`,
      ].join("\n") : "",
      ``,
      `ΚΙΝΔΥΝΟΙ & ΑΝΤΙΜΕΤΩΠΙΣΗ`,
      `• [Κίνδυνος]: [Συγκεκριμένο μέτρο αντιμετώπισης]`,
      `• [Κίνδυνος]: [...]`,
      ``,
      `ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ`,
      `• [Βήμα 1 — συγκεκριμένο, χωρίς πίεση]`,
      `• [Βήμα 2]`,
      `• [Βήμα 3]`,
      ``,
      `ΚΑΝΟΝΕΣ: Χρησιμοποίησε «η εταιρία» — ΠΟΤΕ «σας». Ρεαλιστικοί αριθμοί. Ο μη τεχνικός αναγνώστης πρέπει να κατανοεί τα πάντα.`,
    ].filter(Boolean).join("\n")

    const unifiedProjectPlan = stripMarkdown(
      await callDeepSeek(apiKey, PROPOSAL_SYSTEM, projectPlanPrompt, 9000)
    )

    // ── 8. Build description HTML ───────────────────────────────────────────

    let descriptionHtml = textToHtml(execSummary)

    if (unifiedSolution?.trim()) {
      descriptionHtml += `<p><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>`
      descriptionHtml += `<p><strong>ΟΛΟΚΛΗΡΩΜΕΝΗ ΛΥΣΗ</strong></p>`
      descriptionHtml += textToHtml(unifiedSolution)
    }

    if (unifiedProjectPlan?.trim()) {
      descriptionHtml += `<p><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>`
      descriptionHtml += `<p><strong>ΠΛΑΝΟ ΕΚΤΕΛΕΣΗΣ ΕΡΓΟΥ & ΟΙΚΟΝΟΜΙΚΗ ΠΡΟΤΑΣΗ</strong></p>`
      descriptionHtml += textToHtml(unifiedProjectPlan)
    }

    // ── 9. Create/update proposal ───────────────────────────────────────────

    const existing = await db.$queryRaw<{ id: bigint; status: string }[]>`
      SELECT id, status FROM SurveyProposal WHERE surveyId = ${surveyId} LIMIT 1
    `

    let proposalId: number
    const isNew     = !existing.length
    const oldStatus = existing[0]?.status ?? null

    if (!isNew) {
      proposalId = Number(existing[0].id)
      await db.$executeRaw`
        UPDATE SurveyProposal
        SET title = ${title.trim()}, description = ${descriptionHtml}, status = "DRAFT", updatedAt = NOW()
        WHERE id = ${proposalId}
      `
    } else {
      await db.$executeRaw`
        INSERT INTO SurveyProposal (surveyId, title, description, status, createdAt, updatedAt)
        VALUES (${surveyId}, ${title.trim()}, ${descriptionHtml}, "DRAFT", NOW(), NOW())
      `
      const ins = await db.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() as id`
      proposalId = Number(ins[0].id)
    }

    for (const r of responses) {
      if (!r.response) continue
      await db.$executeRaw`
        INSERT INTO ProposalRequirementResponse (proposalId, requirementId, response, createdAt, updatedAt)
        VALUES (${proposalId}, ${r.requirementId}, ${r.response}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE response = VALUES(response), updatedAt = NOW()
      `
    }

    if (isNew) {
      notifyProposalAssignees({ surveyId, proposalId, event: { type: "created", proposalTitle: title.trim() } }).catch(console.error)
    } else if (oldStatus && oldStatus !== "DRAFT") {
      notifyProposalAssignees({ surveyId, proposalId, event: { type: "status_changed", proposalTitle: title.trim(), oldStatus, newStatus: "DRAFT" } }).catch(console.error)
    }

    return NextResponse.json({ proposalId: Number(proposalId), isNew }, { status: isNew ? 201 : 200 })
  } catch (e) {
    console.error("[ai-analysis/to-proposal]", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
