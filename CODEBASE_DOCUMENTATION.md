# Softone ERP Integration Library — Complete Codebase Documentation

**Last Updated:** April 2026  
**Project:** Enterprise-grade Next.js Softone ERP synchronization library  
**Audience:** Developers, architects, maintainers

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Core Components](#core-components)
4. [Database Schema](#database-schema)
5. [Data Flow & Sync Process](#data-flow--sync-process)
6. [Type System](#type-system)
7. [Module Reference](#module-reference)
8. [Key Algorithms](#key-algorithms)
9. [Configuration & Environment](#configuration--environment)
10. [Error Handling & Recovery](#error-handling--recovery)
11. [Integration Points](#integration-points)

---

## Architecture Overview

The Softone Integration Library is a production-grade synchronization platform built on:

- **Backend:** Next.js with TypeScript (full type safety)
- **Database:** MySQL 8 with Prisma ORM
- **File Storage:** Bunny CDN (global distribution, fast access)
- **Authentication:** auth.js v5 (OAuth + password-based)
- **UI Framework:** Shadcn + Tailwind CSS
- **Monorepo:** npm workspaces (`@softone/sync` + `softone-admin-dashboard`)

### Core Design Principles

1. **Server-side only** — No client-side Softone calls; all requests go through Next.js server
2. **Process pool** — Rate limiter + queue to respect Softone's API capacity constraints
3. **Checkpointing** — Resume from last position on failure (not idempotent)
4. **Conflict resolution** — Timestamp-based winner selection (SOFTONE_WINS, LOCAL_WINS, MANUAL_REVIEW)
5. **Encoding** — ANSI 1253 (Windows-1253) → UTF-8 conversion (Softone native)
6. **Audit trail** — Immutable log of every operation (compliance + debugging)
7. **RBAC** — Three role levels: ADMIN, OPERATOR, VIEWER (dashboard access control)

---

## Directory Structure

```
softone-erp/                                 # Monorepo root
├── packages/
│   ├── softone-sync/                        # Core sync library (@softone/sync)
│   │   ├── lib/
│   │   │   ├── types.ts                     # TypeScript type definitions
│   │   │   ├── softone-api.ts               # Softone API client (auth + discovery)
│   │   │   ├── encoding.ts                  # ANSI 1253 ↔ UTF-8 conversion
│   │   │   ├── sync-processor.ts            # Job processor (PENDING → COMPLETED)
│   │   │   ├── conflict-resolver.ts         # Timestamp-based conflict resolution
│   │   │   ├── rate-limiter.ts              # Adaptive rate limiting
│   │   │   ├── bunny-client.ts              # Bunny CDN upload/download
│   │   │   ├── validators.ts                # Zod schemas for input validation
│   │   │   └── index.ts                     # Public exports
│   │   ├── prisma/
│   │   │   └── schema.prisma                # Database schema (18 models)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── softone-admin-dashboard/             # Dashboard (Next.js app)
│       ├── app/                             # Next.js app router
│       ├── components/                      # React components
│       ├── lib/                             # Utilities
│       ├── prisma/                          # Symlink to @softone/sync schema
│       ├── public/                          # Static assets
│       └── package.json
│
├── package.json                             # Workspace root
├── tsconfig.json                            # TypeScript config
├── PROJECT_CONTEXT.md                       # Project vision + requirements
├── README.md                                # Quick start guide
├── ARCHITECTURE.md                          # Technical deep dive
└── CODEBASE_DOCUMENTATION.md                # This file
```

---

## Core Components

### 1. **types.ts** — Type Definitions

**Purpose:** Central source of truth for all TypeScript types across the library

**Key Types:**

#### Softone API Types
```typescript
S1Credentials         // Auth config (baseUrl, username, password, etc.)
S1LoginResponse       // Two-step auth response (clientID, objs[], error)
S1Response<T>         // Generic API response wrapper (success, rows[], error)
S1ObjectField         // Field definition (name, type, size, nullable)
S1ObjectTable         // Table with field definitions
S1Record              // Data row from Softone (key: string | number | null)
```

#### Job Management Types
```typescript
SyncJobStatus         // PENDING | IN_PROGRESS | COMPLETED | FAILED | PARTIAL_FAILURE
SyncOperation         // FETCH | CREATE | UPDATE | DELETE
SyncDirection         // READ | WRITE | BIDIRECTIONAL
ConflictStrategy      // SOFTONE_WINS | LOCAL_WINS | MANUAL_REVIEW
JobCheckpoint         // Resumable state (lastProcessedId, offset, totalFetched)
JobResult             // Summary (successful, failed, skipped, processedIds[])
```

#### Configuration Types
```typescript
FieldMappingConfig    // Maps Softone field → local column
SyncConfigInput       // Complete sync configuration
ConflictContext       // Conflict resolution inputs
ConflictResult        // Resolution outcome (winner, record)
```

#### Rate Limiting & Files
```typescript
RateLimitConfig       // maxPerMinute, maxPerHour, backoffMs
BunnyUploadResult     // Upload metadata (url, path, checksum, fileSize)
UserRole              // ADMIN | OPERATOR | VIEWER
AuthUser              // Session user (id, email, role)
```

---

### 2. **softone-api.ts** — Softone API Client

**Purpose:** Encapsulate all Softone API communication with two-step auth, discovery, and data fetching

**Architecture:**

```
┌─────────────────────────────────────┐
│   SoftoneAPIClient                  │
├─────────────────────────────────────┤
│ constructor(credentials)            │
│ getClientId()  ← session caching    │
│ authenticate() ← two-step auth      │
│ call<T>()      ← core RPC method    │
│ getObjects()   ← list objects       │
│ getObjectTables()                   │
│ getTableFields()                    │
│ fetchRecords() ← paginated fetch    │
│ getRecord()    ← single record      │
│ testConnection()                    │
└─────────────────────────────────────┘
```

**Key Features:**

1. **Two-Step Authentication**
   - Step 1: `login` service (returns temp clientID + available company options)
   - Step 2: `authenticate` service (returns final session clientID)
   - If COMPANY/BRANCH/MODULE/REFID env vars are missing, uses first available option

2. **Session Caching**
   - Stores clientID in `.s1session.json` with expiration
   - Refresh buffer of 5 minutes (refreshes before actual expiry)
   - Auto re-auth if token is rejected (errorcode -100 or -101)

3. **Discovery Services** (no VERSION parameter required)
   - `getObjects()` — Lists all business objects available to user
   - `getObjectTables(objectName)` — Gets table names for an object
   - `getTableFields(objectName, tableName)` — Gets field definitions with types

4. **Data Fetching** (paginated via browser pattern)
   - `fetchRecords()` — Two-phase fetch:
     - Phase 1: `getBrowserInfo` → get reqID + totalCount
     - Phase 2: `getBrowserData` → paginated rows (startindex, pagesize)
   - Fallback logic: If LIST param fails, retry with OBJECT only
   - Auto-retry if reqID expires (errorcode 13 or 213)

5. **Error Handling**
   - All responses decoded from Windows-1253 (via `decodeS1Response()`)
   - Surfaces actual Softone errors instead of generic messages
   - Tests connection via fresh login (clears cached session)

**Environment Variables:**
```
SOFTONE_URL              # Base URL (e.g., https://dgsoft.oncloud.gr)
SOFTONE_USERNAME         # Login username
SOFTONE_PASSWORD         # Login password
SOFTONE_APP_ID           # Application ID
SOFTONE_COMPANY          # (optional) Company code, falls back to first available
SOFTONE_BRANCH           # (optional) Branch code
SOFTONE_MODULE           # (optional) Module code
SOFTONE_REFID            # (optional) Reference ID
```

---

### 3. **encoding.ts** — Character Encoding Conversion

**Purpose:** Handle Windows-1253 (ANSI 1253) → UTF-8 conversion for all Softone responses

**Why It's Needed:**
- Softone (based in Greece) returns Windows-1253 encoded data
- Without proper decoding, Greek characters become garbled
- Must convert BEFORE parsing as JSON or storing in database

**Functions:**

```typescript
decodeS1Response(res: Response)     // Converts Fetch Response ArrayBuffer to UTF-8 JSON
decodeBuffer(buffer: ArrayBuffer)   // Raw ArrayBuffer → UTF-8 string
decodeFieldValue(value: string)     // Single field value (binary → UTF-8)
decodeRecord<T>(record: T)          // Recursively walk record, decode all strings
```

**Usage Pattern:**
```typescript
// ❌ WRONG — garbled text
const data = await res.json()

// ✅ RIGHT — properly decoded
const data = await decodeS1Response(res)

// ✅ ALSO OK — manual decoding after parse
const buffer = await res.arrayBuffer()
const decoded = decodeBuffer(buffer)
const data = JSON.parse(decoded)
```

---

### 4. **sync-processor.ts** — Job Processor (Core Sync Engine)

**Purpose:** Process sync jobs through their complete lifecycle: PENDING → IN_PROGRESS → COMPLETED/FAILED

**Job Lifecycle:**

```
1. PENDING      — Created but not yet running
2. IN_PROGRESS  — Currently processing records
3. COMPLETED    — All records processed successfully
   PARTIAL_FAILURE — Some records failed, but job didn't crash
4. FAILED       — Job crashed, may retry
5. DLQ (dead letter queue) — Failed after max retries
```

**Core Function: `processJob()`**

**Parameters:**
- `prisma: PrismaClient` — Database connection
- `jobId: string` — ID of job to process
- `callbacks: ProcessJobCallbacks` — Error alerts (non-blocking)
- `clientOverride?: SoftoneAPIClient` — For testing with mocks

**What It Does:**

1. **Fetch job metadata** from database
2. **Load checkpoint** (resume from last position if retrying)
3. **Fetch records in batches** from Softone (with resumption)
4. **Map fields** according to FieldMapping configuration
5. **Upsert to local table** (if PERSISTENT config)
6. **Create audit entries** for every record
7. **Update progress** after each batch (live dashboard updates)
8. **Mark COMPLETED** or PARTIAL_FAILURE
9. **On error:** Log to DLQ if max retries exceeded, fire callbacks

**Key Algorithms:**

**Checkpointing** (Resume from Last Position)
```typescript
checkpoint = {
  lastProcessedId: "12345",  // For uniqueness detection
  offset: 500,               // Current page position
  totalFetched: 500          // Records processed so far
}

// On resume:
{ records, totalCount } = await client.fetchRecords(..., { offset: 500 })
```

**Batch Processing Loop**
```
while (true) {
  fetch batch [offset:offset+batchSize]
  if (first batch):
    record totalCount
    update job.totalRecords
  
  for each record:
    map fields according to FieldMapping
    create SyncAudit entry
    upsert to local table (ON DUPLICATE KEY UPDATE)
    increment checkpoint.offset
  
  update job progress (live)
  
  if (all records fetched):
    break
  if (batch < batchSize):
    break
}
```

**Field Mapping**
```typescript
// Config defines: Softone field → Local column
fieldMappings = [
  { softoneFieldName: "CODE", localColumnName: "code", isSyncable: true },
  { softoneFieldName: "NAME", localColumnName: "name", isSyncable: true },
  { softoneFieldName: "UPDDATE", localColumnName: "updated_at", isTimestamp: true },
]

// Processor extracts only syncable fields
localData = {}
for mapping in fieldMappings:
  if mapping.isSyncable:
    localData[mapping.localColumnName] = softoneRecord[mapping.softoneFieldName]
```

**Local Table Creation** (Automatic)
```typescript
// Table name: softone_{tableName}_lowercase_with_underscores
// Example: CUSTOMERS → softone_customers

// Columns added automatically:
- Mapped fields (code, name, etc.)
- _synced_at (timestamp of last sync)
- _sync_config_id (which config synced this)

// Insert mode: ON DUPLICATE KEY UPDATE
// (Idempotent — can re-run without creating duplicates)
```

**Error Callbacks** (Non-blocking)
```typescript
// If job fails and callbacks are provided:
await callbacks.onJobFailed?.({
  jobId, syncConfigId, objectName, tableName,
  operation, retryCount, maxRetries, errorMessage
}).catch(console.error)  // Don't let email failure crash job

// If moved to DLQ:
await callbacks.onDLQCreated?.({
  dlqId, originalJobId, syncConfigId,
  operation, severity, errorReason
}).catch(console.error)
```

---

### 5. **conflict-resolver.ts** — Conflict Resolution

**Purpose:** Determine winner when both Softone and local database changed a record

**Conflict Scenario:**
```
Softone UPDDATE: 2026-04-10 14:30:00
Local updated_at: 2026-04-10 12:00:00
→ Softone is newer → SOFTONE_WINS strategy chooses Softone
```

**Strategies:**

1. **SOFTONE_WINS** (Default)
   - Compare Softone.UPDDATE vs Local.updated_at
   - Pick whichever is newer
   - If timestamps unavailable, always pick Softone

2. **LOCAL_WINS**
   - Compare Local.updated_at vs Softone.UPDDATE
   - Pick whichever is newer
   - If timestamps unavailable, always pick Local

3. **MANUAL_REVIEW**
   - Don't resolve — create DLQ entry
   - Admin must manually review and choose

**Implementation:**
```typescript
function resolveConflict(ctx: ConflictContext): ConflictResult {
  const softoneTime = getSoftoneTimestamp(softoneRecord)
  const localTime = getLocalTimestamp(localRecord)
  
  if (strategy === "SOFTONE_WINS"):
    if (softoneTime && localTime && !isAfter(softoneTime, localTime))
      return { winner: "local", record: localRecord }
    return { winner: "softone", record: softoneRecord }
  
  if (strategy === "LOCAL_WINS":
    // opposite logic
  
  if (strategy === "MANUAL_REVIEW":
    return { resolved: false, winner: "manual_review", record: null }
}
```

**Timestamp Fields:**
- Softone: `UPDDATE` (preferred) or `INSDATE` (fallback)
- Local: `updated_at` (preferred) or `updatedAt` (fallback)

---

### 6. **rate-limiter.ts** — Adaptive Rate Limiting

**Purpose:** Prevent overwhelming Softone's API with concurrent requests

**Design:**
- Backed by `RateLimitTracker` Prisma model (persisted to database)
- Tracks requests per-minute and per-hour for each connection
- Automatically resets counters when windows roll over
- Enforces backoff (default 5 min) when limits exceeded

**Configuration:**
```typescript
const DEFAULT_CONFIG: RateLimitConfig = {
  maxPerMinute: 60,           // Don't exceed 60 requests/minute
  maxPerHour: 1000,           // Don't exceed 1000 requests/hour
  backoffMs: 5 * 60 * 1000,   // Wait 5 minutes when throttled
}
```

**Check Logic:**
```
1. Load RateLimitTracker for connectionId
2. If isThrottled && before throttleUntil:
   throw "Rate limit active. Retry in Xs."
3. If throttle expired:
   reset isThrottled = false
4. Reset per-minute counter if > 1 min old
5. Reset per-hour counter if > 1 hour old
6. Increment counters
7. If exceeded:
   set isThrottled = true, throttleUntil = now + backoffMs
   throw "Rate limit exceeded. Backing off..."
```

**Public Functions:**
```typescript
checkRateLimit(prisma, connectionId, config?)  // Called before each Softone request
handleThrottle(prisma, connectionId, backoffMs) // Mark as throttled
```

---

### 7. **bunny-client.ts** — Bunny CDN Integration

**Purpose:** Upload and store sync data + database backups to Bunny CDN for global distribution and archival

**Features:**

1. **Sync Data Export**
   - Upload JSON export of sync results
   - Automatic checksumming (SHA256)
   - File retention policy (default 90 days)

2. **Database Backups**
   - Upload gzipped MySQL dumps
   - Track backup metadata (size, type, binary log position)
   - Restore procedures (managed externally)

3. **Key Functions:**

```typescript
uploadSyncData(
  prisma, syncConfigId, jobId, objectName, data
)
// Uploads JSON to: /softone/{objectName}/{date}/{jobId}.json
// Returns: { url, path, checksumSHA256, fileSize }

uploadBackup(
  prisma, backupPath, data, databaseSizeBytes
)
// Uploads to: /mysql-backups/{backupPath}
// Returns: full CDN URL

deleteBunnyFile(remotePath)
// Remove a file from CDN
```

**Environment Variables:**
```
BUNNY_ACCESS_KEY         # API key for authentication
BUNNY_STORAGE_ZONE       # Storage zone name (e.g., "softone-storage")
BUNNY_STORAGE_API_HOST   # API host (default: storage.bunnycdn.com)
BUNNY_CDN_HOSTNAME       # CDN hostname (e.g., dgsoft.b-cdn.net)
```

**File Structure:**
```
https://dgsoft.b-cdn.net/
├── softone/
│   ├── Customers/
│   │   ├── 2026-04-12/
│   │   │   └── job_abc123.json      # 2MB JSON export
│   │   └── 2026-04-11/
│   │       └── job_xyz789.json
│   └── Invoices/
│       └── 2026-04-12/
│           └── job_def456.json
└── mysql-backups/
    ├── 2026-04-12_full_0000001.gz
    ├── 2026-04-12_full_0000002.gz
    └── manifest.json
```

---

### 8. **validators.ts** — Input Validation (Zod Schemas)

**Purpose:** Validate configuration and record data before processing

**Schemas:**

```typescript
S1RecordSchema
// Ensures: object with string keys, values are string | number | null

FieldMappingInputSchema
// Validates:
// - softoneFieldName (non-empty string)
// - localColumnName (non-empty string)
// - dataType (character | numeric | datetime | logical)
// - isPrimaryKey, isTimestamp, isSyncable (booleans)
// - Optional: transformation (SQL expression or function)

SyncConfigInputSchema
// Validates complete configuration:
// - objectName, tableName (required)
// - syncDirection (READ | WRITE | BIDIRECTIONAL)
// - batchSize (1-1000, default 100)
// - syncSchedule (cron expression)
// - conflictStrategy (SOFTONE_WINS | LOCAL_WINS | MANUAL_REVIEW)
// - fieldMappings (min 1 field mapping)
// - createdBy (required — audit trail)
```

**Validation Helper:**
```typescript
function validateRecords(records: unknown[])
// Returns: { valid: S1Record[], invalid: {index, error}[] }
// Allows processing valid records + reporting invalid ones
```

---

## Database Schema

**18 Models, organized by functional area:**

### Configuration Models

**SyncConfig** (Core Configuration)
```
id: String (cuid primary key)
objectName: String         // e.g., "Customers"
tableName: String          // e.g., "CUSTOMERS"
isActive: Boolean          // Enable/disable sync
syncDirection: String      // READ | WRITE | BIDIRECTIONAL
batchSize: Int             // Records per fetch (1-1000)
lastSyncedAt: DateTime?    // Last successful sync
syncSchedule: String       // Cron expression (e.g., "0 */6 * * *")
conflictStrategy: String   // SOFTONE_WINS | LOCAL_WINS | MANUAL_REVIEW
filterClause: String?      // Optional Softone FILTERS (e.g., "TRDR.ISACTIVE=1")
createdBy: String          // User ID (audit)
createdAt, updatedAt: DateTime

Relations:
- syncJobs: SyncJob[]
- fieldMappings: FieldMapping[]
- cronJobLock: CronJobLock? (one-to-one)
- syncDataFiles: SyncDataFile[]

Indexes:
- Unique: (objectName, tableName)
- Index: isActive
```

**FieldMapping** (Field → Column Mapping)
```
id: String (cuid)
syncConfigId: String
softoneFieldName: String   // e.g., "CODE"
localColumnName: String    // e.g., "code"
dataType: String           // character | numeric | datetime | logical
isPrimaryKey: Boolean      // Natural key identifier
isTimestamp: Boolean       // UPDDATE or INSDATE?
isSyncable: Boolean        // Skip field if false
transformation: String?    // Optional transformation logic

Indexes:
- Unique: (syncConfigId, softoneFieldName)
- Foreign key: syncConfigId → SyncConfig(id)
```

### Job Queue Models

**SyncJob** (Individual Sync Operation)
```
id: String (cuid)
syncConfigId: String
status: String             // PENDING | IN_PROGRESS | COMPLETED | FAILED | PARTIAL_FAILURE
operation: String          // FETCH | CREATE | UPDATE | DELETE
totalRecords: Int          // Expected from Softone
recordsProcessed: Int      // Processed so far
recordsSuccessful: Int     // Successfully synced
recordsFailed: Int         // Errors encountered
errorMessage, errorStack: String?
lastAttempt: DateTime
retryCount: Int            // Current attempt (0-indexed)
maxRetries: Int            // Max attempts before DLQ (default 3)
checkpointData: String?    // JSON: { lastProcessedId, offset, totalFetched }
processedRecords: String?  // JSON array of record IDs
completedAt: DateTime?

Indexes:
- Index: status
- Index: (syncConfigId, status)
- Index: createdAt
```

**SyncJobDLQ** (Dead Letter Queue for Failed Jobs)
```
id: String (cuid)
originalJobId: String      // Reference to failed SyncJob
syncConfigId: String
operation: String
recordData: String (LongText)  // JSON of failing record
errorReason: String        // Error message
severity: String           // WARNING | ERROR | CRITICAL
requiresManualReview: Boolean
reviewedBy, reviewedAt: String?, DateTime?
resolution: String?        // Admin notes after resolution

Indexes:
- Index: severity
- Index: requiresManualReview
```

### Scheduling Models

**CronJobLock** (Prevent Duplicate Cron Execution)
```
id: String (cuid)
syncConfigId: String (unique)
isRunning: Boolean         // Currently executing?
lockAcquiredAt: DateTime?  // When lock was acquired
lockExpiresAt: DateTime?   // Auto-release after 1 hour (deadlock prevention)
lastCompletedAt: DateTime? // Last successful completion
nextScheduledRun: DateTime?

Indexes:
- Index: isRunning
- Unique: syncConfigId
```

### Audit Trail Model

**SyncAudit** (Immutable Operation Log)
```
id: String (cuid)
syncJobId: String          // Which job created this entry
syncConfigId: String       // Which config was syncing
action: String             // FETCH | INSERT | UPDATE | DELETE | CONFLICT_RESOLVED
recordId: String           // Softone record key
softoneData: String (LongText)  // JSON before sync
localData: String (LongText)    // JSON after sync
executedBy: String         // "system" or user ID
createdAt: DateTime

Indexes:
- Index: (syncConfigId, createdAt)
- Index: action
```

### Metadata Cache Models

**SoftoneMetadata** (24-hour Cache of Available Objects)
```
id: String (cuid)
objectName: String (unique)
metadata: String (LongText)  // JSON with tables, descriptions
cachedAt: DateTime
expiresAt: DateTime        // 24 hours from cachedAt

Indexes:
- Index: expiresAt
```

**SoftoneTableSchema** (24-hour Cache of Field Definitions)
```
id: String (cuid)
objectName: String
tableName: String (unique)
fields: String (LongText)  // JSON: [{ name, type, size, nullable }]
primaryKey: String         // PK field name
cachedAt: DateTime
expiresAt: DateTime

Indexes:
- Index: objectName
- Index: expiresAt
```

### File Management Models

**SyncDataFile** (Exported Data Stored in Bunny CDN)
```
id: String (cuid)
syncConfigId: String
fileName: String           // e.g., "job_abc123.json"
fileType: String           // JSON | CSV | BACKUP
fileSize: Int              // Bytes
bunnyUrl: String           // Full CDN URL
bunnyPath: String          // Path in storage zone
bunnyFileId: String?       // Bunny internal ID
checksumSHA256: String     // For integrity verification
isBackup: Boolean
retentionDays: Int         // Default 90 days
expiresAt: DateTime        // Auto-delete after this date
uploadedAt: DateTime?

Indexes:
- Index: syncConfigId
- Index: expiresAt
```

**DatabaseBackup** (MySQL Backup Metadata)
```
id: String (cuid)
backupType: String         // FULL | INCREMENTAL | TRANSACTION_LOG
backupPath: String         // File path on CDN
bunnyBackupUrl: String?    // CDN URL
databaseSize: Int          // Uncompressed bytes
backupSize: Int            // Compressed bytes
startedAt: DateTime
completedAt: DateTime?
binlogPosition: String?    // MySQL binary log position (for PITR)
isVerified: Boolean        // Has restore been tested?
verifiedAt: DateTime?

Indexes:
- Index: completedAt
```

### Rate Limiting Model

**RateLimitTracker** (Prevent API Abuse)
```
id: String (cuid)
connectionId: String (unique)  // Softone connection ID
requestsThisMinute: Int
requestsThisHour: Int
lastResetMinute: DateTime
lastResetHour: DateTime
isThrottled: Boolean           // Backoff active?
throttleUntil: DateTime?       // When to resume

Indexes:
- Index: isThrottled
```

### Auth Models (auth.js v5)

**User**
```
id: String (cuid)
name, email, image: String?
emailVerified: DateTime?
password: String?          // bcrypt hash (null for OAuth)
role: String               // ADMIN | OPERATOR | VIEWER
createdAt, updatedAt: DateTime

Relations:
- accounts: Account[]
- sessions: Session[]
```

**Account** (OAuth Provider Credentials)
```
id: String (cuid)
userId: String
type, provider, providerAccountId: String
refresh_token, access_token, id_token: String?
expires_at: Int?
token_type, scope, session_state: String?

Unique: (provider, providerAccountId)
```

**Session** (Active Login Sessions)
```
id: String (cuid)
sessionToken: String (unique)
userId: String
expires: DateTime

Foreign key: userId → User(id)
```

**VerificationToken** (Email Verification)
```
identifier, token: String
expires: DateTime

Unique: (identifier, token)
```

---

## Data Flow & Sync Process

### High-Level Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Admin Dashboard                                             │
│ 1. Create SyncConfig (object, table, field mappings)       │
│ 2. Set sync schedule (cron: "0 */6 * * *" = every 6h)     │
│ 3. Choose strategy (SOFTONE_WINS, MANUAL_REVIEW, etc)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ Next.js Server API Route    │
        │ POST /api/sync/trigger      │
        │ - Check CronJobLock         │
        │ - Create SyncJob (PENDING)  │
        │ - Enqueue job processor     │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼────────────────────────────┐
        │ processJob(jobId)                          │
        │ Status: IN_PROGRESS                       │
        ├──────────────────────────────────────────┤
        │ 1. Load checkpoint (resume on retry)     │
        │ 2. Fetch batch from Softone (paginated)  │
        │ 3. Map fields per FieldMapping           │
        │ 4. Upsert to local table                 │
        │ 5. Create SyncAudit entry                │
        │ 6. Update progress (live)                │
        │ 7. Loop: repeat until all pages          │
        └──────────────┬─────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
    ┌────▼──────────┐        ┌───────▼──────┐
    │ Success       │        │ Error        │
    │ COMPLETED     │        │ FAILED       │
    │ Move to       │        │ Retry?       │
    │ SyncDataFile  │        │ → Max?       │
    │ (Bunny CDN)   │        │   → DLQ      │
    └───────────────┘        └──────────────┘
```

### Detailed Sync Job Processing

```
Step 1: INITIALIZATION
  - Load SyncJob record from database
  - Load related SyncConfig + FieldMappings
  - Mark status = IN_PROGRESS
  - Load checkpoint (or initialize to offset=0)

Step 2: FETCH BATCH (Loop)
  SoftoneAPIClient.fetchRecords(objectName, tableName, {
    batchSize: 100,
    offset: checkpoint.offset
  })
  → Returns: { records: S1Record[], totalCount: Int }

  If (first batch):
    Update job.totalRecords = totalCount
    Post job progress event to dashboard

Step 3: PROCESS EACH RECORD (Loop within batch)
  For record in records:
    a) Extract primary key
    b) Map Softone fields → local columns per FieldMapping
    c) Create SyncAudit entry (FETCH action)
    d) Upsert to local MySQL table (ON DUPLICATE KEY UPDATE)
    e) Increment checkpoint.offset
    f) Add recordId to result.processedIds

Step 4: CHECKPOINT & PROGRESS (After each batch)
  Update SyncJob:
    - recordsProcessed = successful + failed + skipped
    - recordsSuccessful = count
    - recordsFailed = count
    - checkpointData = JSON(offset, lastProcessedId, totalFetched)
  
  Emit progress event to dashboard

Step 5: LOOP TERMINATION
  Exit loop when:
    - totalCount > 0 && offset >= totalCount, OR
    - batch.length < batchSize (got fewer than requested)

Step 6: COMPLETION
  Update SyncJob:
    - status = COMPLETED (or PARTIAL_FAILURE if failed > 0)
    - completedAt = now()
    - checkpointData = null (clear resume data)
    - processedRecords = JSON(processedIds[])
  
  Call callback: onJobComplete?.(jobId)

Step 7: ERROR RECOVERY
  If error thrown:
    a) Update SyncJob:
         - status = FAILED
         - retryCount++
         - errorMessage, errorStack
         - checkpointData = JSON (save state for resume)
    
    b) Fire callback: onJobFailed?.(...)
    
    c) If retryCount >= maxRetries:
         - Move to DLQ (SyncJobDLQ)
         - Fire callback: onDLQCreated?.(...)
    
    d) Re-throw error (caller decides retry behavior)
