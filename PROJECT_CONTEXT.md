---
name: Softone ERP Integration Library Project
description: Next.js reusable library for Softone integration with Prisma, RBAC, cron sync, and admin dashboard
---

## Core Vision

Build a production-grade Next.js library that handles end-to-end Softone ERP integration:
- Dynamic object → table → field discovery and mapping
- Automatic Prisma ORM MySQL schema generation
- Configurable sync directions (read-only or bi-directional CRUD)
- Process pool for CRUD operations (Softone capacity constraints)
- Cron-based scheduled syncing per object/table
- Reusable RBAC admin dashboard (used across all company applications)

## Key Technical Requirements

**Encoding**: Softone returns ANSI 1253 → convert to UTF-8 via iconv-lite
**Operations**: Server-side only (no client-side Softone calls)
**Architecture**: Process pool to manage jobs due to Softone web service capacity limits
**Database**: Prisma ORM + MySQL
**Auth**: auth.js with RBAC
**UI**: Shadcn + Tailwind (professional, reusable components)
**Boilerplate Includes**: Admin dashboard, data tables, modals (templates for all apps)

## Expected Features

1. **Discovery UI**: Select object → select tables → view fields with types
2. **Schema Mapping**: Map Softone fields to Prisma schema (auto-generated)
3. **Sync Config**: Choose read-only or CRUD enablement
4. **Cron Config**: Define sync schedules per object/table
5. **Process Pool**: Manage concurrent CRUD jobs safely
6. **RBAC Dashboard**: Reusable across applications

## Use Case Context

- Using Mirror IDE with Claude for development
- Needs clear directions for AI-assisted development
- Focus on component reusability for future projects
- Enterprise-grade reliability required
