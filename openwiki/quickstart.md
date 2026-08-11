---
type: Repository Overview
title: AppBase Quickstart
description: Reusable Express + React/Vite/Tailwind starter for Dark Avian Labs apps, shipping the DAL design system and a hardened server baseline with no domain features.
tags: [overview, starter, express, react, design-system]
timestamp: 2026-07-27T15:55:00Z
---

# What AppBase is

AppBase is the shared starter for new Dark Avian Labs web apps (Codex, Armory, and future
projects). It ships the shell UX, the **DAL design system**, and a hardened Express server
baseline while leaving domain features intentionally empty. Authentication is **not** wired by
default — apps add [Clerk styling](integrations/clerk.md) or the org's centralized auth when
needed (`README.md:12`, `client/App.tsx`).

Audience: engineers and agents scaffolding a new DAL app, or keeping the design system aligned
across sibling apps.

# Stack

- **Server:** Express 5 with `helmet`, `express-session` (SQLite store via `better-sqlite3`),
  `csrf-sync`, layered `express-rate-limit`, and health/readiness endpoints (`server/index.ts`).
- **Client:** React 19 + React Router 8, built by Vite 8, styled with Tailwind CSS v4
  (`client/main.tsx`, `vite.config.ts`).
- **Tooling:** TypeScript 6, **oxlint** + **oxfmt** (not ESLint/Prettier), Vitest 4
  (`package.json`).
- **Runtime:** Node **>=26**, pnpm **>=11.9** (`package.json` `engines` / `packageManager`).

# Structure at a glance

- `server/` — Express entrypoint, config, API router, SQLite session store.
- `client/` — React SPA: `app/` (routing), `features/` (pages), `components/` (Layout + UI
  primitives), `context/` (theme), `styles/input.css` (all design tokens), `clerk/` (optional).
- `scripts/` — `dev.mjs` (dual dev processes) and `runtime-preflight.mjs`.
- `docs/org-standards/` — DAL engineering conventions mirrored into sibling apps.
- `run-quality-checks.mjs` — the `pnpm run validate` gate.

See [project structure](architecture/project-structure.md) for the full map.

# How to run

```bash
pnpm install
cp .env.example .env
pnpm dev          # Vite (5173) + watched Express API (3002)
```

Production: `pnpm run build` then `pnpm start`. Full script reference and the dev proxy model are
in [development & build](workflows/development-and-build.md).

# Major concept pages

- [Project structure](architecture/project-structure.md) — directory map and server/client split.
- [Server runtime](architecture/server-runtime.md) — middleware chain, security stack, sessions,
  health, graceful shutdown.
- [Design system](architecture/design-system.md) — two-axis theme model, glass surfaces, tokens,
  UI primitives, and shell backgrounds.
- [Development & build](workflows/development-and-build.md) — dev/build/start scripts and the Vite
  proxy.
- [Configuration](operations/configuration.md) — environment variables and session/security
  behavior.
- [Validate & CI](operations/validate-and-ci.md) — the quality gate, runtime preflight, tests, and
  org CI standards.
- [Clerk integration](integrations/clerk.md) — optional glass-themed Clerk auth styling.

# Agent gotchas

- **Node 26+ / pnpm 11+ enforced.** `run-quality-checks.mjs` runs `runtime-preflight.mjs` first; it
  hard-fails on older Node, older pnpm (from `packageManager`), or a broken `better-sqlite3`
  native binding (`pnpm rebuild better-sqlite3`).
- **Dev is two processes on two ports.** `pnpm dev` starts Vite (default `5173`) and a watched
  Express server (default `3002`); Vite proxies `/api` to the server (`scripts/dev.mjs`,
  `vite.config.ts`). Server default port is `3001` when run standalone (`server/config.ts:13`).
- **Production refuses the default session secret.** With `NODE_ENV=production` and the built-in
  `SESSION_SECRET`, the server exits at startup (`server/config.ts:20`). It also throws if
  `SECURE_COOKIES` is on without `TRUST_PROXY` (`server/index.ts:41`).
- **Auth is opt-in.** No auth middleware ships by default; `client/clerk/` is styling only and is
  not imported until an app wires it (`AGENTS.md`, "Optional: Clerk authentication styling").
- **Keep AppBase aligned with siblings.** There is no shared UI npm package; design-token and
  component-class changes must be mirrored into Codex and Armory manually
  ([design system](architecture/design-system.md)).

# Backlog

- **Shell background internals** (`client/lib/asciiBackground/*`, `assets/background*.txt`) — the
  ASCII wave + hex renderers are documented only at the contract level in
  [design system](architecture/design-system.md); the canvas math is deferred.
- **Deep testing guide** — only one test exists today (`server/db/sessionSchema.test.ts`); testing
  is summarized in [validate & CI](operations/validate-and-ci.md) until the suite grows.
