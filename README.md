# Softone ERP Integration Library

**Enterprise-grade Next.js library for seamless Softone ERP data synchronization**

---

## 📦 What You're Building

A production-ready integration platform that:

✅ **Discovers** Softone objects, tables, and fields dynamically  
✅ **Maps** Softone data to your MySQL schema automatically  
✅ **Syncs** data bidirectionally with conflict resolution  
✅ **Queues** jobs with retry logic and checkpointing  
✅ **Prevents** duplicate cron execution  
✅ **Monitors** sync health with an admin dashboard  
✅ **Manages** file storage via Bunny CDN  
✅ **Backs up** MySQL with point-in-time recovery  
✅ **Audits** all operations for compliance  
✅ **Controls** access with role-based permissions  

**Designed to be reusable across all company applications.**

---

## 📚 Documentation

This project includes 5 comprehensive guides:

### 1. **ARCHITECTURE.md** 🏗️
Complete technical design with:
- Prisma database schema (job queue, configs, audit trail)
- Data flow diagrams
- Conflict resolution logic
- Code patterns and examples
- Bunny CDN + MySQL backup strategies

**Read this first to understand the design.**

### 2. **IMPLEMENTATION_GUIDE.md** 🛠️
Step-by-step implementation roadmap:
- Project structure and file organization
- 5 development phases (Core → Dashboard → Cron → Files → RBAC)
- What to build in each phase
- Critical implementation checklist
- Common pitfalls to avoid

**Reference this while building.**

### 3. **MIRROR_IDE_WORKFLOW.md** 🪞
How to work effectively with Claude in Mirror IDE:
- Session structure and best practices
- Example workflows for each component
- Debugging tips
- File review checklist
- Testing strategies

**Use this when prompting Claude.**

### 4. **FIRST_PROMPT_TO_CLAUDE.md** 🚀
Ready-to-use prompt for starting the project:
- Copy-paste kickoff prompt
- What Claude will deliver
- Follow-up sessions
- Success criteria

**Start with this.**

### 5. **PROJECT_CONTEXT.md** 📋
Quick reference of core requirements and vision.

---

## 🎯 Quick Start

### Step 1: Set Up Project Structure
Copy the prompt from `FIRST_PROMPT_TO_CLAUDE.md` and paste into Mirror IDE.

Claude will create:
- Monorepo with workspaces
- 2 packages: `@softone/sync` + `softone-admin-dashboard`
- TypeScript configuration
- Tailwind CSS setup
- Package dependencies

### Step 2: Build Database Schema
From ARCHITECTURE.md, have Claude create:
- `/prisma/schema.prisma` with all models
- Migration scripts
- Prisma client setup

### Step 3: Implement Core Modules
Follow IMPLEMENTATION_GUIDE.md phases:

**Phase 1** → Softone API client + job queue
**Phase 2** → Admin dashboard + server routes  
**Phase 3** → Cron scheduling + duplicate prevention  
**Phase 4** → Bunny CDN + MySQL backups  
**Phase 5** → RBAC + auth.js  

Each phase builds on the previous.

### Step 4: Test & Deploy
- Unit tests for sync logic
- Integration tests with mock Softone data
- Staging deployment
- Production rollout

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Next.js Admin Dashboard                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Discovery UI → Config UI → Job Monitor       │  │
│  │ Audit Trail → Monitoring → Settings          │  │
│  └──────────────────────────────────────────────┘  │
└─────────────┬──────────────────────────┬────────────┘
              │                          │
              ▼                          ▼
     ┌────────────────┐        ┌─────────────────┐
     │ Server Actions │        │ API Routes      │
     │ - sync config  │        │ - job management│
     │ - triggers     │        │ - Softone APIs  │
     └────────┬───────┘        └────────┬────────┘
              │                        │
              └────────────┬───────────┘
                           ▼
              ┌─────────────────────────┐
              │  Softone Sync Library   │
              │  ┌───────────────────┐  │
              │  │ Job Processor     │  │ (core logic)
              │  │ Conflict Resolver │  │
              │  │ Rate Limiter      │  │
              │  │ Softone API Client│  │
              │  └───────────────────┘  │
              └─────────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
    ┌────────┐  ┌──────────┐  ┌────────────┐
    │ MySQL  │  │ Softone  │  │ Bunny CDN  │
    │ (Queue)│  │ (API)    │  │ (Files)    │
    └────────┘  └──────────┘  └────────────┘
