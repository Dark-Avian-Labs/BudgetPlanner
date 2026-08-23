---
type: Architecture Overview
title: Server Runtime
description: Express middleware, vendored SQLite sessions, CSRF, health checks, crash guards, and shutdown.
tags: [architecture, express, sessions, csrf]
timestamp: 2026-08-23T04:51:00Z
---

# Overview

`server/index.ts` builds the Express 5 app, opens both SQLite files, and listens. Tunables come from [configuration](../operations/configuration.md). Plan routes are documented in [plans and sharing](../workflows/plans-and-sharing.md).

# Boot

1. `ensureDataDirs()` creates `data/` if needed.
2. Session DB (`SESSION_DB_PATH`) + `createSessionSchema` + `SqliteSessionStore` (15-minute expiry sweep). The store is in-repo (`server/db/sqliteSessionStore.ts`); it replaces unmaintained `better-sqlite3-session-store`.
3. App DB (`APP_DB_PATH`) + `createAppSchema`.
4. Middleware, then listen on `HOST:PORT`.

# Middleware order

1. `trust proxy` when `TRUST_PROXY`. Production + `SECURE_COOKIES` without `TRUST_PROXY` throws.
2. Helmet / CSP (`server/http/helmetCsp.ts`). `style-src` still allows `'unsafe-inline'` for Tailwind.
3. JSON / urlencoded body parsers, **64kb** limit.
4. Clerk middleware when keys are set; otherwise auth routes return **503**.
5. Baseline rate limit (1200 / 15 min), skipping health, `/api/version`, and hashed assets.
6. Express session (cookie name `SESSION_COOKIE_NAME`, optional `COOKIE_DOMAIN`).
7. CSRF (`csrf-sync`) on mutating `/api` routes.
8. `GET /api/version` — package version for the stale-client banner. Then `apiRouter` (`/api/health`, plans, auth).

# Health and shutdown

- `GET /healthz` — process is up.
- `GET /readyz` — session + app DBs reachable.
- `GET /api/version` — `{ version }` from `package.json`. `Cache-Control: no-store`. The client polls this and shows the gold "Refresh now!" banner when the baked-in bundle version differs.
- Signals and `unhandledRejection` / `uncaughtException` run graceful close, then exit **1** after `SHUTDOWN_TIMEOUT_MS` (default 10000).

Production `index.html` is `no-cache`; hashed `/assets` are immutable.

# Where to start

- `server/index.ts`
- `server/db/sqliteSessionStore.ts`
- `server/http/helmetCsp.ts`

# What to watch out for

- Two databases. Do not point `APP_DB_PATH` and `SESSION_DB_PATH` at the same file.
- `COOKIE_DOMAIN=.darkavianlabs.com` is intentional so DAL apps share login across subdomains.
