"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireResourceAction } from "@/lib/rbac-guard"
import type { SurveySection, QuestionType } from "@prisma/client"

export type SurveyQuestionRow = {
  id: number
  section: SurveySection
  key: string
  label: string
  type: QuestionType
  optionsSource: string | null
  options: string[] | null
  order: number
  isActive: boolean
}

type Input = {
  section: SurveySection
  key: string
  label: string
  type: QuestionType
  optionsSource?: string | null
  options?: string[] | null
  order: number
  isActive: boolean
}

type Result = { question?: SurveyQuestionRow; error?: string; success?: boolean; deleted?: number }

function toRow(q: any): SurveyQuestionRow {
  return {
    id: q.id,
    section: q.section,
    key: q.key,
    label: q.label,
    type: q.type,
    optionsSource: q.optionsSource ?? null,
    options: Array.isArray(q.options) ? (q.options as string[]) : null,
    order: q.order,
    isActive: q.isActive,
  }
}

export async function createSurveyQuestion(data: Input): Promise<Result> {
  try { await requireResourceAction("master-options", "add") } catch { return { error: "Unauthorized" } }
  if (!data.key.trim())   return { error: "Key is required" }
  if (!data.label.trim()) return { error: "Label is required" }
  const existing = await db.surveyQuestion.findUnique({ where: { key: data.key.trim() } })
  if (existing) return { error: "A question with that key already exists" }
  const q = await db.surveyQuestion.create({
    data: {
      section: data.section,
      key: data.key.trim(),
      label: data.label.trim(),
      type: data.type,
      optionsSource: data.optionsSource?.trim() || null,
      options: (data.options?.length ? data.options : null) as any,
      order: data.order,
      isActive: data.isActive,
    },
  })
  revalidatePath("/master-options/survey-questions")
  return { question: toRow(q) }
}

export async function updateSurveyQuestion(id: number, data: Partial<Input>): Promise<Result> {
  try { await requireResourceAction("master-options", "edit") } catch { return { error: "Unauthorized" } }
  if (data.key !== undefined && !data.key.trim()) return { error: "Key is required" }
  if (data.label !== undefined && !data.label.trim()) return { error: "Label is required" }
  const q = await db.surveyQuestion.update({
    where: { id },
    data: {
      ...(data.section      !== undefined && { section: data.section }),
      ...(data.key          !== undefined && { key: data.key.trim() }),
      ...(data.label        !== undefined && { label: data.label.trim() }),
      ...(data.type         !== undefined && { type: data.type }),
      ...(data.order        !== undefined && { order: data.order }),
      ...(data.isActive     !== undefined && { isActive: data.isActive }),
      optionsSource: data.optionsSource !== undefined ? (data.optionsSource?.trim() || null) : undefined,
      options: data.options !== undefined ? ((data.options?.length ? data.options : null) as any) : undefined,
    },
  })
  revalidatePath("/master-options/survey-questions")
  return { question: toRow(q) }
}

export async function deleteSurveyQuestion(id: number): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  await db.surveyQuestion.delete({ where: { id } })
  revalidatePath("/master-options/survey-questions")
  return { success: true }
}

export async function deleteSurveyQuestions(ids: number[]): Promise<Result> {
  try { await requireResourceAction("master-options", "delete") } catch { return { error: "Unauthorized" } }
  const { count } = await db.surveyQuestion.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/master-options/survey-questions")
  return { deleted: count }
}