```

### Field Mapping Transformation

```
SyncConfig created with field mappings:
  [
    { softoneFieldName: "CODE", localColumnName: "code" },
    { softoneFieldName: "NAME", localColumnName: "name", isSyncable: true },
    { softoneFieldName: "DESC", localColumnName: "description", isSyncable: false },
    { softoneFieldName: "UPDDATE", localColumnName: "updated_at", isTimestamp: true }
  ]

Softone record fetched:
  {
    CODE: "CUST001",
    NAME: "Acme Corp",
    DESC: "Old description",  ← Skip (isSyncable: false)
    UPDDATE: "2026-04-10T14:30:00"
  }

Local data built:
  {
    code: "CUST001",
    name: "Acme Corp",
    updated_at: "2026-04-10T14:30:00"
    // DESC not included — skipped by mapping config
  }

Insert into local table:
  INSERT INTO softone_customers (code, name, updated_at, _synced_at, _sync_config_id)
  VALUES ("CUST001", "Acme Corp", "2026-04-10T14:30:00", NOW(), "syncconfig_xyz")
  ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    updated_at = VALUES(updated_at),
    _synced_at = VALUES(_synced_at)
```

---

## Type System

### Import Structure

```typescript
// @softone/sync exports these types:
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
}

export {
  SoftoneAPIClient,
  getSoftoneClient,
  decodeS1Response,
  decodeRecord,
  resolveConflict,
  processJob,
  triggerSyncForConfig,
  checkRateLimit,
  uploadSyncData,
  uploadBackup,
  validateRecords,
}
```

### Type Safety Pattern

```typescript
// All Softone API calls are typed
const records = await client.fetchRecords(objectName, tableName)
// type: { records: S1Record[], totalCount: number }

