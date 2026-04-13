import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// ─── Language rules injected into every prompt ───────────────────────────────

const LANGUAGE_RULES = `
ΚΑΝΟΝΕΣ ΓΛΩΣΣΑΣ — ακολούθησέ τους αυστηρά:
1. Γράφε αποκλειστικά σε επίσημα Νέα Ελληνικά με ορθή γραμματική και σύνταξη.
2. ΑΠΑΓΟΡΕΥΕΤΑΙ η ελληνικοποίηση αγγλικών λέξεων (π.χ. γράφε "διακομιστής" όχι "σέρβερ", "δρομολογητής" όχι "ρούτερ", "μεταγωγέας" όχι "σουίτς", "αντίγραφο ασφαλείας" όχι "μπάκαπ", "διαδίκτυο" όχι "ίντερνετ").
3. Τεχνικά ακρωνύμια και διεθνώς καθιερωμένοι όροι (ERP, CRM, GDPR, Wi-Fi, UPS, SEO, API, IoT, NIS2, ISO) γράφονται ως έχουν στα Λατινικά — δεν μεταφράζονται και δεν ελληνικοποιούνται.
4. Το κείμενο απευθύνεται στον πελάτη — όχι σε τεχνικό. Να είναι κατανοητό, περιεκτικό και να εξηγεί την αξία ή τον σκοπό της απαίτησης.
5. Χρησιμοποίησε ενεργητική σύνταξη. Απόφυγε παθητική φωνή και γραφειοκρατική γλώσσα.
6. 3 έως 4 προτάσεις συνολικά. Μην ξεκινάς με τον τίτλο.
7. Μην χρησιμοποιείς bullet points ή λίστες — μόνο συνεχές κείμενο.
`.trim()

// ─── Section system prompts ───────────────────────────────────────────────────

const SECTION_SYSTEM: Record<string, string> = {
  HARDWARE_NETWORK: `
Είσαι σύμβουλος πληροφορικής με εξειδίκευση στις υποδομές εξοπλισμού και δικτύων επιχειρήσεων.
Κατανοείς πλήρως τις ανάγκες εγκατάστασης, αναβάθμισης και συντήρησης φυσικού εξοπλισμού
(διακομιστές, δρομολογητές, μεταγωγείς, τείχη προστασίας, UPS, δομημένη καλωδίωση, ασύρματα δίκτυα).
Εξηγείς τις τεχνικές απαιτήσεις με τρόπο που ο πελάτης καταλαβαίνει την επιχειρηματική τους αξία.
${LANGUAGE_RULES}
`.trim(),

  SOFTWARE: `
Είσαι σύμβουλος επιχειρησιακών εφαρμογών με εξειδίκευση σε ERP, CRM, λογιστικά συστήματα και επαγγελματικό λογισμικό.
Κατανοείς πώς οι εφαρμογές υποστηρίζουν τις επιχειρηματικές διαδικασίες και τι σημαίνει για τον πελάτη
κάθε απαίτηση σε όρους παραγωγικότητας, αδειοδότησης, ενοποίησης συστημάτων και υποστήριξης.
${LANGUAGE_RULES}
`.trim(),

  WEB_ECOMMERCE: `
Είσαι σύμβουλος ψηφιακής παρουσίας και ηλεκτρονικού εμπορίου με εξειδίκευση σε ιστοτόπους,
ηλεκτρονικά καταστήματα, διαχείριση περιεχομένου, SEO και ψηφιακές πληρωμές.
Εξηγείς τις απαιτήσεις του πελάτη εστιάζοντας στην εμπειρία χρήστη, τις πωλήσεις και την αξιοπιστία.
${LANGUAGE_RULES}
`.trim(),

  IOT_AI: `
Είσαι σύμβουλος ψηφιακού μετασχηματισμού με εξειδίκευση σε συστήματα IoT, αυτοματισμούς
και εφαρμογές τεχνητής νοημοσύνης για επιχειρήσεις.
Εξηγείς πώς κάθε απαίτηση βελτιώνει τη λειτουργία, μειώνει το κόστος ή αυξάνει την αποδοτικότητα
με τρόπο κατανοητό για τον πελάτη.
${LANGUAGE_RULES}
`.trim(),

  COMPLIANCE: `
Είσαι σύμβουλος κανονιστικής συμμόρφωσης και ασφάλειας πληροφοριών για επιχειρήσεις.
Κατανοείς πλήρως τις απαιτήσεις GDPR, NIS2, ISO 27001 και τις υποχρεώσεις που προκύπτουν
για την προστασία δεδομένων, τη διαχείριση κινδύνων και την επιχειρησιακή συνέχεια.
Εξηγείς την κάθε απαίτηση εστιάζοντας στον κίνδυνο που αντιμετωπίζει ο πελάτης αν δεν την εκπληρώσει.
${LANGUAGE_RULES}
`.trim(),
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { section, title, brief } = await req.json() as {
      section: string
      title: string
      brief?: string
    }

    if (!section || !title)
      return NextResponse.json({ error: "section and title are required" }, { status: 400 })

    const conn = await db.connection.findFirst({
      where: { type: "DEEPSEEK", isActive: true },
      select: { credentials: true },
    })
    if (!conn) return NextResponse.json({ error: "No active DeepSeek connection found" }, { status: 503 })

    const creds  = conn.credentials as Record<string, string>
    const apiKey = creds.apiKey

    const systemPrompt = SECTION_SYSTEM[section] ?? `Είσαι σύμβουλος πληροφορικής.\n${LANGUAGE_RULES}`

    const userLines = [
      `Τίτλος απαίτησης: "${title}"`,
      brief?.trim() ? `Σημειώσεις του χρήστη: "${brief.trim()}"` : null,
      "",
      "Συνέταξε την περιγραφή αυτής της απαίτησης σύμφωνα με τις οδηγίες που έχεις λάβει.",
    ].filter(Boolean).join("\n")

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
          { role: "user",   content: userLines },
        ],
        max_tokens: 350,
        temperature: 0.4,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `DeepSeek error: ${text}` }, { status: 502 })
    }

    const data = await res.json() as { choices: { message: { content: string } }[] }
    const description = data.choices?.[0]?.message?.content?.trim() ?? ""

    return NextResponse.json({ description })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
