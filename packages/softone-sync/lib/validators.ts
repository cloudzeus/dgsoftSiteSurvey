// Zod validators for Softone records and sync config inputs

import { z } from "zod"

// ─── Softone record ───────────────────────────────────────────────────────────

export const S1RecordSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null()])
)

export type S1Record = z.infer<typeof S1RecordSchema>

// ─── Field mapping input ──────────────────────────────────────────────────────

export const FieldMappingInputSchema = z.object({
  softoneFieldName: z.string().min(1),
  localColumnName: z.string().min(1),
  dataType: z.enum(["character", "numeric", "datetime", "logical"]),
  isPrimaryKey: z.boolean().default(false),
  isTimestamp: z.boolean().default(false),
  isSyncable: z.boolean().default(true),
  isCustom: z.boolean().default(false),
  transformation: z.string().nullable().optional(),
  relatedConfigId: z.string().nullable().optional(),
  relatedLabelField: z.string().nullable().optional(),
  relatedValueField: z.string().nullable().optional(),
})

// ─── Sync config input ────────────────────────────────────────────────────────

export const SyncConfigInputSchema = z.object({
  objectName: z.string().min(1),
  tableName: z.string().min(1),
  usageType: z.enum(["PERSISTENT", "REFERENCE"]).default("PERSISTENT"),
  syncDirection: z.enum(["READ", "WRITE", "BIDIRECTIONAL"]).default("READ"),
  batchSize: z.number().int().min(1).max(1000).default(100),
  syncSchedule: z.string().default("0 */6 * * *"),
  conflictStrategy: z
    .enum(["SOFTONE_WINS", "LOCAL_WINS", "MANUAL_REVIEW"])
    .default("SOFTONE_WINS"),
  showInMenu: z.boolean().default(false),
  menuLabel: z.string().optional(),
  menuIcon: z.string().optional(),
  filterClause: z.string().optional(),
  fieldMappings: z.array(FieldMappingInputSchema).min(1),
  createdBy: z.string().min(1),
})

// ─── Validate a batch of records ──────────────────────────────────────────────

export function validateRecords(
  records: unknown[]
): { valid: S1Record[]; invalid: { index: number; error: string }[] } {
  const valid: S1Record[] = []
  const invalid: { index: number; error: string }[] = []

  for (let i = 0; i < records.length; i++) {
    const result = S1RecordSchema.safeParse(records[i])
    if (result.success) {
      valid.push(result.data)
    } else {
      invalid.push({ index: i, error: result.error.message })
    }
  }

  return { valid, invalid }
}
