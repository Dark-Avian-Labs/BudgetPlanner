# BudgetPlanner

## Org standards

Shared Dark Avian Labs engineering conventions (README shape, CI/PR runners, validate, release tracks) live in AppBase [`docs/org-standards/`](../AppBase/docs/org-standards/). The design system (theme axes, glass contracts, UI primitives, Clerk appearance) lives in AppBase [`AGENTS.md`](../AppBase/AGENTS.md). There is no shared UI package: when you change layout, glass, buttons, or modals here, apply the same change in AppBase / Codex / Armory.

## Overview

BudgetPlanner is a mobile-first household budget app for shared recurring expenses, income, and credits. Clerk is identity only. Plan membership, invites, and roles live in app SQLite (`plan_members`); this is not Clerk Organizations.

Default listen port in code is **3001**. `.env.example` and the Vite proxy default to **3002**. Keep `PORT` and `VITE_DEV_API_TARGET` aligned. See `README.md` for scripts and env.

## Money and plans

Money is stored as **integer cents**. Category and account IDs on writes must belong to the same plan (`server/lib/planValidation.ts`). `shared/dueThisMonth.ts` is the source of truth for this-month math; do not fork the rules in only the client or only the server wrapper.

Cadence includes monthly, quarterly, half-yearly, yearly, and `once`. Expired `once` entries are auto-archived on plan load and on entry writes. The plan UI can view other months (next month for print, past months for archived one-time items). Viewing a month includes archived `once` entries that were due then. Credits can use `final_amount_cents` for the last installment.

Roles are owner / editor / viewer. Invites are editor or viewer only; viewers cannot mutate. Invite accept requires the signed-in Clerk user's email to match the invite row (case-insensitive); mismatch is 403. The owner cannot leave: they delete the plan instead. Archived entries are soft-deleted (`archived_at`). The live current-month list skips them.

## Databases

Two SQLite files. Do not point them at the same path, and do not reuse Armory or Codex session/catalog files.

| File    | Env               | Role                                           |
| ------- | ----------------- | ---------------------------------------------- |
| App     | `APP_DB_PATH`     | Plans, members, categories, accounts, entries. |
| Session | `SESSION_DB_PATH` | Express sessions / CSRF.                       |

`pnpm run db:backup` copies `APP_DB_PATH` only (`scripts/backup-app-db.mjs`).

## Auth

Clerk keys are required for auth routes; without them those routes return **503** (the server still starts). That differs from Armory/Codex, where placeholder keys 500 every request. Leave keys empty or fill real ones; do not copy placeholder keys from those apps. CSRF tokens rotate when the Clerk user id on the express session changes (`server/session/bindClerkUserSession.ts`).

Production `COOKIE_DOMAIN=.darkavianlabs.com` is intentional so DAL apps share a login. `APP_PUBLIC_BASE_URL` is required when Clerk is configured; `ALLOWED_APP_ORIGINS` lists sibling apps for Clerk `authorizedParties`. Keep `VITE_*` plaintext; encrypting them garbles `vite build`. If you add app roles later, configure the Clerk session token with `"metadata": "{{user.public_metadata}}"` (`apps.budgetplanner`).

## Toolchain

Node **26+**, pnpm **11.x**, exact `packageManager`. Encrypted `.env.development` / `.env.production` need `DOTENV_PRIVATE_KEY_*` or `.env.keys`. `pnpm run validate` is the quality gate.

On Windows, Cursor agent shells may prepend bundled Node 22. After changing Node versions, run `pnpm rebuild better-sqlite3`.
