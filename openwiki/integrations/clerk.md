---
type: Integration
title: Clerk Authentication
description: Wired Clerk sign-in, plan access checks, and glass-themed auth pages.
tags: [clerk, auth]
timestamp: 2026-08-23T04:20:00Z
---

# Overview

BudgetPlanner uses Clerk for identity. Plan membership is app-owned SQLite (`plan_members`), not Clerk Organizations. CSRF still uses the Express session store in [server runtime](../architecture/server-runtime.md).

# Server

- `clerkMiddleware()` when `CLERK_SECRET_KEY` + publishable key are set (`server/index.ts`).
- Missing keys: auth routes return **503** (not a silent pass-through).
- `server/middleware/auth.ts` — `requireAuth`, `requirePlanAccess` (owner / editor / viewer).
- `server/services/users.ts` — upsert from Clerk, invite email.

# Client

- `@clerk/react` on sign-in / sign-up routes (`client/features/auth/`).
- Header user menu + [PlanSwitcher](../architecture/project-structure.md).
- `client/utils/api.ts` attaches CSRF and retries once on `403` + `X-CSRF-Error`.

Appearance helpers live under `client/clerk/` (same glass shell as AppBase).

# What to watch out for

- Configure the Clerk session token with `"metadata": "{{user.public_metadata}}"` if you add app roles later.
- Invite email is the Clerk user email at accept time; it must match the invite row.
- Do not commit real keys. Encrypted values stay in `.env.development` / `.env.production`.