// Job processing returns structured results
const job = await prisma.syncJob.findUnique({...})
// type: SyncJob & { syncConfig: SyncConfig & { fieldMappings: FieldMapping[] } }

// Config validation at ingestion point
const config = SyncConfigInputSchema.parse(userInput)
// type: SyncConfigInput (guaranteed valid)

// Rate limiting is type-safe
await checkRateLimit(prisma, connectionId, {
  maxPerMinute: 60,
  maxPerHour: 1000,
  backoffMs: 300000
})
// compile-time check: all required properties provided
```

---

## Module Reference

### @softone/sync Public API

```typescript
// ─── Client & Authentication ──────────────────────────────

export class SoftoneAPIClient {
  constructor(credentials: S1Credentials)
  async testConnection(): Promise<{ companyinfo: string | null }>
  async getObjects(): Promise<S1Object[]>
  async getObjectTables(objectName: string): Promise<string[]>
  async getTableFields(objectName: string, tableName: string): Promise<S1ObjectField[]>
  async fetchRecords(objectName: string, tableName: string, options?: {
    batchSize?: number
    offset?: number
    filter?: string
  }): Promise<{ records: S1Record[], totalCount: number }>
  async getRecord(objectName: string, key: string | number): Promise<S1Record | null>
}

export function getSoftoneClient(): SoftoneAPIClient
export function getStoredCompanyInfo(): string | null
export function clearSession(): void

