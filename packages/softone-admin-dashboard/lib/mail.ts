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

  if (!apiKey || !domain) {
    throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN must be set")
  }

  return { apiKey, domain, endpoint }
}

/**
 * Send an email via Mailgun EU.
 * Uses multipart/form-data when attachments are present, otherwise form-encoded.
 */
export async function sendMail(opts: MailOptions): Promise<MailResult> {
  const { apiKey, domain, endpoint } = mailgunEnv()

  const from = opts.from ?? `DG Smart <noreply@${domain}>`
  const to   = Array.isArray(opts.to) ? opts.to.join(",") : opts.to
  const auth  = `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`

  let reqBody: BodyInit
  let headers: Record<string, string> = { Authorization: auth }

  if (opts.attachments?.length) {
    // Multipart — needed for file attachments
    const fd = new FormData()
    fd.append("from", from)
    fd.append("to", to)
    fd.append("subject", opts.subject)
    fd.append("html", opts.html)
    if (opts.replyTo) fd.append("h:Reply-To", opts.replyTo)
    for (const att of opts.attachments) {
      fd.append("attachment", new Blob([att.data.buffer as ArrayBuffer], { type: att.contentType }), att.filename)
    }
    reqBody = fd
    // Let fetch set Content-Type with boundary automatically
  } else {
    const body = new URLSearchParams({ from, to, subject: opts.subject, html: opts.html })
    if (opts.replyTo) body.set("h:Reply-To", opts.replyTo)
    reqBody = body.toString()
    headers["Content-Type"] = "application/x-www-form-urlencoded"
  }

  const res = await fetch(`${endpoint}/v3/${domain}/messages`, {
    method: "POST",
    headers,
    body: reqBody,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mailgun error [${res.status}]: ${text}`)
  }

  return res.json() as Promise<MailResult>
}
