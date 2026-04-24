import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyProposalAssignees } from "@/lib/proposal-notify"

type Params = { params: Promise<{ id: string }> }

// ─── Sales expert system prompt ───────────────────────────────────────────────

const SALES_SYSTEM = `
Είσαι ανώτερος σύμβουλος τεχνολογικών λύσεων με 25+ χρόνια εμπειρία, εξειδικευμένος στη σύνταξη εμπορικών προτάσεων για ελληνικές επιχειρήσεις. Κάθε κείμενο που παράγεις αποτελεί επίσημο επαγγελματικό έγγραφο.

ΚΑΝΟΝΕΣ ΓΛΩΣΣΑΣ ΚΑΙ ΥΦΟΥΣ:
1. Επίσημο, επαγγελματικό ύφος — χωρίς προσωπικές εκφράσεις, χωρίς φιλικό τόνο.
2. Αναφέρσου στην εταιρεία-πελάτη ως «η εταιρεία» — ΠΟΤΕ «σας», «σου», «η επιχείρησή σας». Η επωνυμία μόνο μία φορά στην αρχή κάθε ενότητας αν χρειάζεται.
3. Τριτοπρόσωπη αναφορά: «η εταιρεία αντιμετωπίζει», «η λύση θα επιτρέψει στην εταιρεία», «η υλοποίηση θα αποφέρει».
4. Τεχνικά ακρωνύμια (ERP, CRM, GDPR, SEO, IoT, API, UPS, Wi-Fi, NIS2, ISO) γράφονται ως έχουν. Τα υπόλοιπα στα ελληνικά.
5. Δώσε έμφαση στην επιχειρηματική αξία και τον ποσοτικοποιημένο αντίκτυπο — ROI, εξοικονόμηση χρόνου, μείωση κινδύνου.
6. Γλώσσα: σαφής, δομημένη, αξιόπιστη. Αποφεύγε επιθετικές εκφράσεις, υπερβολικές υποσχέσεις και άδεια επίθετα.
7. Μην ξεκινάς ποτέ με «Ως», «Στο πλαίσιο» ή «Σε σχέση με». Ξεκίνα με ουσία.
8. ΑΠΑΓΟΡΕΥΕΤΑΙ η επανάληψη: κάθε ενότητα πρέπει να προσφέρει νέο περιεχόμενο — χωρίς ανακύκλωση πληροφοριών από άλλα μέρη.
9. Ο πελάτης πρέπει να διαβάσει και να κατανοεί πλήρως χωρίς τεχνικές γνώσεις — εξηγείς κάθε τεχνική επιλογή με επιχειρηματικούς όρους.

ΠΡΟΤΙΜΗΤΕΟ ΤΕΧΝΟΛΟΓΙΚΟ ΠΛΑΙΣΙΟ — εφάρμοζε σε ΟΛΕΣ τις web/software προτάσεις:
10. Για ΟΠΟΙΑΔΗΠΟΤΕ web εφαρμογή, eshop, portal ή custom λογισμικό: η προτεινόμενη λύση βασίζεται στο Next.js 16+ (App Router, Server Components) με Tailwind CSS, Prisma, NextAuth v5.
11. E-commerce: Medusa.js headless + Next.js storefront, ή WooCommerce headless. Ποτέ monolithic WordPress εκτός αν ζητηθεί ρητά.
12. Πληρωμές: Stripe (διεθνές) + Viva Wallet (ελληνική αγορά). Email: Resend + React Email. Hosting: Vercel ή VPS Docker.
13. AI features: Vercel AI SDK με Claude (Anthropic) — native streaming στο Next.js. Analytics: Plausible (GDPR-compliant).
14. ERP/CRM ενοποίηση: Next.js API routes ως middleware layer — ασφαλής, scalable, χωρίς vendor lock-in.
15. Κάθε τεχνική επιλογή εξηγείται με επιχειρηματικά πλεονεκτήματα, όχι μόνο τεχνική περιγραφή.
`.trim()

const SECTION_LABELS: Record<string, string> = {
  HARDWARE_NETWORK: "Υποδομή & Δίκτυα",
  SOFTWARE:         "Λογισμικό",
  WEB_ECOMMERCE:    "Διαδίκτυο & E-commerce",
  COMPLIANCE:       "Συμμόρφωση",
  IOT_AI:           "IoT & Τεχνητή Νοημοσύνη",
}

interface SectionAnalysis {
  section: string
  label: string
  currentSituation: string
  gaps: string
  proposals: string
  ideas: string
  estimation?: string
}