// ─── Encoding ────────────────────────────────────────────

export async function decodeS1Response(res: Response): Promise<unknown>
export function decodeBuffer(buffer: ArrayBuffer): string
export function decodeFieldValue(value: string): string
export function decodeRecord<T>(record: T): T

// ─── Sync Processing ─────────────────────────────────────

export interface ProcessJobCallbacks {
  onJobFailed?(opts: {...}): Promise<void>
  onDLQCreated?(opts: {...}): Promise<void>
}

export async function processJob(
  prisma: PrismaClient,
  jobId: string,
  callbacks?: ProcessJobCallbacks,
  clientOverride?: SoftoneAPIClient
): Promise<void>

export async function triggerSyncForConfig(
  prisma: PrismaClient,
  syncConfigId: string,
  callbacks?: ProcessJobCallbacks,
  clientOverride?: SoftoneAPIClient
): Promise<{ jobId: string } | { skipped: true }>

// ─── Conflict Resolution ─────────────────────────────────

export function resolveConflict(ctx: ConflictContext): ConflictResult

// ─── Rate Limiting ───────────────────────────────────────

export async function checkRateLimit(
  prisma: PrismaClient,
  connectionId: string,
  config?: RateLimitConfig
): Promise<void>

export async function handleThrottle(
  prisma: PrismaClient,
  connectionId: string,
  backoffMs?: number
): Promise<void>

