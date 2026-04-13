// Mailgun EU client
// Env vars: MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_ENDPOINT
// Endpoint is EU: https://api.eu.mailgun.net

export interface MailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
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
 * Uses form-encoded POST (Mailgun's standard API format).
 */
export async function sendMail(opts: MailOptions): Promise<MailResult> {
  const { apiKey, domain, endpoint } = mailgunEnv()

  const from =
    opts.from ?? `Softone Sync <noreply@${domain}>`

  const to = Array.isArray(opts.to) ? opts.to.join(",") : opts.to

  const body = new URLSearchParams({
    from,
    to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.replyTo ? { "h:Reply-To": opts.replyTo } : {}),
  })

  const res = await fetch(`${endpoint}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mailgun error [${res.status}]: ${text}`)
  }

  return res.json() as Promise<MailResult>
}
