// Mailgun EU client
// Env vars: MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_ENDPOINT
// Endpoint is EU: https://api.eu.mailgun.net

export interface MailAttachment {
  filename: string
  data: Buffer
  contentType: string
}

export interface MailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string          // plain-text alternative — always provide this to avoid spam
  from?: string
  replyTo?: string
  attachments?: MailAttachment[]
}

export interface MailResult {
  id: string
  message: string
}

function mailgunEnv() {
  const apiKey = process.env.MAILGUN_API_KEY
  const domain = process.env.MAILGUN_DOMAIN
  const endpoint = process.env.MAILGUN_ENDPOINT ?? "https://api.eu.mailgun.net"
  if (!apiKey || !domain) throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN must be set")
  return { apiKey, domain, endpoint }
}

/** Strip HTML tags to produce a plain-text fallback */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Send an email via Mailgun EU.
 * Always sends multipart (html + text) for best deliverability.
 * Falls back to URLSearchParams when no attachments and text fits.
 */
export async function sendMail(opts: MailOptions): Promise<MailResult> {
  const { apiKey, domain, endpoint } = mailgunEnv()

  // Use platform@ instead of noreply@ — spam filters penalise no-reply senders
  const from  = opts.from ?? `DG Smart <platform@${domain}>`
  const to    = Array.isArray(opts.to) ? opts.to.join(",") : opts.to
  const auth  = `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`
  const text  = opts.text ?? htmlToText(opts.html)

  // Always use multipart/form-data — supports text + attachments + custom headers
  const fd = new FormData()
  fd.append("from", from)
  fd.append("to", to)
  fd.append("subject", opts.subject)
  fd.append("html", opts.html)
  fd.append("text", text)
  // Unsubscribe header — required by Gmail/Outlook bulk sender guidelines
  fd.append("h:List-Unsubscribe", `<mailto:platform@${domain}?subject=unsubscribe>`)
  fd.append("h:X-Mailer", "DGSmart-Platform/1.0")
  if (opts.replyTo) fd.append("h:Reply-To", opts.replyTo)

  for (const att of opts.attachments ?? []) {
    fd.append(
      "attachment",
      new Blob([att.data.buffer as ArrayBuffer], { type: att.contentType }),
      att.filename,
    )
  }

  const res = await fetch(`${endpoint}/v3/${domain}/messages`, {
    method: "POST",
    headers: { Authorization: auth },
    body: fd,
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Mailgun error [${res.status}]: ${txt}`)
  }

  return res.json() as Promise<MailResult>
}
