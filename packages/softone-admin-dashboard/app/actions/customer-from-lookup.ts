"use server"

import { auth } from "@/lib/auth"
import { userCanReadResource } from "@/lib/rbac-builtins"
import { db } from "@/lib/db"
import type { AeedeResult } from "@/lib/aeede"
import type { GemiCompany } from "@/lib/gemi"
import type { CompanyWebInfo } from "@/lib/brave-search"
import { getGemiCompanyDocuments, reconcileContacts } from "@/lib/gemi"
import { Prisma } from "@prisma/client"

interface SaveInput {
  aeede: AeedeResult | null
  gemi: GemiCompany | null
  webInfo?: CompanyWebInfo | null
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function pickFirst<T>(arr?: T[]): T | undefined {
  return arr && arr.length > 0 ? arr[0] : undefined
}

/**
 * Create or update a Customer from combined AAEDE + GEMI lookup data.
 * Matches existing customer by AFM if found; otherwise creates new.
 *
 * Field merge precedence:
 * - AFM, name, address, KAD: AAEDE first (more authoritative for tax data), GEMI fallback
 * - GEMI-only fields (legalForm, status, capital, persons, English names): from GEMI
 * - Email/webpage: GEMI first if present, AAEDE doesn't carry these
 */
export async function saveCustomerFromLookup(
  input: SaveInput,
): Promise<{ ok: true; customerId: number; created: boolean; docCount: number } | { ok: false; error: string }> {
  try {
    const session = await auth()
    if (!session?.user) throw new Error("Δεν είστε συνδεδεμένος")
    const u = session.user as { role?: string; readResources?: string[] }
    if (!userCanReadResource(u, "vat-lookup")) throw new Error("Μη εξουσιοδοτημένη πρόσβαση")

    const { aeede, gemi, webInfo } = input
    const aeedeBasic = aeede?.basicRec
    const aeedeKads = aeede?.activities ?? []

    // Email & webpage: GEMI mislabels these constantly (URLs in email, mailto in url, etc.),
    // so classify every candidate and route to the right field. Order = priority.
    const { email: mergedEmail, webpage: mergedWebpage } = reconcileContacts(
      gemi?.email,
      gemi?.url,
      webInfo?.email,
      webInfo?.website,
    )

    const afm = aeedeBasic?.afm || gemi?.afm || null
    if (!afm) throw new Error("Δεν υπάρχει ΑΦΜ — απαιτείται για αποθήκευση πελάτη")

    // Address bits
    const streetParts = [gemi?.street, gemi?.streetNumber].filter(Boolean).join(" ")
    const address = aeedeBasic?.postalAddress
      ? [aeedeBasic.postalAddress, aeedeBasic.postalAddressNo].filter(Boolean).join(" ")
      : streetParts || null
    const zip = aeedeBasic?.postalZipCode || gemi?.zipCode || null
    const city = aeedeBasic?.postalAreaDescription || gemi?.city || null

    const existing = await db.customer.findFirst({
      where: { afm },
      select: { id: true },
    })

    const customerData = {
      afm,
      name: aeedeBasic?.onomasia || gemi?.coNameEl || null,
      sotitle: aeedeBasic?.commerTitle || pickFirst(gemi?.coTitlesEl) || null,
      nameEn: pickFirst(gemi?.coNamesEn) ?? null,
      titleEn: pickFirst(gemi?.coTitlesEn) ?? null,
      address,
      zip,
      city,
      district: gemi?.municipality?.descr ?? null,
      area: gemi?.prefecture?.descr ?? null,
      municipality: gemi?.municipality?.descr ?? null,
      prefecture: gemi?.prefecture?.descr ?? null,
      email: mergedEmail,
      webpage: mergedWebpage,
      gemiCode: gemi?.arGemi ? String(gemi.arGemi) : null,
      legalForm: gemi?.legalType?.descr ?? aeedeBasic?.legalStatusDescr ?? null,
      gemiStatus: gemi?.status?.descr ?? null,
      gemiStatusDate: parseDate(gemi?.lastStatusChange),
      gemiOffice: gemi?.gemiOffice?.descr ?? null,
      objective: gemi?.objective ?? null,
      isBranch: gemi?.isBranch ?? false,
      registrationDate: parseDate(gemi?.incorporationDate ?? aeedeBasic?.registDate),
      gemiSnapshot: gemi ? (gemi as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      gemiSyncedAt: gemi ? new Date() : null,
    }

    let customerId: number
    let created = false

    if (existing) {
      customerId = existing.id
      await db.customer.update({
        where: { id: existing.id },
        data: { ...customerData, upddate: new Date() },
      })
    } else {
      const inserted = await db.customer.create({
        data: { ...customerData, insdate: new Date(), upddate: new Date() },
        select: { id: true },
      })
      customerId = inserted.id
      created = true
    }

    // ─── KADs (from AAEDE — authoritative; do not duplicate) ──
    if (aeedeKads.length > 0) {
      for (const k of aeedeKads) {
        if (!k.firmActCode) continue
        await db.companyKad.upsert({
          where: { customerId_kadCode: { customerId, kadCode: k.firmActCode } },
          create: {
            customerId,
            kadCode: k.firmActCode,
            kadDescription: k.firmActDescr ?? "",
            kadType: k.firmActKind ?? "2",
          },
          update: {
            kadDescription: k.firmActDescr ?? "",
            kadType: k.firmActKind ?? "2",
          },
        })
      }
    }

    // ─── Capital (from GEMI) — replace strategy: clear & re-insert ──
    if (gemi?.capital && gemi.capital.length > 0) {
      await db.customerCapital.deleteMany({ where: { customerId } })
      await db.customerCapital.createMany({
        data: gemi.capital.map((c) => ({
          customerId,
          capitalStock: new Prisma.Decimal(c.capitalStock ?? 0),
          currency: c.currency ?? "EUR",
          ecsokefalaiikes: c.ecsokefalaiikes != null ? new Prisma.Decimal(c.ecsokefalaiikes) : null,
          eggiitikes: c.eggiitikes != null ? new Prisma.Decimal(c.eggiitikes) : null,
        })),
      })
    }

    // ─── Persons (from GEMI) — replace strategy ──
    if (gemi?.persons && gemi.persons.length > 0) {
      await db.customerPerson.deleteMany({ where: { customerId } })
      await db.customerPerson.createMany({
        data: gemi.persons.map((p) => {
          const obj = p as Record<string, unknown>
          return {
            customerId,
            fullName:
              [obj.firstName, obj.lastName].filter(Boolean).join(" ") ||
              (typeof obj.fullName === "string" ? obj.fullName : null),
            role: typeof obj.role === "string" ? obj.role : (typeof obj.title === "string" ? obj.title : null),
            afm: typeof obj.afm === "string" ? obj.afm : (typeof obj.taxId === "string" ? obj.taxId : null),
            startDate: parseDate(typeof obj.startDate === "string" ? obj.startDate : undefined),
            endDate: parseDate(typeof obj.endDate === "string" ? obj.endDate : undefined),
            raw: p as unknown as Prisma.InputJsonValue,
          }
        }),
      })
    }

    // ─── Documents (from GEMI /companies/{arGemi}/documents) — replace strategy ──
    let docCount = 0
    if (gemi?.arGemi) {
      try {
        const docs = await getGemiCompanyDocuments(gemi.arGemi)
        await db.customerDocument.deleteMany({ where: { customerId } })
        const decisionRows = docs.decision.map((d) => ({
          customerId,
          kind: "DECISION",
          code: d.kak ?? null,
          subject: d.decisionSubject ?? d.assembly ?? null,
          summary: d.summary ?? null,
          decisionDate: parseDate(d.dateAssemblyDecided),
          announcedDate: parseDate(d.dateAnnounced),
          registratedDate: parseDate(d.dateRegistrated),
          status: d.applicationStatusDescription ?? null,
          downloadUrl: d.assemblyDecisionUrl ?? null,
          raw: d as unknown as Prisma.InputJsonValue,
        }))
        const publicationRows = docs.publication.map((p) => ({
          customerId,
          kind: "PUBLICATION",
          code: p.kad ?? null,
          subject: null,
          summary: null,
          decisionDate: null,
          announcedDate: null,
          registratedDate: null,
          status: null,
          downloadUrl: p.url ?? null,
          raw: p as unknown as Prisma.InputJsonValue,
        }))
        const allRows = [...decisionRows, ...publicationRows]
        if (allRows.length > 0) {
          await db.customerDocument.createMany({ data: allRows })
        }
        docCount = allRows.length
      } catch {
        // Documents are best-effort — don't fail the whole save if GEMI returns 5xx.
      }
    }

    return { ok: true, customerId, created, docCount }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