// ─── Bunny CDN ───────────────────────────────────────────

export async function uploadSyncData(
  prisma: PrismaClient,
  syncConfigId: string,
  jobId: string,
  objectName: string,
  data: unknown
): Promise<BunnyUploadResult>

export async function uploadBackup(
  prisma: PrismaClient,
  backupPath: string,
  data: Buffer,
  databaseSizeBytes: number
): Promise<string>

export async function deleteBunnyFile(remotePath: string): Promise<void>

// ─── Validation ──────────────────────────────────────────

export function validateRecords(records: unknown[]): {
  valid: S1Record[]
  invalid: { index: number, error: string }[]
}

export const S1RecordSchema: z.ZodType<S1Record>
export const FieldMappingInputSchema: z.ZodType<FieldMappingConfig>
export const SyncConfigInputSchema: z.ZodType<SyncConfigInput>
```

---

## Key Algorithms

### Algorithm 1: Two-Step Softone Authentication

```
FUNCTION authenticate():
  INPUT: username, password, appId, company?, branch?, module?, refId?
  
  Step 1 — Login (get temp clientID):
    POST /s1services {
      service: "login"
      username
      password
      appId
    }
    → Response: { success, clientID, objs: [{COMPANY, BRANCH, MODULE, REFID}] }
    
    IF !success:
      RAISE Error "Login failed: {error}"
    
  Step 2 — Authenticate (get final session clientID):
    resolvedCompany = company OR objs[0].COMPANY
    resolvedBranch = branch OR objs[0].BRANCH
    resolvedModule = module OR objs[0].MODULE
    resolvedRefId = refId OR objs[0].REFID
    
    POST /s1services {
      service: "authenticate"
      clientID: (from step 1)
      COMPANY: resolvedCompany
      BRANCH: resolvedBranch
      MODULE: resolvedModule
      REFID: resolvedRefId
    }
    → Response: { success, clientID, companyinfo }
    
    IF !success:
      RAISE Error "Auth failed: {error}"
  
  Store session to .s1session.json with expiration
  RETURN auth.clientID