```

---

## 🔑 Key Design Decisions

### 1. Job Queue in Prisma (Not Redis/Bull)
**Why**: Keeps it simple, all data in one place, easier to debug
```
SyncJob table tracks every operation with:
- Status (PENDING, IN_PROGRESS, COMPLETED, FAILED)
- Retry count and checkpoint data
- Error messages and stack traces
```

### 2. Conflict Resolution via Timestamps
**Why**: Softone already provides `udupdate` (modification time) + `insdate` (creation time)
```
Compare Softone's udupdate vs local updated_at
→ Pick winner based on strategy (SOFTONE_WINS, LOCAL_WINS, MANUAL_REVIEW)
```

### 3. Cron Lock to Prevent Duplicates
**Why**: Without this, same sync can run concurrently on different servers
```
CronJobLock table with:
- isRunning flag
- Lock expiration (prevents deadlock)
- Blocks new execution until complete
```

### 4. Server-Side Only Operations
**Why**: Security + capacity control + simplified architecture
```
No client-side Softone calls
All API requests go through Next.js server
Process pool manages concurrent requests
```

### 5. ANSI 1253 → UTF-8 Conversion
**Why**: Softone returns Greece-specific encoding, needs conversion
```
Every response from Softone decoded with iconv-lite
Happens before validation + storage
```

---

## 📊 Database Schema Highlights

### Core Tables
- **SyncConfig** - What to sync, when, and how
- **SyncJob** - Every sync operation (pending/running/failed)
- **SyncJobDLQ** - Failed jobs needing manual review
- **CronJobLock** - Prevents concurrent cron execution
- **SyncAudit** - Immutable record of all changes
- **FieldMapping** - Softone field → local column mapping

### Support Tables
- **SoftoneMetadata** - Cached object/table structure (24h TTL)
- **SyncDataFile** - Exported data files (stored in Bunny CDN)
- **DatabaseBackup** - MySQL backup metadata

### Auth Tables (auth.js)
- **User** - Users with roles (ADMIN, OPERATOR, VIEWER)
- **Account** - OAuth/credentials
- **Session** - Active sessions

---

## 🚀 Development Workflow with Mirror IDE

### Session-Based Development

Each session builds one component:

**Session 1**: Project structure + Prisma schema  
**Session 2**: Softone API client + encoding  
**Session 3**: Job processor (core logic)  
**Session 4**: Admin dashboard  
**Session 5**: Cron scheduling  
**Session 6**: Bunny CDN + backups  
**Session 7**: RBAC + auth  

### How to Prompt Claude

```
"Build [COMPONENT] at [PATH]

Requirements:
- [Feature 1]
- [Feature 2]
- [Error handling]

Reference: ARCHITECTURE.md [section]