interface SectionRequirement {
  id: number
  title: string
  description: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callDeepSeek(
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 1000,
  temperature = 0.85,
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

    // ── 3. Executive summary ────────────────────────────────────────────────
    // High-level overview only — NOT repeating individual proposals.
    // Each section contributes only its situation + key gaps.

    const sectionSummaries = includedSections.map(key => {
      const a = results[key]
      if (!a) return ""
      const enumKey = SECTION_ENUM[key]
      return [
        `[${(SECTION_LABELS[enumKey ?? ""] ?? a.label).toUpperCase()}]`,
        a.currentSituation ? `Κατάσταση: ${a.currentSituation.slice(0, 400)}` : "",
        a.gaps             ? `Κρίσιμα κενά: ${a.gaps.slice(0, 300)}` : "",
      ].filter(Boolean).join("\n")
    }).filter(Boolean).join("\n\n")

    const execSummaryRaw = await callDeepSeek(
      apiKey,
      SALES_SYSTEM,
      [
        `Εταιρεία-πελάτης: ${customerName}`,
        ``,
        `Τεχνική ανάλυση ανά τομέα:`,
        sectionSummaries,
        ``,
        `Συνέταξε ΕΚΤΕΛΕΣΤΙΚΗ ΣΥΝΟΨΗ (400-500 λέξεις) για επίσημη εμπορική πρόταση.`,
        `Αυτή είναι η ΜΟΝΗ ενότητα που επιτρέπεται να αναφέρει την επωνυμία «${customerName}».`,
        `Δομή — 7 παράγραφοι, μόνο κείμενο (χωρίς τίτλους ή bullet points):`,
        `• Παρ. 1-2: Τρέχουσα κατάσταση — ρεαλιστική εικόνα, χωρίς κολακεία`,
        `• Παρ. 3-4: Βασικές ανάγκες, ευκαιρίες, κίνδυνοι αδράνειας`,
        `• Παρ. 5-6: Η συνολική λύση — τι αλλάζει, ποια επιχειρηματική αξία`,
        `• Παρ. 7: Επόμενα βήματα — συγκεκριμένα, χωρίς πίεση`,
        `ΜΗΝ αναφέρεις μεμονωμένες προτάσεις — μόνο το συνολικό πλαίσιο.`,
      ].join("\n"),
      4000,
    )

    // ── 4. Unified solution per section ────────────────────────────────────
    // Synthesises ALL inputs (requirements + company suggestions + AI proposals)
    // into ONE coherent solution description per section.
    // NOT a list of items — a narrative that covers everything holistically.

    const SECTION_ENUM: Record<string, string> = {
      hardware_network: "HARDWARE_NETWORK",
      software:         "SOFTWARE",
      web_ecommerce:    "WEB_ECOMMERCE",
      compliance:       "COMPLIANCE",
      iot_ai:           "IOT_AI",
    }

    const solutionSections: Array<{ label: string; html: string }> = []
    const responses: { requirementId: number; response: string }[] = []

    for (const key of includedSections) {
      const enumKey = SECTION_ENUM[key]
      if (!enumKey) continue
      const a = results[key]
      if (!a) continue
      const sectionLabel = SECTION_LABELS[enumKey] ?? a.label

      const sectionReqs  = requirementsBySection[enumKey] ?? []
      const compSuggs    = companySuggestionsBySection[enumKey] ?? []
      const aiItems      = proposalItemsBySection[enumKey] ?? []

      // Build all inputs for this section
      const isWebOrSoftware = enumKey === "WEB_ECOMMERCE" || enumKey === "SOFTWARE"

      const inputBlocks: string[] = []
      if (sectionReqs.length) {
        inputBlocks.push(
          `[Α] ΑΙΤΗΜΑΤΑ ΠΕΛΑΤΗ — αυτά πρέπει να απαντηθούν ρητά στη λύση:\n` +
          sectionReqs.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`).join("\n")
        )
      }
      if (compSuggs.length) {
        inputBlocks.push(
          `[Β] ΠΡΟΤΑΣΕΙΣ ΕΤΑΙΡΕΙΑΣ ΜΑΣ — τεχνικές εκτιμήσεις που ενσωματώνουμε στη λύση:\n` +
          compSuggs.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`).join("\n")
        )
      }
      if (aiItems.length) {
        inputBlocks.push(
          `[Γ] ΕΠΙΠΛΕΟΝ AI ΑΝΑΛΥΣΗ — εντοπισμένες ευκαιρίες από τεχνική ανάλυση:\n` +
          aiItems.map((t, i) => `${i + 1}. ${t.slice(0, 200)}`).join("\n")
        )
      }

      const solutionPrompt = [
        `Τομέας: ${sectionLabel}`,
        ``,
        `Τρέχουσα κατάσταση: ${a.currentSituation.slice(0, 500)}`,
        ``,
        `Εντοπισμένα κενά: ${a.gaps.slice(0, 400)}`,
        ``,
        ...inputBlocks,
        ``,
        `Συνέταξε ΟΛΟΚΛΗΡΩΜΕΝΗ ΠΑΡΟΥΣΙΑΣΗ ΛΥΣΗΣ (350-450 λέξεις) για τον τομέα «${sectionLabel}».`,
        `ΥΠΟΧΡΕΩΤΙΚΟ: Κάθε αίτημα πελάτη [Α] πρέπει να απαντηθεί ρητά — ο πελάτης πρέπει να αναγνωρίζει ότι ακούστηκε.`,
        `ΥΠΟΧΡΕΩΤΙΚΟ: Οι προτάσεις της εταιρείας μας [Β] ενσωματώνονται ως συμπληρωματική αξία που προσθέτουμε εμείς.`,
        `Τα ευρήματα AI ανάλυσης [Γ] χρησιμοποιούνται ως υπόβαθρο — δεν αναφέρονται χωριστά.`,
        isWebOrSoftware ? `ΤΕΧΝΟΛΟΓΙΑ: Η λύση βασίζεται στο Next.js 16+ ecosystem. Ανέφερε συγκεκριμένα εργαλεία (Next.js, Tailwind, Prisma, Stripe/Viva Wallet, Vercel κ.λπ.) και εξήγησε ΓΙΑΤΙ αυτή η επιλογή ωφελεί την εταιρεία.` : ``,
        `Μην κάνεις λίστα αιτημάτων — γράψε τη λύση ολιστικά ως ενιαίο πλαίσιο που καλύπτει τα πάντα.`,
        `Εξήγησε ΓΙΑΤΙ κάθε επιλογή γίνεται — με επιχειρηματικούς όρους, όχι μόνο τεχνικούς.`,
        `Χρησιμοποίησε «η εταιρεία» — ΠΟΤΕ «σας». Μόνο κείμενο παραγράφων, χωρίς bullet points.`,
      ].filter(Boolean).join("\n")

      try {
        const html = textToHtml(await callDeepSeek(apiKey, SALES_SYSTEM, solutionPrompt, 3500))
        solutionSections.push({ label: sectionLabel, html })
      } catch {
        solutionSections.push({ label: sectionLabel, html: textToHtml(a.proposals) })
      }

      // Per-requirement responses for DB traceability (short, no duplication)
      for (const req of sectionReqs) {
        try {
          const shortResp = await callDeepSeek(apiKey, SALES_SYSTEM, [
            `Τομέας: ${sectionLabel}`,
            `Αίτημα: "${req.title}"${req.description ? `\nΛεπτομέρειες: ${req.description}` : ""}`,
            ``,
            `Σε 2-3 προτάσεις: επιβεβαίωσε ότι το αίτημα καλύπτεται στη λύση μας και πώς.`,
            `Χρησιμοποίησε «η εταιρεία» — ΠΟΤΕ «σας». Χωρίς επανάληψη πληροφοριών από άλλες ενότητες.`,
          ].join("\n"), 600)
          responses.push({ requirementId: req.id, response: textToHtml(shortResp) })
        } catch {
          responses.push({ requirementId: req.id, response: "" })
        }
      }
    }

