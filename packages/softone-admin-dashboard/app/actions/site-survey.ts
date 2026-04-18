"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"

export type SurveySection =
  | "hardware_network"
  | "software"
  | "web_ecommerce"
  | "compliance"
  | "iot_ai"
  | "voip"

export type SurveyStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"

export interface SiteSurveyInput {
  name: string
  description?: string | undefined
  date: string // ISO string
  customerId: number
  surveyorId: string
  branchIds: number[]
  sections: SurveySection[]
  status: SurveyStatus
}

export async function createSiteSurvey(input: SiteSurveyInput) {
  await db.siteSurvey.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      date: new Date(input.date),
      customerId: Number(input.customerId),
      surveyorId: String(input.surveyorId),
      branchIds: Array.isArray(input.branchIds) ? input.branchIds.map(Number) : [],
      sections: Array.isArray(input.sections) ? input.sections : [],
      status: input.status,
    },
  })
  revalidatePath("/site-survey")
  revalidatePath("/customers")
}

export async function updateSiteSurvey(id: number, input: Partial<SiteSurveyInput>) {
  await db.siteSurvey.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.date !== undefined && { date: new Date(input.date) }),
      ...(input.surveyorId !== undefined && { surveyorId: input.surveyorId }),
      ...(input.branchIds !== undefined && { branchIds: input.branchIds }),
      ...(input.sections !== undefined && { sections: input.sections }),
      ...(input.status !== undefined && { status: input.status }),
    },
  })
  revalidatePath("/site-survey")
}

export async function deleteSiteSurvey(id: number) {
  await db.siteSurvey.delete({ where: { id } })
  revalidatePath("/site-survey")
}

// ─── Section removal ─────────────────────────────────────────────────────────
// Removing a section drops the section key from SiteSurvey.sections AND deletes
// every dependent row (answers, audit history, invitations, client requirements)
// for that section. Destructive — UI must confirm.

const SECTION_KEY_TO_ENUM: Record<string, string> = {
  hardware_network: "HARDWARE_NETWORK",
  software: "SOFTWARE",
  web_ecommerce: "WEB_ECOMMERCE",
  compliance: "COMPLIANCE",
  iot_ai: "IOT_AI",
  voip: "VOIP",
}

export async function getSurveySectionImpact(
  surveyId: number,
  sectionKey: string,
): Promise<{ ok: true; answers: number; history: number; invitations: number; requirements: number } | { ok: false; error: string }> {
  const enumValue = SECTION_KEY_TO_ENUM[sectionKey]
  if (!enumValue) return { ok: false, error: "Άγνωστη ενότητα" }

  const questionIds = (await db.surveyQuestion.findMany({
    where: { section: enumValue as never },
    select: { id: true },
  })).map((q) => q.id)

  const [answers, history, invitations, requirements] = await Promise.all([
    questionIds.length > 0
      ? db.surveyResult.count({ where: { surveyId, questionId: { in: questionIds } } })
      : Promise.resolve(0),
    questionIds.length > 0
      ? db.surveyResultHistory.count({ where: { surveyId, questionId: { in: questionIds } } })
      : Promise.resolve(0),
    db.surveyInvitation.count({ where: { surveyId, sectionKey } }),
    db.clientRequirement.count({ where: { surveyId, section: enumValue as never } }),
  ])

  return { ok: true, answers, history, invitations, requirements }
}

export async function removeSurveySection(
  surveyId: number,
  sectionKey: string,
): Promise<{ ok: true; remainingSections: string[] } | { ok: false; error: string }> {
  const enumValue = SECTION_KEY_TO_ENUM[sectionKey]
  if (!enumValue) return { ok: false, error: "Άγνωστη ενότητα" }

  const survey = await db.siteSurvey.findUnique({
    where: { id: surveyId },
    select: { sections: true },
  })
  if (!survey) return { ok: false, error: "Δεν βρέθηκε η έρευνα" }

  const currentSections = Array.isArray(survey.sections) ? (survey.sections as string[]) : []
  if (!currentSections.includes(sectionKey)) {
    return { ok: false, error: "Η ενότητα δεν υπάρχει σε αυτήν την έρευνα" }
  }

  const questionIds = (await db.surveyQuestion.findMany({
    where: { section: enumValue as never },
    select: { id: true },
  })).map((q) => q.id)

  const remainingSections = currentSections.filter((s) => s !== sectionKey)

  await db.$transaction(async (tx) => {
    if (questionIds.length > 0) {
      await tx.surveyResult.deleteMany({ where: { surveyId, questionId: { in: questionIds } } })
      await tx.surveyResultHistory.deleteMany({ where: { surveyId, questionId: { in: questionIds } } })
    }
    await tx.surveyInvitation.deleteMany({ where: { surveyId, sectionKey } })
    await tx.clientRequirement.deleteMany({ where: { surveyId, section: enumValue as never } })
    await tx.siteSurvey.update({
      where: { id: surveyId },
      data: { sections: remainingSections },
    })
  })

  revalidatePath("/site-survey")
  return { ok: true, remainingSections }
}

// ─── File actions ─────────────────────────────────────────────────────────────

export interface SurveyFileRow {
  id: number
  customerId: number
  surveyId: number
  section: string | null
  type: string | null
  name: string
  cdnUrl: string
  mimeType: string
  size: number
  uploadedBy: string | null
  createdAt: Date
}

export async function getSurveyFiles(surveyId: number, section?: string): Promise<SurveyFileRow[]> {
  return db.$queryRaw<SurveyFileRow[]>`
    SELECT id, customerId, surveyId, section, type, name, cdnUrl, mimeType, size, uploadedBy, createdAt
    FROM File
    WHERE surveyId = ${surveyId}
    ORDER BY createdAt DESC
  `
}

export async function deleteSurveyFile(surveyId: number, fileId: number): Promise<void> {
  await db.$executeRaw`
    DELETE FROM File WHERE id = ${fileId} AND surveyId = ${surveyId}
  `
  revalidatePath("/site-survey")
}

// ─── Customer file actions ────────────────────────────────────────────────────

export interface CustomerFileRow {
  id: number
  customerId: number
  surveyId: number | null
  section: string | null
  type: string | null
  name: string
  cdnUrl: string
  mimeType: string
  size: number
  uploadedBy: string | null
  createdAt: Date
}

export async function getCustomerFiles(customerId: number): Promise<CustomerFileRow[]> {
  return db.$queryRaw<CustomerFileRow[]>`
    SELECT id, customerId, surveyId, section, type, name, cdnUrl, mimeType, size, uploadedBy, createdAt
    FROM File
    WHERE customerId = ${customerId} AND surveyId IS NULL
    ORDER BY createdAt DESC
  `
}

export async function deleteCustomerFile(customerId: number, fileId: number): Promise<void> {
  await db.$executeRaw`
    DELETE FROM File WHERE id = ${fileId} AND customerId = ${customerId} AND surveyId IS NULL
  `
  revalidatePath("/customers")
}

export async function getCustomerBranches(customerId: number) {
  const [branches, customer] = await Promise.all([
    db.trdBranch.findMany({
      where: { customerId },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    db.customer.findUnique({
      where: { id: customerId },
      select: { address: true, city: true, zip: true },
    }),
  ])
  const parts = [customer?.address, customer?.city, customer?.zip].filter(Boolean)
  const mainAddress = parts.length > 0 ? parts.join(", ") : null
  return { branches, mainAddress }
}