```

### Algorithm 2: Paginated Fetch with Retry

```
FUNCTION fetchRecords(objectName, tableName, {batchSize, offset, filter}):
  INPUT: objectName="Customers", tableName="CUSTOMERS", batchSize=100, offset=0
  
  Step 1 — Get reqID (browser request ID):
    browserInfo = call("getBrowserInfo", {
      OBJECT: objectName,
      LIST: tableName,
      FILTERS: filter?
    })
    
    IF !browserInfo.success:
      IF fallback needed (no LIST param):
        retry with OBJECT only (no LIST)
    
    IF no reqID:
      RAISE Error "No reqID returned"
    
    totalcount = browserInfo.totalcount
  
  Step 2 — Get paginated data:
    RETRY_LOOP:
      browserData = call("getBrowserData", {
        reqID,
        startindex: offset,
        pagesize: batchSize
      })
      
      IF !browserData.success AND errorcode IN [13, 213]:
        # reqID expired — go back to Step 1
        GOTO Step 1
      
      IF !browserData.success:
        RAISE Error from browserData
    
    RETURN {
      records: browserData.rows,
      totalCount: totalcount
    }
```

### Algorithm 3: Checkpoint-Based Job Resumption

```
FUNCTION processJob(jobId):
  job = get(SyncJob, jobId)
  
  IF job.checkpointData:
    checkpoint = PARSE_JSON(job.checkpointData)
  ELSE:
    checkpoint = {
      lastProcessedId: null,
      offset: 0,
      totalFetched: 0
    }
  
  WHILE true:
    { records, totalCount } = fetchRecords(
      job.syncConfig.objectName,
      job.syncConfig.tableName,
      { batchSize: 100, offset: checkpoint.offset }
    )
    
    IF records.length == 0:
      BREAK
    
    FOR EACH record IN records:
      localData = mapFields(record, job.syncConfig.fieldMappings)
      upsertToLocalTable(localData)
      CREATE SyncAudit(action: "FETCH", recordId, softoneData, localData)
      checkpoint.offset++
      checkpoint.totalFetched++
    
    UPDATE SyncJob {
      recordsProcessed: checkpoint.totalFetched,
      checkpointData: JSON(checkpoint)
    }
    
    IF totalCount > 0 AND checkpoint.offset >= totalCount:
      BREAK
    
    IF records.length < batchSize:
      BREAK
  
  UPDATE SyncJob {
    status: "COMPLETED",
    completedAt: NOW(),
    checkpointData: null
  }