    // ── 5. Unified project plan ─────────────────────────────────────────────
    // Synthesises ALL sections into ONE project — start to finish.
    // This is the core deliverable that lets the customer understand the full journey.

    const sectionLabels = includedSections
      .map(k => SECTION_LABELS[SECTION_ENUM[k] ?? ""] ?? k)
      .join(", ")

    const hasWebOrSoftware = includedSections.some(k => ["web_ecommerce", "software"].includes(k))

    const allContext = includedSections.map(key => {
      const a = results[key]
      const enumKey = SECTION_ENUM[key]
      if (!a || !enumKey) return ""
      const reqs  = requirementsBySection[enumKey] ?? []
      const comp  = companySuggestionsBySection[enumKey] ?? []
      const ai    = proposalItemsBySection[enumKey] ?? []
      return [
        `=== ${SECTION_LABELS[enumKey] ?? a.label} ===`,
        `Κενά: ${a.gaps.slice(0, 300)}`,
        `Προτάσεις: ${a.proposals.slice(0, 700)}`,
        a.estimation ? `Εκτιμήσεις ωρών/κόστους: ${a.estimation.slice(0, 800)}` : "",
        reqs.length  ? `Αιτήματα: ${reqs.map(r => r.title).join(" | ")}` : "",
        comp.length  ? `Εσωτερικές προτάσεις: ${comp.map(r => r.title).join(" | ")}` : "",
        ai.length    ? `Προτεινόμενα: ${ai.slice(0, 6).map(t => t.slice(0, 120)).join(" | ")}` : "",
      ].filter(Boolean).join("\n")
    }).filter(Boolean).join("\n\n")

