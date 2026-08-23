# BudgetPlanner

## Org standards

Shared Dark Avian Labs engineering conventions (README shape, CI/PR runners, validate, release tracks, OpenWiki) live in AppBase [`docs/org-standards/`](../AppBase/docs/org-standards/). Prefer those docs when aligning workflows or quality gates.

## Overview

BudgetPlanner is a mobile-first household budget app for shared recurring expenses, income, and credits. Clerk handles sign-in. Plans, categories, accounts, and entries live in SQLite (`APP_DB_PATH`); Express sessions for CSRF live in a second SQLite file (`SESSION_DB_PATH`).

## Running the service

See `README.md` for scripts. Encrypted env files:

```bash
NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js
```

Without the private key, copy `.env.example` to `.env.development` and fill Clerk keys.

Default listen port in code is **3001**. `.env.example` and the Vite proxy default to **3002**. Keep `PORT` and `VITE_DEV_API_TARGET` aligned.

## Key gotchas

- **Node >= 26 and pnpm >= 11 required.** `packageManager` must stay an exact version.
- Encrypted `.env.development` / `.env.production` need `DOTENV_PRIVATE_KEY_*` or `.env.keys`.
- Clerk keys are required for auth routes; without them those routes return 503.
- Money is stored as **cents**. Category and account IDs on writes must belong to the same plan (`server/lib/planValidation.ts`).
- `pnpm run db:backup` copies `APP_DB_PATH` via `scripts/backup-app-db.mjs`.
- UI tokens are mirrored with AppBase / Codex / Armory (no shared UI package).
- On Windows, Cursor agent shells may prepend Node 22. After changing Node versions, run `pnpm rebuild better-sqlite3`.

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:

- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.