```

### Algorithm 4: Conflict Resolution by Timestamp

```
FUNCTION resolveConflict(softoneRecord, localRecord, strategy):
  softoneTime = PARSE_ISO(softoneRecord.UPDDATE OR softoneRecord.INSDATE)
  localTime = PARSE_ISO(localRecord.updated_at OR localRecord.updatedAt)
  
  IF strategy == "SOFTONE_WINS":
    IF softoneTime AND localTime:
      IF localTime > softoneTime:
        RETURN { winner: "local", record: localRecord }
    RETURN { winner: "softone", record: softoneRecord }
  
  IF strategy == "LOCAL_WINS":
    IF localTime AND softoneTime:
      IF softoneTime > localTime:
        RETURN { winner: "softone", record: softoneRecord }
    RETURN { winner: "local", record: localRecord }
  
  IF strategy == "MANUAL_REVIEW":
    RETURN { resolved: false, winner: "manual_review", record: null }
```

### Algorithm 5: Rate Limiter with Auto-Reset

```
FUNCTION checkRateLimit(connectionId, config={maxPerMinute: 60, maxPerHour: 1000}):
  now = CURRENT_TIME
  tracker = GET(RateLimitTracker, connectionId) OR CREATE(...)
  
  // Check if currently throttled
  IF tracker.isThrottled AND tracker.throttleUntil > now:
    waitSec = (tracker.throttleUntil - now) / 1000
    RAISE Error "Rate limit active. Retry in {waitSec}s."
  
  // Reset throttle if expired
  IF tracker.isThrottled AND tracker.throttleUntil <= now:
    UPDATE tracker { isThrottled: false }
  
  // Auto-reset per-minute counter if 1min has passed
  minuteAgo = now - 60s
  IF tracker.lastResetMinute < minuteAgo:
    tracker.requestsThisMinute = 0
    tracker.lastResetMinute = now
  
  // Auto-reset per-hour counter if 1hour has passed
  hourAgo = now - 3600s
  IF tracker.lastResetHour < hourAgo:
    tracker.requestsThisHour = 0
    tracker.lastResetHour = now
  
  // Increment counters
  tracker.requestsThisMinute++
  tracker.requestsThisHour++
  
  // Check limits
  IF tracker.requestsThisMinute > config.maxPerMinute OR
     tracker.requestsThisHour > config.maxPerHour:
    
    throttleUntil = now + config.backoffMs
    UPDATE tracker { isThrottled: true, throttleUntil }
    RAISE Error "Rate limit exceeded. Backing off..."
  
  RETURN OK
```

---

## Configuration & Environment

### .env File (Example)

```bash
# Softone API
SOFTONE_URL=https://dgsoft.oncloud.gr
SOFTONE_USERNAME=admin
SOFTONE_PASSWORD=secure_password_here
SOFTONE_APP_ID=YOUR_APP_ID
SOFTONE_COMPANY=COMPANY_CODE
SOFTONE_BRANCH=BRANCH_CODE
SOFTONE_MODULE=MODULE_CODE
SOFTONE_REFID=REFID_CODE

# Database
DATABASE_URL=mysql://root:password@localhost:3306/softone_sync

# Bunny CDN
BUNNY_ACCESS_KEY=your_api_key
BUNNY_STORAGE_ZONE=softone-storage
BUNNY_STORAGE_API_HOST=storage.bunnycdn.com
BUNNY_CDN_HOSTNAME=dgsoft.b-cdn.net

# Auth
AUTH_SECRET=your_random_secret_32_chars_min
AUTH_GOOGLE_ID=xxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=xxx

# Next.js
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://softone.example.com
```

### Sync Schedule Format (Cron Expressions)

```
Field       Allowed Values    Meaning
──────      ──────────────    ─────────
Minute      0-59              When to run (0 = top of hour)
Hour        0-23              Which hour (0 = midnight, 12 = noon)
Day         1-31              Day of month
Month       1-12              Month
Weekday     0-6               0=Sunday, 1=Monday, ..., 6=Saturday

Examples:
"0 */6 * * *"      → Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
"0 9 * * *"        → Daily at 9:00 AM
"0 0 * * 1-5"      → Weekdays at midnight (Mon-Fri)
"0 */4 * * *"      → Every 4 hours
"30 2 * * *"       → 2:30 AM every day (good for backups)
"0 0 1 * *"        → First day of month at midnight (monthly)
```

---

## Error Handling & Recovery

### Error Categories & Recovery

**1. Softone API Errors**

| Error Code | Meaning | Recovery |
|-----------|---------|----------|
| -100, -101 | Session expired | Clear cache, re-authenticate |
| 13, 213 | reqID expired | Restart fetch (getBrowserInfo) |
| 429 | Too many requests | Rate limiter backs off 5 min |
| Network timeout | Connection lost | Retry with checkpoint resume |

**2. Job Processing Errors**

| Scenario | Handling |
|----------|----------|
| Batch fetch fails | Store checkpoint, mark job FAILED, retry on next run |
| Field mapping error | Log to SyncAudit, increment failed count, continue |
| Database insert fails | Create SyncJobDLQ entry, fire callback |
| Max retries exceeded | Move to DLQ, require manual review |

**3. Checkpoint & Resumption**

```
Job fails at record 500 of 5000:

  SyncJob state:
    status: FAILED
    recordsProcessed: 500
    checkpointData: { offset: 500, totalFetched: 500 }
    retryCount: 1
    errorMessage: "Softone API timeout"

  Next run:
    Load checkpoint: offset = 500
    fetchRecords(..., { offset: 500 })
    Resume from record 500 (idempotent upsert)