    const hasEstimations = includedSections.some(k => results[k]?.estimation?.trim())

    const projectPlanPrompt = [
      `Εταιρεία-πελάτης: ${customerName}`,
      `Τομείς έργου: ${sectionLabels}`,
      ``,
      `Αποτελέσματα ανάλυσης και εκτιμήσεις:`,
      allContext,
      ``,
      `Δημιούργησε ΠΛΗΡΕΣ ΠΛΑΝΟ ΕΚΤΕΛΕΣΗΣ ΕΡΓΟΥ που αντιμετωπίζει ΟΛΑ τα παραπάνω ως ΕΝΑ ΕΝΙΑΙΟ ΕΡΓΟ.`,
      `Ο πελάτης θα διαβάσει αυτό και πρέπει να κατανοεί ΑΚΡΙΒΩΣ τι θα γίνει, πότε, τι θα παραλάβει, και γιατί.`,
      `Εξήγησε κάθε απόφαση με επιχειρηματικούς όρους — όχι μόνο τεχνικούς.`,
      hasWebOrSoftware ? `ΤΕΧΝΟΛΟΓΙΚΟ STACK: Για web/software components χρησιμοποίησε Next.js 16+ (App Router), Tailwind CSS, Prisma ORM, NextAuth v5, Vercel/Docker hosting. Ανέφερε αυτά στη φάση αρχιτεκτονικής και εξήγησε τα πλεονεκτήματά τους για την εταιρεία.` : ``,
      ``,
      `Χρησιμοποίησε ΑΚΡΙΒΩΣ αυτή τη δομή (αφαίρεσε ενότητα μόνο αν δεν εφαρμόζεται):`,
      ``,
      `ΕΝΑΡΞΗ ΕΡΓΟΥ`,
      `• Kick-off — σύσκεψη εκκίνησης: ορισμός ομάδων, στόχοι, αναλυτικό χρονοδιάγραμμα`,
      `• Discovery & Analysis: τεκμηρίωση απαιτήσεων, αρχιτεκτονική συστήματος, UX planning`,
      `• Παραδοτέα: [Τι παράγεται — π.χ. requirements document, wireframes, technical spec]`,
      `• Διάρκεια: [X] εβδομάδες`,
      ``,
      `ΦΑΣΗ 1: [Όνομα] ([X] εβδομάδες)`,
      `• Αντικείμενο: [Τι ακριβώς υλοποιείται — αναφορά σε συγκεκριμένες προτάσεις]`,
      `• Γιατί αυτή η φάση πρώτη: [Αιτιολόγηση σειράς — εξαρτήσεις, επιχειρηματική λογική]`,
      `• Παραδοτέα: [Τι παραλαμβάνει η εταιρεία — συγκεκριμένο, δοκιμάσιμο, λειτουργικό]`,
      `• Milestone: [Συγκεκριμένος ορόσημος — π.χ. "Σύστημα X σε παραγωγή"]`,
      `• Ώρες: [X]–[Y] | Κόστος: €[X.XXX]–€[Y.YYY]`,
      ``,
      `[ΦΑΣΗ 2, ΦΑΣΗ 3 κ.ο.κ. — τόσες φάσεις όσο χρειάζεται, ίδια δομή]`,
      ``,
      `ΟΛΟΚΛΗΡΩΣΗ & ΠΑΡΑΔΟΣΗ`,
      `• User Acceptance Testing (UAT): κριτήρια αποδοχής, διαδικασία, διάρκεια`,
      `• Εκπαίδευση: τι καλύπτεται, ποιοι χρήστες, μορφή (on-site / online / documentation)`,
      `• Go-Live: διαδικασία μετάβασης, παράλληλη λειτουργία αν χρειαστεί, rollback plan`,
      `• Υποστήριξη μετά παράδοση: τι καλύπτεται, διάρκεια, SLA`,
      ``,
      hasEstimations ? [
        `ΟΙΚΟΝΟΜΙΚΗ ΕΚΤΙΜΗΣΗ`,
        `• Σύνολο ωρών: [X]–[Y] ώρες`,
        `• Κόστος ανάπτυξης (Claude Code, €60-80/ώρα): €[X.XXX]–€[Y.YYY]`,
        `• Εναλλακτικό κόστος (παραδοσιακή ανάπτυξη): €[X.XXX]–€[Y.YYY]`,
        `• Εξοικονόμηση με Claude Code: [X]% (~€[Z.ZZZ])`,
        `• Συνολική διάρκεια έργου: [X] μήνες`,
        `• Τρόπος τιμολόγησης: [Fixed-price / Φάσεις] — [αιτιολόγησε γιατί αυτός ο τρόπος προστατεύει και τις δύο πλευρές]`,
        `• Αξία επένδυσης: [Τι αλλάζει επιχειρηματικά — ROI, εξοικονόμηση, ανταγωνιστικό πλεονέκτημα]`,
        ``,
        `ΓΙΑΤΙ CLAUDE CODE`,
        `[Παράγραφος 3-4 προτάσεων: τι είναι το Claude Code, γιατί το χρησιμοποιούμε, τι σημαίνει αυτό για ποιότητα/ταχύτητα/κόστος — με κατανοητή γλώσσα, όχι μόνο τεχνική]`,
      ].join("\n") : "",
      ``,
      `ΚΙΝΔΥΝΟΙ ΚΑΙ ΑΝΤΙΜΕΤΩΠΙΣΗ`,
      `• [Κίνδυνος]: [Πώς το αντιμετωπίζουμε — συγκεκριμένο μέτρο]`,
      `• [Κίνδυνος]: [...]`,
      `• [Κίνδυνος]: [...]`,
      ``,
      `ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ`,
      `• [Βήμα 1 — συγκεκριμένο, χωρίς πίεση]`,
      `• [Βήμα 2]`,
      `• [Βήμα 3]`,
      ``,
      `ΚΑΝΟΝΕΣ: Χρησιμοποίησε «η εταιρεία» — ΠΟΤΕ «σας». Συγκεκριμένοι αριθμοί, ρεαλιστικά εύρη. Ο μη τεχνικός αναγνώστης πρέπει να κατανοεί τα πάντα.`,
    ].filter(Boolean).join("\n")

