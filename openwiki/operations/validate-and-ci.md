---
type: Operations Guide
title: Validate & CI
description: The pnpm run validate quality gate, runtime preflight, the test suite, the PR CI workflow, and the DAL org standards AppBase follows.
tags: [operations, ci, validate, testing, org-standards]
timestamp: 2026-07-21T00:00:00Z
---

# Overview

AppBase exposes a single quality gate — `pnpm run validate` — that both agents and CI run before
merge. It is implemented by `run-quality-checks.mjs` and gated by a runtime preflight. This mirrors
the DAL org standard in `docs/org-standards/validate.md`.

# The validate pipeline

`run-quality-checks.mjs` first runs `scripts/runtime-preflight.mjs`; if preflight fails it exits
immediately. It then runs these steps in order, capturing timing and pass/warn/fail per step, and
exits non-zero if any fails (`run-quality-checks.mjs:11`):

1. `pnpm run check-format` — oxfmt
2. `pnpm run lint` — oxlint
3. `pnpm run typecheck` — server + client `tsc --noEmit`
4. `pnpm run test` — Vitest

A step that passes but emits a nonzero "warnings" count is reported as `WARN` (still non-fatal).

# Runtime preflight

`scripts/runtime-preflight.mjs` hard-fails the run unless:

- Node major **>= 26** (`process.version`).
- pnpm major **>= 11**, parsed from `package.json` `packageManager`.
- `better-sqlite3` loads and can open an in-memory DB — the error hint suggests
  `pnpm rebuild better-sqlite3` on a `NODE_MODULE_VERSION` mismatch (`scripts/runtime-preflight.mjs:39`).

This catches the most common environment traps before slower checks run and is why
[development & build](../workflows/development-and-build.md) calls out rebuilding native modules
after a Node version change.

# Testing

Tests run on Vitest with the Node environment, matching `server/**/*.test.ts` and
`client/**/*.test.ts`, V8 coverage into `coverage/` (`vitest.config.ts`). Today the suite is minimal:
`server/db/sessionSchema.test.ts` verifies `createSessionSchema` creates the `sessions` table against
an in-memory SQLite DB. Add tests beside the code they cover; a deeper testing guide is deferred to
the quickstart Backlog until the suite grows.

# PR CI

`.github/workflows/pr.yml` runs on `pull_request` on a Blacksmith 8-vCPU runner: checkout
(`useblacksmith/checkout@v1`) → `pnpm/action-setup@v6` → `actions/setup-node@v7` (Node 26,
`cache: pnpm`) → `pnpm install --frozen-lockfile` → **`pnpm run validate`** → **`pnpm run build`**.
Validate and build are the only gates; AppBase has no release/deploy workflow by design
(`docs/org-standards/ci-pr-release.md` → "Starter").

# Org standards

`docs/org-standards/` is the canonical set of DAL engineering conventions, mirrored into sibling apps
(no shared package):

- `readme-template.md` — README shape/badges/order.
- `ci-pr-release.md` — Blacksmith runners, pinned actions, three release tracks.
- `validate.md` — the validate contract this page implements.
- `openwiki.md` — the OKF OpenWiki requirements this wiki follows.
- `workflow-templates/` — example `pr.yml` / `ci.yml` / `release.yml`.

# Where to start

- `run-quality-checks.mjs`, `scripts/runtime-preflight.mjs`
- `.github/workflows/pr.yml`
- `docs/org-standards/`

# What to watch out for

- **Preflight fails fast.** Wrong Node/pnpm or a stale `better-sqlite3` binding blocks the entire
  validate run — fix the environment first (see [configuration](configuration.md)).
- **CI runs validate as one step**, not re-listed format/lint/typecheck/test steps — keep it that way
  per the org standard.
- **oxlint/oxfmt, not ESLint/Prettier.** Use the provided scripts; don't reintroduce the old
  toolchain.
