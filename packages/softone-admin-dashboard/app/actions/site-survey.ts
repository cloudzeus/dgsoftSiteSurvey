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