    let unifiedProjectPlan = ""
    try {
      unifiedProjectPlan = await callDeepSeek(apiKey, SALES_SYSTEM, projectPlanPrompt, 9000)
    } catch (e) {
      console.error("[to-proposal] project plan generation failed:", e)
    }

    // ── 6. Build description HTML ───────────────────────────────────────────

    // Executive summary
    let descriptionHtml = textToHtml(execSummaryRaw)

    // Unified solution per section
    if (solutionSections.length) {
      descriptionHtml += `<p><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>`
      descriptionHtml += `<p><strong>ΤΕΧΝΙΚΗ ΛΥΣΗ</strong></p>`
      for (const s of solutionSections) {
        if (solutionSections.length > 1) {
          descriptionHtml += `<p><strong>— ${s.label} —</strong></p>`
        }
        descriptionHtml += s.html
      }
    }

    // Unified project plan (start → finish with full reasoning)
    if (unifiedProjectPlan?.trim()) {
      descriptionHtml += `<p><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>`
      descriptionHtml += `<p><strong>ΠΛΑΝΟ ΕΚΤΕΛΕΣΗΣ ΕΡΓΟΥ & ΟΙΚΟΝΟΜΙΚΗ ΠΡΟΤΑΣΗ</strong></p>`
      descriptionHtml += textToHtml(unifiedProjectPlan)
    }

    // ── 7. Create/update proposal ───────────────────────────────────────────

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

    // Upsert per-requirement responses for traceability
    for (const r of responses) {
      if (!r.response) continue
      await db.$executeRaw`
        INSERT INTO ProposalRequirementResponse (proposalId, requirementId, response, createdAt, updatedAt)
        VALUES (${proposalId}, ${r.requirementId}, ${r.response}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE response = VALUES(response), updatedAt = NOW()
      `
    }

    // Fire-and-forget notification
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
