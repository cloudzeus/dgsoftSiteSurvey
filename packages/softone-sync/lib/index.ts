// Public API of @softone/sync

export { SoftoneAPIClient, getSoftoneClient, clearSession, getStoredCompanyInfo } from "./softone-api"
export { decodeS1Response, decodeBuffer, decodeFieldValue, decodeRecord } from "./encoding"
export { processJob, triggerSyncForConfig } from "./sync-processor"
export { resolveConflict } from "./conflict-resolver"
export { checkRateLimit, handleThrottle } from "./rate-limiter"
export { uploadSyncData, deleteBunnyFile } from "./bunny-client"
export {
  S1RecordSchema,
  FieldMappingInputSchema,
  SyncConfigInputSchema,
  validateRecords,
} from "./validators"
export type {
  S1Credentials,
  S1LoginResponse,
  S1Response,
  S1ObjectField,
  S1ObjectTable,
  S1Record,
  SyncJobStatus,
  SyncOperation,
  SyncDirection,
  ConflictStrategy,
  DLQSeverity,
  AuditAction,
  JobCheckpoint,
  JobResult,
  FieldMappingConfig,
  SyncConfigInput,
  ConflictContext,
  ConflictResult,
  RateLimitConfig,
  BunnyUploadResult,
  UserRole,
  AuthUser,
} from "./types"