Show complete implementation with comments."
```

See **MIRROR_IDE_WORKFLOW.md** for detailed examples.

---

## ✅ Implementation Checklist

### Phase 1: Core (MVP)
- [ ] Prisma schema created + migrations
- [ ] Softone API client (with ANSI 1253 decoding)
- [ ] Job processor with retry logic
- [ ] Discovery UI (select object/table/fields)
- [ ] Sync config CRUD
- [ ] Manual sync trigger

### Phase 2: Scheduling
- [ ] Cron job trigger endpoint
- [ ] CronJobLock to prevent duplicates
- [ ] Job queue monitoring dashboard
- [ ] Retry mechanism

### Phase 3: Robustness
- [ ] Conflict resolution (timestamp-based)
- [ ] Rate limiting + throttling
- [ ] Error handling + DLQ
- [ ] Audit logging

### Phase 4: Operations
- [ ] Bunny CDN integration
- [ ] MySQL backup automation
- [ ] Restore procedures
- [ ] Monitoring dashboard

### Phase 5: Security
- [ ] auth.js setup
- [ ] RBAC (Admin/Operator/Viewer)
- [ ] API authentication
- [ ] Secure credential storage

---

## 🔐 Security Considerations

✅ **No client-side Softone calls** - All through server  
✅ **Credentials in environment variables** - Never hardcoded  
✅ **RBAC for dashboard access** - Three role levels  
✅ **Audit trail** - Every operation logged  
✅ **Rate limiting** - Protect Softone API  
✅ **Dead letter queue** - Manual review for failed jobs  
✅ **Point-in-time recovery** - Database backups tested  

---

## 📈 Performance Considerations

✅ **Process pool** - Control concurrent API requests  
✅ **Batch inserts** - Use Prisma `createMany` for speed  
✅ **Checkpointing** - Resume from last position on failure  
✅ **Caching** - Softone metadata cached 24 hours  
✅ **Bunny CDN** - Global distribution for file access  
✅ **Database indexes** - On status, dates, config IDs  
✅ **Connection pooling** - Efficient DB access  

---

## 🐛 Common Issues & Solutions

### Softone Returns 429 (Too Many Requests)
→ Rate limiter backs off automatically
→ Check RateLimitTracker in dashboard

### Job Stuck in IN_PROGRESS
→ CronJobLock expires after 1 hour (auto-release)
→ Or manually release in admin dashboard

### Data Conflict (Both Softone & Local Changed)
→ Strategy decides winner (timestamp-based)
→ Or moves to manual review queue

### Encoding Issues (Garbled Text)
→ Check iconv-lite is converting ANSI 1253 → UTF-8
→ Add debug logging in softone-api.ts

### Backups Not Running
→ Check cron job in /docker/backup.sh
→ Verify DatabaseBackup table has recent entries
→ Verify Bunny CDN credentials

---

## 📞 Getting Help

### When Something Doesn't Work

1. **Check the docs**
   - ARCHITECTURE.md for design
   - IMPLEMENTATION_GUIDE.md for patterns
   
2. **Add debug logging**
   - Enable DEBUG env var
   - Add console.error/warn statements
   
3. **Check the database**
   - SyncJob table for job status
   - SyncJobDLQ for failures
   - SyncAudit for operation history
   
4. **Review error messages**
   - Look in job.errorMessage
   - Check application logs
   
5. **Ask Claude in Mirror IDE**
   - Show the error + context
   - Provide file path + line number
   - Ask for explanation

---

## 🎓 Learning Resources

### Understanding the Project
1. Read PROJECT_CONTEXT.md (2 min)
2. Read ARCHITECTURE.md (30 min)
3. Skim IMPLEMENTATION_GUIDE.md (10 min)

### Building the Project
1. Use FIRST_PROMPT_TO_CLAUDE.md to start
2. Reference MIRROR_IDE_WORKFLOW.md for each session
3. Follow IMPLEMENTATION_GUIDE.md phases in order

### Debugging Issues
1. Check relevant section in ARCHITECTURE.md
2. Review database tables (SyncJob, SyncAudit)
3. Add logging and retry
4. Ask Claude with error messages

---

## 🚀 Ready to Start?

1. **Open Mirror IDE**
2. **Copy prompt from FIRST_PROMPT_TO_CLAUDE.md**
3. **Paste into Claude chat**
4. **Follow Claude's guidance**
5. **Reference docs as needed**

**Let's build this! 🎯**

---

## 📋 File Manifest

```
/SoftoneIntegration/
├── README.md                      ← You are here
├── PROJECT_CONTEXT.md             ← Quick project overview
├── ARCHITECTURE.md                ← Complete technical design
├── IMPLEMENTATION_GUIDE.md        ← Phase-by-phase roadmap
├── MIRROR_IDE_WORKFLOW.md         ← How to work with Claude
└── FIRST_PROMPT_TO_CLAUDE.md     ← Ready-to-use kickoff prompt
```

**Start with FIRST_PROMPT_TO_CLAUDE.md** →

---

**Made with 🔧 for Giannis**  
**Last updated: 2026-04-09**
# dgsoftSiteSurvey
