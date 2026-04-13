"use server"

import { aeedeVatLookup, type AeedeResult } from "@/lib/aeede"
import { structuredGeocode } from "@/lib/geocode"
import { findCompanyWeb, type CompanyWebInfo } from "@/lib/brave-search"
import { db } from "@/lib/db"

export async function lookupVat(afm: string): Promise<
  | { ok: true; data: AeedeResult }
  | { ok: false; error: string }
> {
  const clean = afm.trim().replace(/\s/g, "")
  if (!/^\d{9}$/.test(clean)) {
    return { ok: false, error: "Ο ΑΦΜ πρέπει να αποτελείται από 9 ψηφία." }
  }
  try {
    const data = await aeedeVatLookup(clean)
    if (!data.basicRec.afm) return { ok: false, error: "Δεν βρέθηκαν στοιχεία για τον ΑΦΜ." }
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Σφάλμα σύνδεσης με την υπηρεσία AEEDE." }
  }
}

export interface AddressComponents {
  street?: string
  houseNumber?: string
  postalCode?: string
  city?: string
}

export async function geocodeAddress(components: AddressComponents): Promise<
  | { ok: true; lat: number; lon: number; displayName: string }
  | { ok: false; error: string }
> {
  if (!components.city && !components.postalCode && !components.street) {
    return { ok: false, error: "Δεν υπάρχουν αρκετά στοιχεία διεύθυνσης." }
  }
  try {
    const results = await structuredGeocode({
      street:      components.street,
      houseNumber: components.houseNumber,
      postalCode:  components.postalCode,
      city:        components.city,
    })
    if (!results.length) return { ok: false, error: "Δεν βρέθηκαν συντεταγμένες για αυτή τη διεύθυνση." }
    const { lat, lon, displayName } = results[0]!
    return { ok: true, lat, lon, displayName }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Σφάλμα geocoding." }
  }
}

export async function saveCustomerGeodata(
  customerId: number,
  address: { street?: string; postalCode?: string; city?: string },
): Promise<{ ok: true; lat: number; lon: number; displayName: string } | { ok: false; error: string }> {
  if (!address.city && !address.postalCode && !address.street) {
    return { ok: false, error: "Δεν υπάρχουν αρκετά στοιχεία διεύθυνσης." }
  }
  try {
    const addr: Parameters<typeof structuredGeocode>[0] = {}
    if (address.street)     addr.street     = address.street
    if (address.postalCode) addr.postalCode = address.postalCode
    if (address.city)       addr.city       = address.city
    const results = await structuredGeocode(addr)
    if (!results.length) return { ok: false, error: "Δεν βρέθηκαν συντεταγμένες για αυτή τη διεύθυνση." }
    const first = results[0]
    if (!first) return { ok: false, error: "Δεν βρέθηκαν συντεταγμένες για αυτή τη διεύθυνση." }
    const { lat, lon, displayName } = first
    await db.$executeRaw`UPDATE Customer SET latitude = ${lat}, longitude = ${lon} WHERE id = ${customerId}`
    return { ok: true, lat, lon, displayName }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Σφάλμα geocoding." }
  }
}

export async function saveCustomerKads(
  customerId: number,
  afm: string,
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  const clean = afm.trim().replace(/\s/g, "")
  if (!/^\d{9}$/.test(clean)) return { ok: false, error: "Ο ΑΦΜ πρέπει να αποτελείται από 9 ψηφία." }
  try {
    const res = await fetch("https://vat.wwa.gr/afm2info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afm: clean }),
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as {
      basic_rec?: { afm?: string; regist_date?: string }
      firm_act_tab?: { item?: { firm_act_code: string; firm_act_descr: string; firm_act_kind: string }[] }
    }

    if (!data.basic_rec?.afm) return { ok: false, error: "Δεν βρέθηκαν στοιχεία για τον ΑΦΜ." }

    const items = data.firm_act_tab?.item ?? []
    if (!items.length) return { ok: false, error: "Δεν βρέθηκαν ΚΑΔ για τον ΑΦΜ." }

    const now = new Date()
    const registDate = data.basic_rec.regist_date ? new Date(data.basic_rec.regist_date) : null

    await db.$executeRaw`DELETE FROM CompanyKad WHERE customerId = ${customerId}`

    for (const act of items) {
      await db.$executeRaw`
        INSERT INTO CompanyKad (customerId, kadCode, kadDescription, kadType, createdAt, updatedAt)
        VALUES (${customerId}, ${act.firm_act_code}, ${act.firm_act_descr}, ${act.firm_act_kind}, ${now}, ${now})
      `
    }

    if (registDate) {
      await db.$executeRaw`UPDATE Customer SET registrationDate = ${registDate} WHERE id = ${customerId}`
    }

    return { ok: true, saved: items.length }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Σφάλμα σύνδεσης με την υπηρεσία." }
  }
}

export async function lookupCompanyWeb(
  name: string,
  city: string,
): Promise<
  | { ok: true; data: CompanyWebInfo }
  | { ok: false; error: string }
> {
  if (!name.trim()) return { ok: false, error: "Δεν υπάρχει επωνυμία." }
  try {
    const data = await findCompanyWeb(name, city)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Σφάλμα αναζήτησης." }
  }
}
