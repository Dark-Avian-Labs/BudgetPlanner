---
type: Operations Guide
title: Validate and CI
description: The validate gate, runtime preflight, tests, and frozen-lockfile CI.
tags: [operations, ci, validate, testing]
timestamp: 2026-08-23T04:20:00Z
---

# Overview

`pnpm run validate` is `run-quality-checks.mjs`. It matches the DAL contract in AppBase `docs/org-standards/validate.md`.

# Pipeline

1. `scripts/runtime-preflight.mjs` — Node 26+, pnpm major from `packageManager`, `better-sqlite3` loads.
2. `pnpm run check-format` (oxfmt)
3. `pnpm run lint` (oxlint)
4. `pnpm run typecheck`
5. `pnpm run test` (Vitest)

# Tests worth knowing

- `server/lib/planValidation.test.ts` — currency, names, cents, year, entry body.
- `server/lib/dueThisMonth.test.ts` — due-this-month rules.
- `server/db/sqliteSessionStore.test.ts` — vendored session store.
- `server/services/users.test.ts` — invite email / user helpers.
- `server/http/helmetCsp.test.ts` — CSP.

# CI

`.github/workflows/pr.yml` and `ci.yml` run `pnpm install --frozen-lockfile` on Blacksmith runners. Third-party actions are pinned to commit SHAs. The old `pnpm-install-fresh` action is gone.

# What to watch out for

- Wrong Node or a stale `better-sqlite3` binding fails preflight before slower checks run.
- After changing Node versions: `pnpm rebuild better-sqlite3`.
