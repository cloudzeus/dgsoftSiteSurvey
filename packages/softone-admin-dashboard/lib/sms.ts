// Yuboto Octapush OMNI SMS client
// Env vars: YUBOTO_API_KEY, YUBOTO_SENDER
// API docs: https://octapush.yuboto.com/Data/pushc8b5-35c9-4b8c-9670-8f0dcb2ad364/OMNI_API_Documentation.pdf

const BASE_URL = "https://services.yuboto.com/omni/v1"

export interface SmsOptions {
  to: string | string[]
  text: string
  sender?: string
  /** SMS type: "sms" | "Flash" | "unicode". Defaults to "sms". */
  type?: "sms" | "Flash" | "unicode"
  /** Allow messages over 160 chars (multi-part). Defaults to true. */
  longSms?: boolean
  /** Validity in minutes (30–4320). Defaults to 1440. */
  validity?: number
  /** Request delivery receipt. */
  dlr?: boolean
  callbackUrl?: string
}

export interface SmsResult {
  messageId: string
  phone: string
  status: string
  errorCode: number
}

function yubotoEnv() {
  const apiKey = process.env.YUBOTO_API_KEY
  const sender = process.env.YUBOTO_SENDER

  if (!apiKey) throw new Error("YUBOTO_API_KEY must be set")
  if (!sender) throw new Error("YUBOTO_SENDER must be set")

  return { apiKey, sender }
}

function authHeader(apiKey: string) {
  return `Basic ${Buffer.from(apiKey).toString("base64")}`
}

async function yubotoPost(path: string, apiKey: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: authHeader(apiKey),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Yuboto error [${res.status}]: ${text}`)
  }

  return res.json()
}

/**
 * Send one or more SMS messages via Yuboto Octapush.
 * Uses YUBOTO_API_KEY and YUBOTO_SENDER from env.
 */
export async function sendSms(opts: SmsOptions): Promise<SmsResult[]> {
  const { apiKey, sender } = yubotoEnv()

  const phones = Array.isArray(opts.to) ? opts.to : [opts.to]
  const contacts = phones.map((p) => ({ phonenumber: p }))

  const body = {
    contacts,
    sms: {
      sender: opts.sender ?? sender,
      text: opts.text,
      typesms: opts.type ?? "sms",
      longsms: opts.longSms ?? true,
      validity: opts.validity ?? 1440,
    },
    ...(opts.dlr !== undefined ? { dlr: opts.dlr } : {}),
    ...(opts.callbackUrl ? { callbackUrl: opts.callbackUrl } : {}),
  }

  const data = await yubotoPost("/Send", apiKey, body)

  if (data.ErrorCode !== 0) {
    throw new Error(`Yuboto API error: ${data.ErrorMessage || data.ErrorCode}`)
  }

  return (data.Message ?? []).map((m: any) => ({
    messageId: m.id,
    phone: m.phonenumber,
    status: m.status,
    errorCode: m.errorCode,
  }))
}

/**
 * Fetch account balance from Yuboto.
 * Useful for health checks.
 */
export async function getSmsBalance(): Promise<{ balance: number; type: string }> {
  const { apiKey } = yubotoEnv()
  const data = await yubotoPost("/UserBalance", apiKey)

  if (data.ErrorCode !== 0) {
    throw new Error(`Yuboto API error: ${data.ErrorMessage || data.ErrorCode}`)
  }

  return {
    balance: data.currentBalance ?? 0,
    type: data.type ?? "unknown",
  }
}

/**
 * Send SMS with explicit API key and sender (not from env).
 * Used by the connector test flow.
 */
export async function sendSmsWithKey(
  apiKey: string,
  sender: string,
  to: string,
  text: string,
): Promise<SmsResult[]> {
  const contacts = [{ phonenumber: to }]
  const body = {
    contacts,
    sms: { sender, text, typesms: "sms", longsms: true, validity: 1440 },
  }

  const data = await yubotoPost("/Send", apiKey, body)

  if (data.ErrorCode !== 0) {
    throw new Error(`Yuboto API error: ${data.ErrorMessage || data.ErrorCode}`)
  }

  return (data.Message ?? []).map((m: any) => ({
    messageId: m.id,
    phone: m.phonenumber,
    status: m.status,
    errorCode: m.errorCode,
  }))
}
