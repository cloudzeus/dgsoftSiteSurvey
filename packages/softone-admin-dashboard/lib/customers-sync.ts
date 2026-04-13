// Bidirectional sync between local Customer table and Softone CUSTOMER object.
// Pull: getBrowserInfo (date filter) → getBrowserData (TRDR list) → getData per record
// Push: local rows modified locally → setData to S1

import axios from "axios"
import iconv from "iconv-lite"
import { db } from "@/lib/db"
import { s1, s1Session } from "@/lib/s1"
import type { Customer } from "@prisma/client"

const LOCATEINFO =
  "CUSTOMER:TRDR,CODE,NAME,AFM,SOTITLE,ISPROSP,COUNTRY,ADDRESS,ZIP,DISTRICT," +
  "CITY,AREA,LATITUDE,LONGITUDE,PHONE01,PHONE02,JOBTYPE,JOBTYPETRD," +
  "TRDPGROUP,WEBPAGE,EMAIL,EMAILACC,TRDBUSINESS,IRSDATA,CONSENT,PRJCS," +
  "REMARK,INSDATE,UPDDATE"

const GET_TABLE_FIELDS = "TRDR,CODE,NAME,afm,irsdata,email,emailacc,phone01,phone02,address,city,country,insdate,upddate"

export interface SyncResult {
  pulled: number
  pushed: number
  errors: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date | null {
  if (!val) return null
  const d = new Date(String(val))
  return isNaN(d.getTime()) ? null : d
}

function toInt(val: unknown): number | null {
  const n = Number(val)
  return isNaN(n) || val === "" || val === null || val === undefined ? null : n
}

function toFloat(val: unknown): number | null {
  const n = parseFloat(String(val ?? ""))
  return isNaN(n) ? null : n
}

function toBool(val: unknown): boolean {
  return val === 1 || val === "1" || val === true
}

function isoDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19)
}

// ─── Pull: S1 → local ─────────────────────────────────────────────────────────

