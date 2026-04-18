"use server"

import { auth } from "@/lib/auth"
import { userCanReadResource } from "@/lib/rbac-builtins"
import {
  searchGemiCompanies,
  getGemiCompany,
  getGemiCompanyDocuments,
  type GemiSearchCriteria,
  type GemiCompany,
  type GemiSearchResponse,
  type GemiDocumentSet,
} from "@/lib/gemi"

async function requireAccess(): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Δεν είστε συνδεδεμένος")
  const u = session.user as { role?: string; readResources?: string[] }
  if (!userCanReadResource(u, "vat-lookup")) throw new Error("Μη εξουσιοδοτημένη πρόσβαση")
}

export async function gemiSearch(
  criteria: GemiSearchCriteria,
): Promise<{ ok: true; data: GemiSearchResponse } | { ok: false; error: string }> {
  try {
    await requireAccess()
    const data = await searchGemiCompanies(criteria)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function gemiGetCompany(
  arGemi: string,
): Promise<{ ok: true; data: GemiCompany | null } | { ok: false; error: string }> {
  try {
    await requireAccess()
    const data = await getGemiCompany(arGemi)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function gemiGetDocuments(
  arGemi: string | number,
): Promise<{ ok: true; data: GemiDocumentSet } | { ok: false; error: string }> {
  try {
    await requireAccess()
    const data = await getGemiCompanyDocuments(arGemi)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
