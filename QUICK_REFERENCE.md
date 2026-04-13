# Softone Integration Library — Quick Reference Guide

**Use this for fast cursor lookups while coding**

---

## File Locations & What They Do

### Core Library (`packages/softone-sync/lib/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `types.ts` | All TypeScript types | S1Credentials, S1Record, SyncJobStatus, etc. |
| `softone-api.ts` | Softone API client | SoftoneAPIClient, getSoftoneClient() |
| `encoding.ts` | ANSI 1253 → UTF-8 | decodeS1Response(), decodeRecord() |
| `sync-processor.ts` | Job executor | processJob(), triggerSyncForConfig() |
| `conflict-resolver.ts` | Timestamp-based conflict logic | resolveConflict() |
| `rate-limiter.ts` | API request throttling | checkRateLimit(), handleThrottle() |
| `bunny-client.ts` | CDN file uploads | uploadSyncData(), uploadBackup() |
| `validators.ts` | Input validation (Zod) | validateRecords(), SyncConfigInputSchema |
| `index.ts` | Public API exports | All of above |

### Database (`packages/softone-sync/prisma/`)

| Model | Purpose |
|-------|---------|
| **SyncConfig** | What to sync (object, table, schedule, field mappings) |
| **SyncJob** | Individual sync operation (status, progress, retry) |
| **SyncJobDLQ** | Failed jobs requiring manual review |
| **FieldMapping** | Softone field → local column mapping |
| **CronJobLock** | Prevents duplicate cron execution |
| **SyncAudit** | Immutable log of all operations |
| **RateLimitTracker** | Request throttling state |
| **SoftoneMetadata** | 24h cache of object/table definitions |
| **SyncDataFile** | Exported data stored in Bunny CDN |
| **DatabaseBackup** | MySQL backup metadata |
| **User, Account, Session** | auth.js v5 tables |

---

## Common Code Patterns

### Pattern 1: Create API Client & Fetch Data

```typescript
import { getSoftoneClient } from '@softone/sync'

const client = getSoftoneClient()

// Test connection
const { companyinfo } = await client.testConnection()

// Discover available objects
const objects = await client.getObjects()

// Get tables for an object
const tables = await client.getObjectTables('Customers')

// Get field definitions
const fields = await client.getTableFields('Customers', 'CUSTOMERS')

// Fetch paginated records
const { records, totalCount } = await client.fetchRecords(
  'Customers',
  'CUSTOMERS',
  { batchSize: 100, offset: 0, filter: 'CODE=CUST001' }
)
```

### Pattern 2: Create Sync Configuration

```typescript
import { SyncConfigInputSchema } from '@softone/sync'

const config = {
  objectName: 'Customers',
  tableName: 'CUSTOMERS',
  syncDirection: 'READ',
  batchSize: 100,
  syncSchedule: '0 */6 * * *',  // Every 6 hours
  conflictStrategy: 'SOFTONE_WINS',
  fieldMappings: [
    {
      softoneFieldName: 'CODE',
      localColumnName: 'code',
      dataType: 'character',
      isPrimaryKey: true,
      isSyncable: true
    },
    {
      softoneFieldName: 'NAME',
      localColumnName: 'name',
      dataType: 'character',
      isSyncable: true
    },
    {
      softoneFieldName: 'UPDDATE',
      localColumnName: 'updated_at',
      dataType: 'datetime',
      isTimestamp: true,
      isSyncable: true
    }
  ],
  createdBy: 'user_123'
}

// Validate at ingestion
const validatedConfig = SyncConfigInputSchema.parse(config)

// Store in database
const syncConfig = await prisma.syncConfig.create({
  data: {
    ...validatedConfig,
    fieldMappings: {
      createMany: {
        data: validatedConfig.fieldMappings
      }
    }
  }
})
```

### Pattern 3: Trigger Sync Job

```typescript
import { triggerSyncForConfig } from '@softone/sync'

const result = await triggerSyncForConfig(
  prisma,
  syncConfigId,
  {
    onJobFailed: async (opts) => {
      console.error(`Job failed: ${opts.errorMessage}`)
      // Send alert email, Slack notification, etc.
    },
    onDLQCreated: async (opts) => {
      console.error(`Job moved to DLQ: ${opts.dlqId}`)
      // Notify admin
    }
  }
)

if ('skipped' in result) {
  console.log('Sync already running for this config')
} else {
  console.log(`Sync started: ${result.jobId}`)
}
```

### Pattern 4: Monitor Job Progress

