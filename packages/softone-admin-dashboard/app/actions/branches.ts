"use server"

import { db } from "@/lib/db"
import { s1 } from "@/lib/s1"

export async function syncCustomerBranches(
  customerId: number,
  trdr: number,
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await s1("GetTable", {
      TABLE: "TRDBRANCH",
      FIELDS: "TRDBRANCH,CODE,NAME,TRDR,COUNTRY,IRSDATA,ADDRESS,AREAS,DISTRICT,ZIP,LATITUDE,LONGITUDE,PHONE1,PHONE2,EMAIL,EMAILACC,JOBTYPE,JOBTYPETRD,REMARKS",
      FILTER: `TRDR=${trdr}`,
    }) as any

    if (!res.success) return { ok: false, error: res.error ?? "GetTable TRDBRANCH failed" }

    const cols = ((res.model?.[0] ?? []) as { name: string }[]).map((c) => c.name.toUpperCase())
    const rows = ((res.data ?? []) as unknown[][]).map((values) =>
      Object.fromEntries(cols.map((col, i) => [col, values[i]])) as Record<string, unknown>
    )

    if (!rows.length) return { ok: true, saved: 0 }

    const now = new Date()

    for (const row of rows) {
      const branchId = row.TRDBRANCH != null ? Number(row.TRDBRANCH) : null
      if (!branchId) continue

      const code       = row.CODE       != null ? String(row.CODE)       : null
      const name       = row.NAME       != null ? String(row.NAME)       : null
      const country    = row.COUNTRY    != null ? Number(row.COUNTRY)    : null
      const irsdata    = row.IRSDATA    != null ? String(row.IRSDATA)    : null
      const address    = row.ADDRESS    != null ? String(row.ADDRESS)    : null
      const areas      = row.AREAS      != null ? String(row.AREAS)      : null
      const district   = row.DISTRICT   != null ? String(row.DISTRICT)   : null
      const zip        = row.ZIP        != null ? String(row.ZIP)        : null
      const latitude   = row.LATITUDE   != null ? Number(row.LATITUDE)   : null
      const longitude  = row.LONGITUDE  != null ? Number(row.LONGITUDE)  : null
      const phone1     = row.PHONE1     != null ? String(row.PHONE1)     : null
      const phone2     = row.PHONE2     != null ? String(row.PHONE2)     : null
      const email      = row.EMAIL      != null ? String(row.EMAIL)      : null
      const emailacc   = row.EMAILACC   != null ? String(row.EMAILACC)   : null
      const jobtype    = row.JOBTYPE    != null ? Number(row.JOBTYPE)    : null
      const jobtypetrd = row.JOBTYPETRD != null ? String(row.JOBTYPETRD) : null
      const remarks    = row.REMARKS    != null ? String(row.REMARKS)    : null

      await db.$executeRaw`
        INSERT INTO TrdBranch (customerId, trdbranch, code, name, country, irsdata, address, areas, district, zip, latitude, longitude, phone1, phone2, email, emailacc, jobtype, jobtypetrd, remarks, createdAt, updatedAt)
        VALUES (${customerId}, ${branchId}, ${code}, ${name}, ${country}, ${irsdata}, ${address}, ${areas}, ${district}, ${zip}, ${latitude}, ${longitude}, ${phone1}, ${phone2}, ${email}, ${emailacc}, ${jobtype}, ${jobtypetrd}, ${remarks}, ${now}, ${now})
        ON DUPLICATE KEY UPDATE
          customerId = ${customerId}, code = ${code}, name = ${name}, country = ${country},
          irsdata = ${irsdata}, address = ${address}, areas = ${areas}, district = ${district},
          zip = ${zip}, latitude = ${latitude}, longitude = ${longitude},
          phone1 = ${phone1}, phone2 = ${phone2}, email = ${email}, emailacc = ${emailacc},
          jobtype = ${jobtype}, jobtypetrd = ${jobtypetrd}, remarks = ${remarks}, updatedAt = ${now}
      `
    }

    return { ok: true, saved: rows.length }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" }
  }
}

export async function syncAllCustomerBranches(): Promise<
  { ok: true; synced: number; skipped: number; failed: number } | { ok: false; error: string }
> {
  try {
    const customers = await db.$queryRaw<{ id: number; trdr: number }[]>`
      SELECT id, trdr FROM Customer WHERE trdr IS NOT NULL ORDER BY id ASC
    `

    let synced = 0
    let skipped = 0
    let failed = 0

    for (const customer of customers) {
      const res = await syncCustomerBranches(customer.id, customer.trdr)
      if (!res.ok) {
        failed++
      } else if (res.saved === 0) {
        skipped++
      } else {
        synced += res.saved
      }
    }

    return { ok: true, synced, skipped, failed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync all branches failed" }
  }
}
