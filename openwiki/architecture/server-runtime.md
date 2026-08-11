---
type: Architecture Overview
title: Server Runtime
description: The Express middleware chain, security hardening, SQLite session store, CSRF, rate limiting, health/readiness endpoints, and graceful shutdown.
tags: [architecture, express, security, sessions, csrf]
timestamp: 2026-07-21T00:00:00Z
---

# Overview

The server is a single Express 5 app defined in `server/index.ts`. It boots a SQLite-backed session
store, applies a hardened middleware chain, mounts a thin `/api` router, and in production serves the
built client. All tunable behavior is read through [configuration](../operations/configuration.md).

# Boot sequence

1. `ensureDataDirs()` creates `data/` if missing (`server/config.ts:36`).
2. `getSessionDb()` opens the SQLite session DB lazily with `journal_mode = WAL` and
   `foreign_keys = ON` (`server/db/connection.ts`).
3. `createSessionSchema(db)` creates the `sessions` table + `expire` index if absent
   (`server/db/sessionSchema.ts`).
4. The Express app is constructed and starts listening on `HOST:PORT`.

# Middleware chain (order matters)

The order in `server/index.ts` is deliberate:

1. `trust proxy` (if `TRUST_PROXY`) — and a **fatal guard**: production + `SECURE_COOKIES` without
   `TRUST_PROXY` throws at startup (`server/index.ts:41`).
2. `helmet()` security headers.
3. Body parsers: `express.json({ limit: '10mb' })`, `urlencoded`, `cookieParser`.
4. **Baseline rate limiter** — 1200 req / 15 min, skipping `/healthz`, `/favicon.ico`, and static
   assets (`server/index.ts:51`).
5. `express-session` backed by `better-sqlite3-session-store`; cookie is `httpOnly`, `sameSite: lax`,
   `secure` per `SECURE_COOKIES`, optional `domain` (`server/index.ts:63`).
6. **CSRF** via `csrf-sync`: token read from `_csrf` body field or `x-csrf-token` / `x-xsrf-token`
   headers, stored in the session; a following middleware exposes a fresh token on
   `res.locals.csrfToken` (`server/index.ts:87`).
7. Route-scoped limiters: `/api` (600/15min) plus separate public-page and static-asset limiters.

# Routes

- `/api` → `apiRouter` (`server/routes/api.ts`) with its own 600/15min limiter and two endpoints:
  `GET /api/health` (`{ status, app }`) and `GET /api/csrf` (returns the current CSRF token for the
  SPA to echo back on writes).
- Unmatched `/api/*` → `404 { error: 'Not found' }`.
- `GET /healthz` — liveness; `GET /readyz` — readiness, runs `SELECT 1` against the session DB and
  returns `503` on failure (`server/index.ts:143`).
- Static: `/assets` served immutable with 1-year cache; the rest of `dist/client` with 1-hour cache;
  GET/HEAD fall back to `index.html` for client routing (`server/index.ts:156`).
- A final error handler logs the stack and returns `500 { error: 'Internal server error' }`.

# Sessions and CSRF together

Sessions are the source of truth for the CSRF token (synchronizer-token pattern): the token is
stored in `req.session.csrfToken` and validated on state-changing requests. The SPA fetches it from
`GET /api/csrf` and sends it back via header. The `express-session` type is augmented in
`server/types/express-session.d.ts` so `session.csrfToken` is typed.

# Graceful shutdown

`SIGINT`/`SIGTERM` trigger `shutdown()`: stop accepting connections, close the session DB, and
`process.exit(0)`, with a 10s hard-timeout fallback (`server/index.ts:184`).

# Where to start

- `server/index.ts` — the whole chain top to bottom
- `server/routes/api.ts` — add new endpoints here
- `server/db/` — session store connection + schema

# What to watch out for

- **Add API routes to the `apiRouter`, above the `/api` 404.** Anything registered after the catch-all
  in `index.ts` for `/api` will 404.
- **Readiness depends on the session DB.** `/readyz` returns `503` if the SQLite handle can't answer
  `SELECT 1`; wire load balancers to `/readyz`, not `/healthz`.
- **Secrets and secure-cookie invariants are enforced at boot** — see
  [configuration](../operations/configuration.md).
- Session schema behavior is covered by the one existing test; see
  [validate & CI](../operations/validate-and-ci.md).
