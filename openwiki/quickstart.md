---
type: Repository Overview
title: BudgetPlanner Quickstart
description: Household budget app for shared recurring expenses — stack, how to run, and where to dig in.
tags: [overview, budget, clerk, sqlite]
timestamp: 2026-08-23T04:20:00Z
---

# What BudgetPlanner is

BudgetPlanner is a mobile-first household budget app. People share a plan, track recurring expenses / income / credits, and invite others by email with view or edit access. This-month totals only count what is due in the current calendar month. Sign-in uses [Clerk](integrations/clerk.md). English is the default locale; German is wired.

Audience: engineers and agents working on plans, money math, or the DAL shell.

# Stack

- **Server:** Express 5, `helmet`, `@clerk/express`, vendored SQLite session store, `csrf-sync`, rate limits (`server/index.ts`).
- **Client:** React 19 + React Router 8 + `@clerk/react` + i18next, Vite 8, Tailwind CSS v4.
- **Data:** two SQLite files — `APP_DB_PATH` (plans) and `SESSION_DB_PATH` (CSRF sessions).
- **Tooling:** TypeScript, oxlint + oxfmt, Vitest. Node **>=26**, pnpm **>=11**.

# Structure at a glance

- `server/` — Express entry, config, plan API, validation, session store.
- `client/` — SPA: `features/plan`, `invite`, `home`, `auth`; `components/Layout/PlanSwitcher`.
- `shared/dueThisMonth.ts` — due-date math used by both sides.
- `scripts/` — `dev.mjs`, `runtime-preflight.mjs`, `backup-app-db.mjs`.

See [project structure](architecture/project-structure.md).

# How to run

```bash
pnpm install
pnpm dev          # Vite 5173 + watched Express
```

Encrypted `.env.development` / `.env.production` need `.env.keys` or `DOTENV_PRIVATE_KEY_*`. Without keys, copy `.env.example` to `.env.development` and add Clerk keys.

Production: `pnpm run build` then `pnpm start`. Quality gate: `pnpm run validate`.

# Major concept pages

- [Project structure](architecture/project-structure.md)
- [Server runtime](architecture/server-runtime.md)
- [DAL design system](architecture/design-system.md)
- [Plans and sharing](workflows/plans-and-sharing.md)
- [Configuration](operations/configuration.md)
- [Validate and CI](operations/validate-and-ci.md)
- [Clerk authentication](integrations/clerk.md)

# Agent gotchas

- **Code default port is 3001** (`server/config.ts`). `.env.example` and the Vite proxy default to **3002**. Keep `PORT` and `VITE_DEV_API_TARGET` the same or the UI talks to the wrong process.
- **Node 26+ / pnpm 11+.** `run-quality-checks.mjs` runs `scripts/runtime-preflight.mjs` first.
- **Clerk keys missing → 503 on auth routes**, not a silent pass-through (`server/index.ts`).
- Money is **integer cents**. Category and account IDs on PATCH/reorder must belong to the same plan (`server/lib/planValidation.ts`).
- UI tokens are mirrored with AppBase / Armory / Codex. No shared UI package.
- `pnpm run db:backup` copies `APP_DB_PATH`.

# Backlog

- **README curl examples still say 3002** even though the server fallback is 3001. Trust `server/config.ts` + the env file you actually loaded.
