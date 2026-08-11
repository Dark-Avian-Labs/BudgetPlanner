---
type: Workflow
title: Development & Build
description: The dev/build/start scripts, the two-process dev model with Vite proxy, and how production output is assembled.
tags: [workflow, dev, build, vite, scripts]
timestamp: 2026-07-21T00:00:00Z
---

# Overview

AppBase has distinct development and production topologies. In development two processes run behind a
Vite proxy; in production a single Express process serves the pre-built client. Scripts are defined
in `package.json`; the dev orchestrator is `scripts/dev.mjs`.

# Development (`pnpm dev`)

`scripts/dev.mjs` spawns two child processes and forwards their stdio:

1. **API server** — `tsx watch --env-file=.env server/index.ts`, with `NODE_ENV=development` and
   `SECURE_COOKIES=0` forced (`scripts/dev.mjs:10`).
2. **Vite client** — `vite --port <VITE_DEV_PORT>` (default `5173`).

Vite proxies `/api` to the server (`vite.config.ts:30`), whose target is `VITE_DEV_API_TARGET`
(default `http://127.0.0.1:3002`). If either child exits, the orchestrator tears down both and exits
with that code (`scripts/dev.mjs:37`). Open `http://127.0.0.1:5173`.

> Port note: the Express server defaults to **3001** in `server/config.ts:13`, but the dev proxy and
> `.env.example` use **3002**. Keep `PORT` and `VITE_DEV_API_TARGET` in agreement — see
> [configuration](../operations/configuration.md).

# Build (`pnpm run build`)

Runs in sequence (`package.json:14`):

1. `pnpm run typecheck` — both `tsconfig.server.json` and `tsconfig.json`.
2. `tsc -p tsconfig.server.json` — compile server to `dist/server`.
3. `vite build` — bundle client to `dist/client` (`vite.config.ts:24`).

`VITE_BASE_PATH` sets the client base for nested deployments (`vite.config.ts:13`).

# Production (`pnpm start`)

`node --env-file=.env dist/server/index.js` starts the compiled server, which serves `dist/client`
and falls back to `index.html` for client routing. Runtime behavior is covered in
[server runtime](../architecture/server-runtime.md).

# Other scripts

`lint` / `lint:fix` (oxlint), `format` / `check-format` (oxfmt), `test` / `test:watch` /
`test:coverage` (Vitest), and `validate` — the pre-commit/CI gate documented in
[validate & CI](../operations/validate-and-ci.md).

# Where to start

- `scripts/dev.mjs`, `vite.config.ts`, `package.json` scripts

# What to watch out for

- **Dev forces insecure cookies.** `SECURE_COOKIES=0` is injected so login works over plain HTTP
  locally; do not rely on that in any deployed environment.
- **Native module first.** After changing Node versions, run `pnpm rebuild better-sqlite3` or the
  preflight in [validate & CI](../operations/validate-and-ci.md) will fail.
