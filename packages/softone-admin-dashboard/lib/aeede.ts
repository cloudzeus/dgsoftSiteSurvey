// AEEDE VAT lookup — queries https://vat.wwa.gr/afm2info
// No authentication required. Server-side only.
//
// Usage:
//   import { aeedeVatLookup } from "@/lib/aeede"
//   const result = await aeedeVatLookup("099095556")
//   result.basicRec.onomasia
//   result.activities[0].firmActDescr

const BASE_URL = "https://vat.wwa.gr/afm2info"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AeedeBasicRec {
  afm: string
  doy: string
  doyDescr: string
  iNiFlagDescr: string
  deactivationFlag: string
  deactivationFlagDescr: string
  firmFlagDescr: string
  onomasia: string
  commerTitle: string
  legalStatusDescr: string
  postalAddress: string
  postalAddressNo: string
  postalZipCode: string
  postalAreaDescription: string
  registDate: string
  stopDate: string | null
  normalVatSystemFlag: string
}

export interface AeedeFirmActivity {
  firmActCode: string
  firmActDescr: string
  firmActKind: string
  firmActKindDescr: string
}

export interface AeedeResult {
  basicRec: AeedeBasicRec
  activities: AeedeFirmActivity[]
}

// ─── Internals ─────────────────────────────────────────────────────────────────

/**
 * Safely coerce any API field to a string.
 * The AEEDE API is XML-derived — nil fields arrive as { "$": { "xsi:nil": "true" } }
 * instead of null. Any object value is treated as empty string.
 */
function str(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (typeof raw === "string") return raw
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw)
  // Object with $ key = xsi:nil — and any other unexpected object
  return ""
}

function parseStopDate(raw: unknown): string | null {
  const s = str(raw)
  return s || null
}

function normaliseActivities(raw: unknown): AeedeFirmActivity[] {
  if (!raw || typeof raw !== "object") return []
  const tab = raw as Record<string, unknown>
  const items = tab.item
  if (!items) return []
  const arr = Array.isArray(items) ? items : [items]
  return arr.map((item: any) => ({
    firmActCode:      str(item.firm_act_code),
    firmActDescr:     str(item.firm_act_descr),
    firmActKind:      str(item.firm_act_kind),
    firmActKindDescr: str(item.firm_act_kind_descr),
  }))
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function aeedeVatLookup(afm: string): Promise<AeedeResult> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ afm }),
    cache: "no-store",
  })

  if (!res.ok) throw new Error(`AEEDE VAT lookup failed: ${res.status} ${res.statusText}`)

  const data = await res.json()
  const r = data.basic_rec ?? {}

  return {
    basicRec: {
      afm:                   str(r.afm),
      doy:                   str(r.doy),
      doyDescr:              str(r.doy_descr),
      iNiFlagDescr:          str(r.i_ni_flag_descr),
      deactivationFlag:      str(r.deactivation_flag),
      deactivationFlagDescr: str(r.deactivation_flag_descr),
      firmFlagDescr:         str(r.firm_flag_descr),
      onomasia:              str(r.onomasia),
      commerTitle:           str(r.commer_title),
      legalStatusDescr:      str(r.legal_status_descr),
      postalAddress:         str(r.postal_address),
      postalAddressNo:       str(r.postal_address_no),
      postalZipCode:         str(r.postal_zip_code),
      postalAreaDescription: str(r.postal_area_description),
      registDate:            str(r.regist_date),
      stopDate:              parseStopDate(r.stop_date),
      normalVatSystemFlag:   str(r.normal_vat_system_flag),
    },
    activities: normaliseActivities(data.firm_act_tab),
  }
}
