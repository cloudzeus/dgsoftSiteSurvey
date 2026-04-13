import { NextResponse } from "next/server"
import { db } from "@/lib/db"

const LANGUAGE_RULES = `
ΚΑΝΟΝΕΣ ΓΛΩΣΣΑΣ — ακολούθησέ τους αυστηρά:
1. Γράφε αποκλειστικά σε επίσημα Νέα Ελληνικά με ορθή γραμματική και σύνταξη.
2. ΑΠΑΓΟΡΕΥΕΤΑΙ η ελληνικοποίηση αγγλικών λέξεων (π.χ. γράφε "διακομιστής" όχι "σέρβερ", "δρομολογητής" όχι "ρούτερ", "αντίγραφο ασφαλείας" όχι "μπάκαπ").
3. Τεχνικά ακρωνύμια και διεθνώς καθιερωμένοι όροι (ERP, CRM, GDPR, Wi-Fi, UPS, SEO, API, IoT, NIS2, ISO) γράφονται ως έχουν — δεν μεταφράζονται.
4. Το κείμενο απευθύνεται στον πελάτη — κατανοητό, περιεκτικό, με επιχειρηματική αξία.
5. Χρησιμοποίησε ενεργητική σύνταξη. Απόφυγε παθητική φωνή και γραφειοκρατική γλώσσα.
`.trim()

const SECTION_LABELS: Record<string, string> = {
  HARDWARE_NETWORK: "Υποδομή & Δίκτυα",
  SOFTWARE:         "Λογισμικό",
  WEB_ECOMMERCE:    "Διαδίκτυο & Ηλεκτρονικό Εμπόριο",
  COMPLIANCE:       "Συμμόρφωση",
  IOT_AI:           "IoT & Τεχνητή Νοημοσύνη",
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      type: "description" | "response"
      // for description
      surveyName?: string
      customerName?: string
      sections?: string[]
      requirementsWithResponses?: { section: string; title: string; description: string; response: string }[]
      existingDescription?: string
      // for response
      section?: string
      requirementTitle?: string
      requirementDescription?: string
      existingResponse?: string
    }

    const { type } = body

    const conn = await db.connection.findFirst({
      where: { type: "DEEPSEEK", isActive: true },
      select: { credentials: true },
    })
    if (!conn) return NextResponse.json({ error: "No active DeepSeek connection found" }, { status: 503 })

    const apiKey = (conn.credentials as Record<string, string>).apiKey

    let systemPrompt: string
    let userPrompt: string
    let maxTokens: number

    if (type === "description") {
      const { surveyName, customerName, sections = [], requirementsWithResponses = [], existingDescription } = body

      const sectionNames = sections.map(s => SECTION_LABELS[s] ?? s).join(", ")

      // Build a rich context block: each requirement + our drafted response
      const reqBlock = requirementsWithResponses.length
        ? requirementsWithResponses.map((r, i) => {
            const sec = SECTION_LABELS[r.section] ?? r.section
            const lines = [`${i + 1}. [${sec}] ${r.title}`]
            if (r.description) lines.push(`   Περιγραφή: ${r.description}`)
            if (r.response)    lines.push(`   Απάντησή μας: ${r.response}`)
            return lines.join("\n")
          }).join("\n\n")
        : "—"

      systemPrompt = `
Είσαι έμπειρος σύμβουλος πληροφορικής και συντάκτης επαγγελματικών προτάσεων (proposals) για επιχειρηματικούς πελάτες.
Γράφεις το εισαγωγικό κείμενο μιας πρότασης που συνοψίζει το αντικείμενο, την προσέγγισή μας και την αξία για τον πελάτη.
Το κείμενο βασίζεται αποκλειστικά στις απαιτήσεις και τις απαντήσεις που σου δίνονται — να είναι συγκεκριμένο, όχι γενικόλογο.
${LANGUAGE_RULES}
4 έως 6 προτάσεις. Χωρίς bullet points — μόνο συνεχές κείμενο.
      `.trim()

      userPrompt = [
        `Πελάτης: ${customerName ?? "—"}`,
        `Τίτλος έρευνας: ${surveyName ?? "—"}`,
        `Ενότητες: ${sectionNames || "—"}`,
        existingDescription ? `Υπάρχον κείμενο πρότασης (βελτίωσέ το): "${existingDescription}"` : null,
        "",
        "Απαιτήσεις πελάτη και απαντήσεις μας:",
        reqBlock,
        "",
        "Συνέταξε το εισαγωγικό κείμενο της πρότασης βασισμένο στα παραπάνω.",
      ].filter(v => v !== null).join("\n")

      maxTokens = 500
    } else {
      // type === "response"
      const { section, requirementTitle, requirementDescription, existingResponse } = body

      if (!requirementTitle)
        return NextResponse.json({ error: "requirementTitle is required for response generation" }, { status: 400 })

      const sectionLabel = SECTION_LABELS[section ?? ""] ?? section ?? "Γενικό"

      systemPrompt = `
Είσαι έμπειρος σύμβουλος πληροφορικής που απαντά σε απαίτηση πελάτη στο πλαίσιο επίσημης πρότασης.
Η απάντησή σου εξηγεί πώς η εταιρεία σου θα καλύψει αυτή την απαίτηση — τι θα παρέχεις, πώς και γιατί είναι η σωστή λύση.
Είναι επαγγελματική, συγκεκριμένη και εμπνέει εμπιστοσύνη.
Ενότητα: ${sectionLabel}
${LANGUAGE_RULES}
3 έως 5 προτάσεις. Χωρίς bullet points — μόνο συνεχές κείμενο.
      `.trim()

      userPrompt = [
        `Απαίτηση: "${requirementTitle}"`,
        requirementDescription ? `Περιγραφή: "${requirementDescription}"` : null,
        existingResponse?.trim() ? `Υπάρχουσα απάντηση (βελτίωσέ τη): "${existingResponse.trim()}"` : null,
        "",
        "Συνέταξε την απάντησή μας σε αυτή την απαίτηση.",
      ].filter(Boolean).join("\n")

      maxTokens = 350
    }

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.45,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `DeepSeek error: ${text}` }, { status: 502 })
    }

    const data = await res.json() as { choices: { message: { content: string } }[] }
    const text = data.choices?.[0]?.message?.content?.trim() ?? ""

    return NextResponse.json({ text })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