```

### Handling Job Failures

```typescript
// When processJob() throws:

try {
  await processJob(prisma, jobId, callbacks)
} catch (err) {
  // 1. Job record already updated with error details
  //    - status = FAILED
  //    - errorMessage, errorStack
  //    - checkpointData (resume info)
  //    - retryCount incremented
  
  // 2. Callback fired (non-blocking):
  //    await callbacks.onJobFailed?.(...)
  
  // 3. If retryCount >= maxRetries:
  //    - SyncJobDLQ entry created
  //    - Callback fired: callbacks.onDLQCreated?.(...)
  
  // 4. Caller must handle retry logic
  //    (e.g., re-queue job, send alert, etc.)
}
```

### Dead Letter Queue (DLQ)

```
Purpose: Catch jobs that fail repeatedly

Record moved to DLQ when:
  retryCount >= maxRetries (default 3)

DLQ entry contains:
  originalJobId     — Reference to failed SyncJob
  syncConfigId      — Which config was syncing
  operation         — What failed (FETCH, UPDATE, etc.)
  recordData        — JSON payload (for reproduction)
  errorReason       — Error message
  severity          — WARNING | ERROR | CRITICAL
  requiresManualReview — true

Admin actions:
  1. Review error + context
  2. Fix root cause (Softone API, data mapping, etc.)
  3. Manually retry via dashboard
  4. Mark as resolved with notes
```

---

## Integration Points

### Integration with Admin Dashboard

**API Routes Called by Dashboard:**

```typescript
// Discovery
GET /api/softone/objects
  → SoftoneAPIClient.getObjects()
  → Returns: { name, type, caption }[]

GET /api/softone/objects/[objectName]/tables
  → SoftoneAPIClient.getObjectTables(objectName)
  → Returns: string[] (table names)

GET /api/softone/objects/[objectName]/tables/[tableName]/fields
  → SoftoneAPIClient.getTableFields(objectName, tableName)
  → Returns: S1ObjectField[] (field definitions)

// Configuration
POST /api/sync-config
  → Create SyncConfig with field mappings
  → Validates via SyncConfigInputSchema

GET /api/sync-config/[syncConfigId]
  → Get full config with mappings

PUT /api/sync-config/[syncConfigId]
  → Update config and mappings

DELETE /api/sync-config/[syncConfigId]
  → Soft-delete (mark as inactive)

// Job Management
GET /api/sync-jobs?configId=...&status=...
  → List SyncJob records with filtering
  → Pagination support

GET /api/sync-jobs/[jobId]
  → Get job details + live progress

POST /api/sync-jobs/[jobId]/retry
  → Manually retry failed job
  → Clears retryCount, sets status = PENDING

POST /api/sync-config/[syncConfigId]/trigger
  → Trigger sync immediately (ignores schedule)
  → Returns: { jobId } or { skipped: true }

// DLQ Management
GET /api/dlq?sortBy=createdAt&limit=20
  → List dead letter queue entries

PUT /api/dlq/[dlqId]/resolve
  → Mark as resolved with admin notes
  → Sets reviewedBy, reviewedAt, resolution

// File Management
GET /api/sync-files?configId=...
  → List exported data files from Bunny CDN

DELETE /api/sync-files/[fileId]
  → Delete from CDN + database record
```

### Integration with Next.js Server Actions

```typescript
// Server action to trigger sync
"use server"
export async function triggerSync(configId: string) {
  const { jobId } = await triggerSyncForConfig(
    prisma,
    configId,
    {
      onJobFailed: async (opts) => {
        await sendAlertEmail(opts)
      },
      onDLQCreated: async (opts) => {
        await notifyAdmin(opts)
      }
    }
  )
  
  return { jobId }
}

// Called from React component
const result = await triggerSync(selectedConfig.id)
```

### Integration with Cron Jobs

```typescript
// Background job handler (e.g., Vercel Cron, node-cron)
export async function handleSyncCron(configId: string) {
  const result = await triggerSyncForConfig(prisma, configId)
  
  if ('skipped' in result) {
    console.log(`Sync already running for ${configId}`)
    return
  }
  
  console.log(`Sync triggered: job ${result.jobId}`)
}

// Cron trigger in Next.js
// PUT /api/cron/sync?syncConfigId=...
// Called by external cron service (Vercel, EasyCron, etc.)
```

### Integration with Monitoring & Alerts

```typescript
// Progress updates to dashboard (WebSocket or polling)
async function watchJobProgress(jobId: string) {
  const interval = setInterval(async () => {
    const job = await prisma.syncJob.findUnique({
      where: { id: jobId }
    })
    
    // Emit progress event
    broadcast('job:progress', {
      jobId,
      status: job.status,
      progress: job.recordsProcessed / job.totalRecords,
      successful: job.recordsSuccessful,
      failed: job.recordsFailed
    })
    
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      clearInterval(interval)
    }
  }, 1000)
}

// Alert notifications
if (job.status === 'FAILED' && job.retryCount >= job.maxRetries) {
  await sendAlert({
    type: 'DLQ_CREATED',
    configId: job.syncConfigId,
    jobId: job.id,
    error: job.errorMessage
  })
}
```

---

## Summary

This Softone Integration Library provides a **production-grade, enterprise-safe** synchronization platform:

✅ **Robust API Client** — Two-step auth, discovery, paginated fetch  
✅ **Encoding Handling** — Automatic ANSI 1253 → UTF-8 conversion  
✅ **Job Processing** — Checkpoint resumption, batch processing, audit trail  
✅ **Conflict Resolution** — Timestamp-based strategy selection  
✅ **Rate Limiting** — Prevent API abuse with adaptive throttling  
✅ **File Management** — Global CDN distribution via Bunny  
✅ **Type Safety** — Full TypeScript + Zod validation  
✅ **Error Recovery** — DLQ for manual review, callback system  
✅ **RBAC** — Role-based access control (ADMIN/OPERATOR/VIEWER)  

**All code is production-ready, well-documented, and designed for team collaboration.**

---

**Made with 🔧 for Giannis**  
**Last updated:** April 12, 2026
