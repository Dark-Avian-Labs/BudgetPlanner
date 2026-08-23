---
type: Operations Guide
title: Configuration
description: dotenvx env files, the 3001 vs 3002 port trap, and startup invariants.
tags: [operations, env, dotenvx]
timestamp: 2026-08-23T04:20:00Z
---

# Overview

`server/config.ts` loads `.env.keys` (if present) then `.env.<NODE_ENV>` via dotenvx. Values already in `process.env` win. Never commit `.env.keys`. Template: `.env.example`.

# Ports

| Source                         | Default  |
| ------------------------------ | -------- |
| `server/config.ts` `PORT`      | **3001** |
| `.env.example` `PORT`          | **3002** |
| Vite / `scripts/dev.mjs` proxy | **3002** |

Keep `PORT` and `VITE_DEV_API_TARGET` on the same origin. The README curl examples still say 3002.

# Important variables

| Variable              | Notes                                                            |
| --------------------- | ---------------------------------------------------------------- |
| `SESSION_SECRET`      | Production refuses the built-in default.                         |
| `SESSION_DB_PATH`     | CSRF sessions. Prefer absolute in production.                    |
| `APP_DB_PATH`         | Plans database. Prefer absolute in production.                   |
| `COOKIE_DOMAIN`       | `.darkavianlabs.com` in production so DAL apps share login.      |
| `TRUST_PROXY`         | Required in production when `SECURE_COOKIES` is on.              |
| `SHUTDOWN_TIMEOUT_MS` | Default 10000.                                                   |
| Clerk keys            | Missing keys → auth routes 503. Production should set real keys. |
| `VITE_*`              | Stay plaintext. Encrypting them garbles `vite build`.            |

# Dev vs production

`pnpm dev` runs `dotenvx run -f .env.development -- node scripts/dev.mjs` (Vite + `tsx watch`). `pnpm start` runs `node dist/server/index.js` and expects `NODE_ENV` from the process manager.

# What to watch out for

- Two SQLite paths. Do not reuse Armory/Codex session files.
- `pnpm run db:backup` (`scripts/backup-app-db.mjs`) copies `APP_DB_PATH` only.