```typescript
// Poll job status
const job = await prisma.syncJob.findUnique({
  where: { id: jobId },
  include: { syncConfig: true }
})

console.log(`Status: ${job.status}`)
console.log(`Progress: ${job.recordsProcessed} / ${job.totalRecords}`)
console.log(`Successful: ${job.recordsSuccessful}`)
console.log(`Failed: ${job.recordsFailed}`)

if (job.status === 'FAILED') {
  console.log(`Error: ${job.errorMessage}`)
  console.log(`Retry count: ${job.retryCount} / ${job.maxRetries}`)
  
  if (job.retryCount >= job.maxRetries) {
    // Job moved to DLQ
    const dlq = await prisma.syncJobDLQ.findUnique({
      where: { originalJobId: jobId }
    })
    console.log(`DLQ ID: ${dlq.id}`)
  }
}
```

### Pattern 5: Handle Rate Limiting

```typescript
import { checkRateLimit } from '@softone/sync'

try {
  await checkRateLimit(prisma, 'connection_1', {
    maxPerMinute: 60,
    maxPerHour: 1000,
    backoffMs: 5 * 60 * 1000
  })
  
  // Safe to make Softone API call
  const records = await client.fetchRecords(...)
  
} catch (err) {
  if (err.message.includes('Rate limit')) {
    // Retry later
    console.log(err.message)
  }
}
```

### Pattern 6: Resolve Conflicts

```typescript
import { resolveConflict } from '@softone/sync'

const result = resolveConflict({
  softoneRecord: { CODE: 'A', NAME: 'Name A', UPDDATE: '2026-04-10T14:00:00' },
  localRecord: { code: 'A', name: 'Name A Old', updated_at: '2026-04-10T12:00:00' },
  strategy: 'SOFTONE_WINS',
  syncConfigId: 'config_123',
  syncJobId: 'job_456'
})

if (result.resolved) {
  console.log(`Winner: ${result.winner}`)
  console.log(`Use record:`, result.record)
} else {
  // Manual review needed
  console.log('Manual review required')
}
```

### Pattern 7: Upload to Bunny CDN

```typescript
import { uploadSyncData, uploadBackup } from '@softone/sync'

// Upload sync data
const result = await uploadSyncData(
  prisma,
  syncConfigId,
  jobId,
  'Customers',
  { records: [...], totalCount: 1000 }
)
console.log(`Uploaded to: ${result.url}`)

// Upload backup
const backupBuffer = await readFile('backup.sql.gz')
const backupUrl = await uploadBackup(
  prisma,
  '2026-04-12_backup.sql.gz',
  backupBuffer,
  150000000 // 150MB uncompressed
)
console.log(`Backup URL: ${backupUrl}`)
```

---

## Database Query Snippets

### Find Active Sync Configs

```typescript
const configs = await prisma.syncConfig.findMany({
  where: { isActive: true },
  include: { fieldMappings: true, cronJobLock: true }
})
```

### Get Recent Sync Jobs

```typescript
const jobs = await prisma.syncJob.findMany({
  where: {
    syncConfigId: configId,
    status: 'COMPLETED'
  },
  orderBy: { completedAt: 'desc' },
  take: 10
})
```

### View Audit Trail for Config

```typescript
const auditLog = await prisma.syncAudit.findMany({
  where: { syncConfigId: configId },
  orderBy: { createdAt: 'desc' },
  take: 100
})
```

### Check DLQ for Errors

```typescript
const dlqEntries = await prisma.syncJobDLQ.findMany({
  where: { requiresManualReview: true, severity: 'ERROR' },
  orderBy: { createdAt: 'desc' },
  take: 20
})
```

### Get Last Successful Sync

```typescript
const lastSync = await prisma.syncJob.findFirst({
  where: {
    syncConfigId: configId,
    status: 'COMPLETED'
  },
  orderBy: { completedAt: 'desc' }
})
```

---

## Environment Variables Checklist

```bash
# Softone API (Required)
SOFTONE_URL=https://...
SOFTONE_USERNAME=...
SOFTONE_PASSWORD=...
SOFTONE_APP_ID=...

# Softone Company/Branch (Optional — auto-selected if not provided)
SOFTONE_COMPANY=...
SOFTONE_BRANCH=...
SOFTONE_MODULE=...
SOFTONE_REFID=...

# Database (Required)
DATABASE_URL=mysql://...

# Bunny CDN (Required if using file exports)
BUNNY_ACCESS_KEY=...
BUNNY_STORAGE_ZONE=...
BUNNY_STORAGE_API_HOST=...
BUNNY_CDN_HOSTNAME=...

# Auth (Required for Next.js app)
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

---

## Type Imports Quick Reference

```typescript
// All types from @softone/sync
import type {
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
} from '@softone/sync'

// Classes
import {
  SoftoneAPIClient,
  getSoftoneClient,
} from '@softone/sync'

// Functions
import {
  decodeS1Response,
  decodeRecord,
  resolveConflict,
  processJob,
  triggerSyncForConfig,
  checkRateLimit,
  uploadSyncData,
  uploadBackup,
  validateRecords,
} from '@softone/sync'

// Prisma client
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

---

## Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `"S1 Login failed: ..."` | Wrong credentials | Check SOFTONE_USERNAME/PASSWORD env vars |
| `"S1 Auth failed: ..."` | Bad COMPANY/BRANCH | Set SOFTONE_COMPANY/BRANCH or let auto-select |
| `"getObjectTables failed"` | Bad object name | Verify objectName exists in getObjects() |
| `"No reqID returned"` | Softone API issue | Retry later, check Softone status |
| `"Rate limit active..."` | Too many requests | Reduce batchSize or wait 5 minutes |
| `"Garbled text"` | Encoding not applied | Use decodeS1Response() not res.json() |
| `"Job not found"` | Bad jobId | Check jobId in database |
| `"DLQ: CRITICAL"` | Job failed max retries | Review SyncJobDLQ, fix config, retry |

---

## Performance Tips

1. **Batch Size**
   - Default: 100 records/request
   - Increase to 500 if records are small
   - Decrease to 50 if Softone times out

2. **Sync Schedule**
   - Every 6 hours: `0 */6 * * *`
   - Off-peak: `30 2 * * *` (2:30 AM)
   - Avoid: `*/5 * * * *` (too frequent)

3. **Rate Limiting**
   - Default: 60/min, 1000/hour
   - Adjust based on Softone capacity
   - Monitor RateLimitTracker table

4. **File Retention**
   - Bunny CDN default: 90 days
   - Archive older files elsewhere
   - Use DatabaseBackup for long-term

5. **Database Indexes**
   - Already created in schema
   - Query by: status, syncConfigId, createdAt
   - Don't add custom indexes without profiling

---

## Workflow: New Sync Config

1. **Discover**
   ```typescript
   const objects = await client.getObjects()
   const tables = await client.getObjectTables(objectName)
   const fields = await client.getTableFields(objectName, tableName)
   ```

2. **Map Fields**
   ```typescript
   // Build field mappings matching Softone fields to local columns
   // Mark primary key, timestamp fields, and non-syncable fields
   ```

3. **Validate**
   ```typescript
   const config = SyncConfigInputSchema.parse(userConfig)
   ```

4. **Create**
   ```typescript
   const syncConfig = await prisma.syncConfig.create({ data: config })
   ```

5. **Test**
   ```typescript
   const { jobId } = await triggerSyncForConfig(prisma, syncConfig.id)
   const job = await prisma.syncJob.findUnique({ where: { id: jobId } })
   // Wait for completion, review audit trail
   ```

6. **Schedule**
   ```typescript
   // Update syncSchedule in SyncConfig
   // Cron service picks it up automatically
   ```

---

## Workflow: Debug Failed Job

1. **Find Job**
   ```typescript
   const job = await prisma.syncJob.findUnique({ where: { id: jobId } })
   console.log(job.errorMessage, job.errorStack)
   ```

2. **Check Audit Trail**
   ```typescript
   const audits = await prisma.syncAudit.findMany({
     where: { syncJobId: jobId },
     orderBy: { createdAt: 'desc' }
   })
   ```

3. **Check DLQ**
   ```typescript
   const dlq = await prisma.syncJobDLQ.findUnique({
     where: { originalJobId: jobId }
   })
   ```

4. **Retry**
   ```typescript
   // After fixing the issue:
   await prisma.syncJob.update({
     where: { id: jobId },
     data: { status: 'PENDING', retryCount: 0 }
   })
   const { jobId: newJobId } = await triggerSyncForConfig(prisma, configId)
   ```

---

## Workflow: Handle Rate Limit

```
1. Monitor RateLimitTracker table
   WHERE isThrottled = true AND throttleUntil > NOW()

2. Find affected configs
   SELECT syncConfigId FROM SyncJob
   WHERE connectionId = '...' AND status = 'FAILED'
   LIMIT 10

3. Wait for throttleUntil to pass (default 5 min)
   Or manually reset:
   UPDATE RateLimitTracker SET isThrottled = false

4. Reduce batchSize in SyncConfig
   Increase maxPerMinute/maxPerHour in code
```

---

## Useful Queries for Admin Dashboard

```typescript
// Overview stats
const stats = {
  totalConfigs: await prisma.syncConfig.count(),
  activeConfigs: await prisma.syncConfig.count({ where: { isActive: true } }),
  totalJobs: await prisma.syncJob.count(),
  successfulJobs: await prisma.syncJob.count({ where: { status: 'COMPLETED' } }),
  failedJobs: await prisma.syncJob.count({ where: { status: 'FAILED' } }),
  dlqItems: await prisma.syncJobDLQ.count({ where: { requiresManualReview: true } })
}

// Last 24h activity
const last24h = await prisma.syncJob.findMany({
  where: {
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  },
  orderBy: { createdAt: 'desc' }
})

// Success rate
const total = await prisma.syncJob.count()
const successful = await prisma.syncJob.count({ where: { status: 'COMPLETED' } })
const successRate = (successful / total * 100).toFixed(2) + '%'
```

---

**For detailed documentation, see CODEBASE_DOCUMENTATION.md**
