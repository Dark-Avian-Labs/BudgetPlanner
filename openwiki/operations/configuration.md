---
type: Operations Guide
title: Configuration
description: Environment variables, defaults, and the session/security invariants enforced at server startup.
tags: [operations, configuration, env, security, sessions]
timestamp: 2026-07-21T00:00:00Z
---

# Overview

Configuration is entirely environment-driven. The server reads and validates env in
`server/config.ts`; the client reads `VITE_*` variables at build time. `.env.example` is the
template — copy it to `.env`. **Never commit real secrets**; `.env.example` holds placeholders only.

# Server variables

| Variable              | Default                        | Purpose                                                 |
| --------------------- | ------------------------------ | ------------------------------------------------------- |
| `PORT`                | `3001`                         | Listen port (`.env.example` uses `3002`).               |
| `HOST`                | `127.0.0.1`                    | Bind address.                                           |
| `NODE_ENV`            | `development`                  | Enables production invariants when `production`.        |
| `APP_NAME`            | `AppBase`                      | Display name in logs/health responses.                  |
| `APP_ID`              | `appbase`                      | Prefix for the default session cookie name.             |
| `SESSION_SECRET`      | `appbase-dev-secret-change-me` | Session signing key; **must** be overridden in prod.    |
| `SESSION_COOKIE_NAME` | `<APP_ID>.sid`                 | Session cookie key.                                     |
| `TRUST_PROXY`         | off                            | `1`/`true` to trust `X-Forwarded-*` behind a proxy.     |
| `SECURE_COOKIES`      | off                            | `1`/`true` to mark the session cookie `Secure`.         |
| `COOKIE_DOMAIN`       | unset                          | Optional shared cookie domain.                          |
| `SESSION_DB_PATH`     | `<root>/data/sessions.db`      | SQLite session store path (`CENTRAL_DB_PATH` fallback). |

Values are read in `server/config.ts`; the port is validated to a positive integer and falls back to
`3001` (`server/config.ts:13`).

# Startup invariants

Two guards can stop the server before it accepts traffic:

- **Production secret guard** — with `NODE_ENV=production` and the default `SESSION_SECRET`, the
  process logs `[FATAL]` and exits `1` (`server/config.ts:20`).
- **Secure-cookie/proxy guard** — production + `SECURE_COOKIES` without `TRUST_PROXY` throws
  (`server/index.ts:41`), because a secure cookie behind an unrecognized proxy would never be set.

These enforce the security posture described in
[server runtime](../architecture/server-runtime.md).

# Client (Vite) variables

Build-time `VITE_*` values (see `.env.example`, `client/app/config.ts`, `vite.config.ts`):

- `VITE_APP_NAME`, `VITE_LEGAL_ENTITY_NAME`, `VITE_SEARCH_PLACEHOLDER` — shell text, with in-code
  fallbacks (`client/app/config.ts`).
- `VITE_BASE_PATH` — client base path for nested deployments.
- `VITE_DEV_API_TARGET`, `VITE_DEV_PORT` — dev proxy target and Vite port
  ([development & build](../workflows/development-and-build.md)).
- `VITE_SHARED_THEME_COOKIE_DOMAIN` — domain for the shared `dal.*` theme cookies so theme choices
  sync across subdomains ([design system](../architecture/design-system.md)).

# Where to start

- `server/config.ts` — server env + invariants
- `.env.example` — the full template
- `client/app/config.ts` — client-side env fallbacks

# What to watch out for

- **Set a strong `SESSION_SECRET` in production** or the server will not start.
- **`PORT` vs the dev proxy.** The code default is `3001`; the dev proxy and `.env.example` assume
  `3002`. Keep `PORT` and `VITE_DEV_API_TARGET` aligned.
- **`SESSION_DB_PATH` should be absolute in production**, on a writable volume — the store is created
  on first start.