async function pullFromS1(since: Date | null): Promise<{ count: number; errors: string[] }> {
  const { clientId, appId, baseUrl } = await s1Session()
  const year = since ? since.getFullYear() : new Date().getFullYear() - 1

  const response = await axios.post(
    baseUrl,
    {
      clientId,
      appId:   Number(appId),
      version: "1",
      service: "GetTable",
      TABLE:   "CUSTOMER",
      FIELDS:  GET_TABLE_FIELDS,
      FILTER:  `insdate>${year}`,
    },
    { maxBodyLength: Infinity, maxContentLength: Infinity, responseType: "arraybuffer" },
  )

  const res: {
    success: boolean
    model?: [{ name: string; type: string }[]]
    data?:  unknown[][]
    error?: string
  } = JSON.parse(iconv.decode(Buffer.from(response.data), "win1253"))

  if (!res.success) throw new Error(`GetTable error: ${res.error}`)

  // S1 returns columnar format: model[0] = column defs, data = array of value arrays
  const cols = (res.model?.[0] ?? []).map((c) => c.name.toUpperCase())
  const rows: Record<string, unknown>[] = (res.data ?? []).map((values) =>
    Object.fromEntries(cols.map((col, i) => [col, values[i]]))
  )

  const errors: string[] = []
  let count = 0

  for (const row of rows) {
    const trdr = toInt(row.TRDR)
    if (!trdr) continue
    try {
      await db.customer.upsert({
        where: { trdr },
        create: mapS1Row(row),
        update: mapS1Row(row),
      })
      count++
    } catch (err) {
      errors.push(`TRDR ${trdr}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { count, errors }
}

function mapS1Row(row: Record<string, unknown>) {
  // S1 may return field names in any case — normalise to uppercase for lookup
  const r: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) r[k.toUpperCase()] = v

  return {
    trdr:        toInt(r.TRDR),
    code:        (r.CODE        as string) || null,
    name:        (r.NAME        as string) || null,
    afm:         (r.AFM         as string) || null,
    sotitle:     (r.SOTITLE     as string) || null,
    isprosp:     toInt(r.ISPROSP) ?? 0,
    country:     toInt(r.COUNTRY),
    address:     (r.ADDRESS     as string) || null,
    zip:         (r.ZIP         as string) || null,
    district:    (r.DISTRICT    as string) || null,
    city:        (r.CITY        as string) || null,
    area:        (r.AREA        as string) || null,
    latitude:    toFloat(r.LATITUDE),
    longitude:   toFloat(r.LONGITUDE),
    phone01:     (r.PHONE01     as string) || null,
    phone02:     (r.PHONE02     as string) || null,
    jobtype:     toInt(r.JOBTYPE),
    jobtypetrd:  (r.JOBTYPETRD  as string) || null,
    trdpgroup:   toInt(r.TRDPGROUP),
    webpage:     (r.WEBPAGE     as string) || null,
    email:       (r.EMAIL       as string) || null,
    emailacc:    (r.EMAILACC    as string) || null,
    trdbusiness: toInt(r.TRDBUSINESS),
    irsdata:     (r.IRSDATA     as string) || null,
    consent:     toBool(r.CONSENT),
    prjcs:       toInt(r.PRJCS),
    remark:      (r.REMARK      as string) || null,
    insdate:     toDate(r.INSDATE),
    upddate:     toDate(r.UPDDATE),
  }
}

// ─── Push: local → S1 ─────────────────────────────────────────────────────────

async function pushToS1(
  since: Date | null,
  pulledTrdrs: Set<number>,
): Promise<{ count: number; errors: string[] }> {
  // Only push rows that were modified locally (not just received from S1 in this run)
  const where = since
    ? { upddate: { gt: since }, NOT: { trdr: null } }
    : { NOT: { trdr: null } }

  // Also push new local rows that have no TRDR yet (trdr === null) — these are new creates
  const [modified, newRows] = await Promise.all([
    db.customer.findMany({ where }),
    db.customer.findMany({ where: { trdr: null } }),
  ])

  const toProcess: Customer[] = [
    ...modified.filter((c) => c.trdr !== null && !pulledTrdrs.has(c.trdr!)),
    ...newRows,
  ]

  const errors: string[] = []
  let count = 0

  for (const c of toProcess) {
    try {
      const res = await s1<{ success: boolean; id?: number; error?: string }>(
        "setData",
        {
          OBJECT: "CUSTOMER",
          FORM: "",
          data: {
            CUSTOMER: [mapLocalRow(c)],
          },
        },
      )

      if (!res.success) {
        errors.push(`Local id ${c.id}: ${res.error}`)
        continue
      }

      // If this was a new create, store the returned TRDR
      if (!c.trdr && res.id) {
        await db.customer.update({
          where: { id: c.id },
          data: { trdr: res.id },
        })
      }
      count++
    } catch (err) {
      errors.push(`Local id ${c.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { count, errors }
}

function mapLocalRow(c: Customer): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (c.trdr)       row.TRDR        = c.trdr
  if (c.code)       row.CODE        = c.code
  if (c.name)       row.NAME        = c.name
  if (c.afm)        row.AFM         = c.afm
  if (c.sotitle)    row.SOTITLE     = c.sotitle
  row.ISPROSP       = c.isprosp
  if (c.country)    row.COUNTRY     = c.country
  if (c.address)    row.ADDRESS     = c.address
  if (c.zip)        row.ZIP         = c.zip
  if (c.district)   row.DISTRICT    = c.district
  if (c.city)       row.CITY        = c.city
  if (c.area)       row.AREA        = c.area
  if (c.latitude != null)   row.LATITUDE    = c.latitude
  if (c.longitude != null)  row.LONGITUDE   = c.longitude
  if (c.phone01)    row.PHONE01     = c.phone01
  if (c.phone02)    row.PHONE02     = c.phone02
  if (c.jobtype)    row.JOBTYPE     = c.jobtype
  if (c.jobtypetrd) row.JOBTYPETRD  = c.jobtypetrd
  if (c.trdpgroup)  row.TRDPGROUP   = c.trdpgroup
  if (c.webpage)    row.WEBPAGE     = c.webpage
  if (c.email)      row.EMAIL       = c.email
  if (c.emailacc)   row.EMAILACC    = c.emailacc
  if (c.trdbusiness) row.TRDBUSINESS = c.trdbusiness
  if (c.irsdata)    row.IRSDATA     = c.irsdata
  row.CONSENT       = c.consent ? 1 : 0
  if (c.prjcs)      row.PRJCS       = c.prjcs
  if (c.remark)     row.REMARK      = c.remark
  return row
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function syncCustomers(): Promise<SyncResult> {
  // Derive "since" from max upddate already stored locally
  const maxRow = await db.customer.findFirst({
    orderBy: { upddate: "desc" },
    select: { upddate: true },
  })
  const since = maxRow?.upddate ?? null

  const pullResult = await pullFromS1(since)
  const pulledTrdrs = new Set(
    (await db.customer.findMany({
      where: since ? { upddate: { gte: since } } : {},
      select: { trdr: true },
    }))
      .map((c) => c.trdr)
      .filter((t): t is number => t !== null),
  )

  const pushResult = await pushToS1(since, pulledTrdrs)

  return {
    pulled: pullResult.count,
    pushed: pushResult.count,
    errors: [...pullResult.errors, ...pushResult.errors],
  }
}
