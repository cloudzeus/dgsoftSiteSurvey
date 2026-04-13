import type { Connector, ConnectorRecord, DiscoveredField, DiscoveredObject, FetchOptions } from "./types"
import { aeedeVatLookup } from "@/lib/aeede"

// ─── Static schema ─────────────────────────────────────────────────────────────

const COMPANY_FIELDS: DiscoveredField[] = [
  { name: "afm",                   label: "ΑΦΜ",                    dataType: "character", isPrimaryKey: true },
  { name: "onomasia",              label: "Επωνυμία",               dataType: "character" },
  { name: "commerTitle",           label: "Διακριτικός Τίτλος",     dataType: "character" },
  { name: "legalStatusDescr",      label: "Νομική Μορφή",           dataType: "character" },
  { name: "doy",                   label: "Κωδ. ΔΟΥ",              dataType: "character" },
  { name: "doyDescr",              label: "ΔΟΥ",                    dataType: "character" },
  { name: "deactivationFlagDescr", label: "Κατάσταση ΑΦΜ",         dataType: "character" },
  { name: "firmFlagDescr",         label: "Επιτηδευματίας",         dataType: "character" },
  { name: "iNiFlagDescr",          label: "Φυσικό / Μη Φυσικό Πρ.", dataType: "character" },
  { name: "postalAddress",         label: "Οδός",                   dataType: "character" },
  { name: "postalAddressNo",       label: "Αριθμός",                dataType: "character" },
  { name: "postalZipCode",         label: "ΤΚ",                     dataType: "character" },
  { name: "postalAreaDescription", label: "Περιοχή",                dataType: "character" },
  { name: "registDate",            label: "Ημ. Έναρξης",            dataType: "datetime"  },
  { name: "stopDate",              label: "Ημ. Διακοπής",           dataType: "datetime", nullable: true },
  { name: "normalVatSystemFlag",   label: "Κανονικό ΦΠΑ",          dataType: "character" },
]

const ACTIVITY_FIELDS: DiscoveredField[] = [
  { name: "firmActCode",     label: "Κωδ. Δραστηριότητας", dataType: "character", isPrimaryKey: true },
  { name: "firmActDescr",    label: "Περιγραφή",            dataType: "character" },
  { name: "firmActKind",     label: "Κωδ. Είδους",         dataType: "character" },
  { name: "firmActKindDescr", label: "Είδος",               dataType: "character" },
]

const OBJECTS: DiscoveredObject[] = [
  { name: "company",    label: "Στοιχεία Εταιρείας",  type: "record" },
  { name: "activities", label: "Δραστηριότητες ΚΑΔ",  type: "list"   },
]

// ─── Helper — parse AFM from filter string ─────────────────────────────────────
// Accepts "afm=099095556" or plain "099095556"

function extractAfm(filter?: string): string | null {
  if (!filter) return null
  const match = filter.match(/(?:afm\s*=\s*)?(\d{9,12})/)
  return match ? match[1] : null
}

// ─── Connector ─────────────────────────────────────────────────────────────────

export class AeedeConnector implements Connector {
  async testConnection() {
    try {
      const result = await aeedeVatLookup("099095556")
      if (!result.basicRec.afm) throw new Error("Empty response")
      return { ok: true, raw: result }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async discoverObjects(): Promise<DiscoveredObject[]> {
    return OBJECTS
  }

  async discoverFields(objectName: string): Promise<{ fields: DiscoveredField[]; primaryKey?: string }> {
    if (objectName === "activities") return { fields: ACTIVITY_FIELDS, primaryKey: "firmActCode" }
    return { fields: COMPANY_FIELDS, primaryKey: "afm" }
  }

  async fetchRecords(objectName: string, opts: FetchOptions): Promise<{ records: ConnectorRecord[]; total: number }> {
    const afm = extractAfm(opts.filter)
    if (!afm) return { records: [], total: 0 }

    const result = await aeedeVatLookup(afm)

    if (objectName === "activities") {
      const records: ConnectorRecord[] = result.activities.map((a) => ({
        externalId: a.firmActCode,
        data: { ...a },
      }))
      return { records, total: records.length }
    }

    // "company" — single record
    const rec: ConnectorRecord = {
      externalId: result.basicRec.afm,
      data: { ...result.basicRec },
    }
    return { records: [rec], total: 1 }
  }

  async writeRecord(): Promise<{ externalId: string }> {
    throw new Error("AEEDE VAT info is read-only")
  }
}
