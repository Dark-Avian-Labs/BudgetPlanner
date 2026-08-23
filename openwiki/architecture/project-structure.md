---
type: Architecture Overview
title: Project Structure
description: Directory layout, the server/client split, and how plan code is shared.
tags: [architecture, structure]
timestamp: 2026-08-23T04:20:00Z
---

# Overview

BudgetPlanner is a single-package app: Express API plus a Vite React SPA. Domain logic lives next to the HTTP layer, with due-date math in `shared/` so the client and server stay aligned. Runtime behavior is in [server runtime](server-runtime.md). Plan writes are in [plans and sharing](../workflows/plans-and-sharing.md).

# Directory map

```
server/
├── index.ts              Boot, middleware, listen, crash/shutdown
├── config.ts             dotenvx env + PORT/HOST/paths
├── routes/api.ts         Health + mount
├── routes/plans.ts       Plan CRUD, members, invites, entries
├── lib/planValidation.ts Currency, names, cents, year, same-plan IDs
├── lib/dueThisMonth.ts   Server wrapper around shared due math
├── services/users.ts     Clerk user upsert + invite email
├── db/appSchema.ts       plans, members, invites, categories, accounts, entries
├── db/sqliteSessionStore.ts
└── http/helmetCsp.ts

client/
├── features/plan/        Plan page, organize mode, delete confirms
├── features/invite/      Accept invite
├── features/home/        Plan list
├── features/auth/        Sign-in / sign-up
├── components/Layout/    Shell + PlanSwitcher
└── lib/dueThisMonth.ts   Client wrapper around shared due math

shared/dueThisMonth.ts    Canonical due-this-month rules
scripts/                  dev.mjs, runtime-preflight.mjs, backup-app-db.mjs
```

# Server/client boundary

Production Express serves `dist/client` and falls back to `index.html`. The client talks only through `/api` (`client/utils/api.ts`). Dev is two processes with a Vite `/api` proxy — see [configuration](../operations/configuration.md) for the 3001 vs 3002 trap.

# Where to start

- Server entry: `server/index.ts`
- Client entry: `client/main.tsx` → `client/app/routes.tsx`
- Write validation: `server/lib/planValidation.ts`
- Schema: `server/db/appSchema.ts`

# What to watch out for

- `shared/dueThisMonth.ts` is the source of truth. Do not fork the rules in only one wrapper.
- `@` alias is Vite-only. Server code uses relative `.js` imports.
