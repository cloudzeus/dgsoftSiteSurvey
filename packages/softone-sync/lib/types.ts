// Core TypeScript types for @softone/sync

// ─── Softone API ──────────────────────────────────────────────────────────────

export interface S1Credentials {
  /** Full services URL e.g. https://dgsoft.oncloud.gr/s1services */
  baseUrl: string
  username: string
  password: string
  appId: string
  company: string
  branch: string
  module: string
  refId: string
  /** How many hours the session token is valid on this installation. Default: 8 */
  sessionTtlHours?: number
}

export interface S1LoginResponse {
  success: boolean
  clientID: string
  companyinfo?: string  // e.g. "Company Name, Address|VAT|GEMI"
  s1u?: number
  error?: string
  errorcode?: number
  /** Available company/branch options returned from step-1 login */
  objs?: Array<{
    COMPANY: string
    COMPANYNAME: string
    BRANCH: string
    BRANCHNAME: string
    MODULE: string
    MODULENAME: string
    REFID: string
    REFIDNAME: string
  }>
}

export interface S1Response<T = unknown> {
  success: boolean
  totalcount?: number
  reqID?: string
  rows?: T[]
  error?: string
  errorcode?: number
}

export interface S1ObjectField {
  name: string
  type: string      // "character" | "numeric" | "datetime" | "logical"
  size: number
  nullable: boolean
  primaryKey: boolean
}

export interface S1ObjectTable {
  name: string
  description: string
  fields: S1ObjectField[]
}

export interface S1Record {
  [key: string]: string | number | null | undefined
  UPDDATE?: string   // Last update timestamp (Softone native field)
  INSDATE?: string   // Insert timestamp (Softone native field)
}

// ─── Sync Job ─────────────────────────────────────────────────────────────────

export type SyncJobStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "PARTIAL_FAILURE"

export type SyncOperation = "FETCH" | "CREATE" | "UPDATE" | "DELETE"

export type SyncDirection = "READ" | "WRITE" | "BIDIRECTIONAL"

export type ConflictStrategy = "SOFTONE_WINS" | "LOCAL_WINS" | "MANUAL_REVIEW"

export type DLQSeverity = "WARNING" | "ERROR" | "CRITICAL"

export type AuditAction =
  | "FETCH"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "CONFLICT_RESOLVED"

export interface JobCheckpoint {
  lastProcessedId: string | null
  offset: number
  totalFetched: number
}

export interface JobResult {
  successful: number
  failed: number
  skipped: number
  processedIds: string[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface FieldMappingConfig {
  softoneFieldName: string
  localColumnName: string
  dataType: string
  isPrimaryKey: boolean
  isTimestamp: boolean
  isSyncable: boolean
  transformation?: string
}

export interface SyncConfigInput {
  objectName: string
  tableName: string
  syncDirection?: SyncDirection
  batchSize?: number
  syncSchedule?: string
  conflictStrategy?: ConflictStrategy
  fieldMappings: FieldMappingConfig[]
  createdBy: string
}

// ─── Conflict Resolution ──────────────────────────────────────────────────────

export interface ConflictContext {
  softoneRecord: S1Record
  localRecord: Record<string, unknown>
  strategy: ConflictStrategy
  syncConfigId: string
  syncJobId: string
}

export interface ConflictResult {
  resolved: boolean
  winner: "softone" | "local" | "manual_review"
  record: S1Record | Record<string, unknown> | null
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  maxPerMinute: number
  maxPerHour: number
  backoffMs: number // ms to wait when throttled
}

// ─── Bunny CDN ────────────────────────────────────────────────────────────────

export interface BunnyUploadResult {
  url: string
  path: string
  fileId?: string
  checksumSHA256: string
  fileSize: number
}

// ─── User / RBAC ─────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER"

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  role: UserRole
}
