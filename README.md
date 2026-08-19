# BudgetPlanner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/Dark-Avian-Labs/BudgetPlanner/actions/workflows/ci.yml/badge.svg)](https://github.com/Dark-Avian-Labs/BudgetPlanner/actions/workflows/ci.yml)
[![PR](https://github.com/Dark-Avian-Labs/BudgetPlanner/actions/workflows/pr.yml/badge.svg)](https://github.com/Dark-Avian-Labs/BudgetPlanner/actions/workflows/pr.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white)](https://cursor.com)

BudgetPlanner is a mobile-first household budget app for shared recurring expenses, income, and credits. Invite someone by email with view or edit access. This-month totals only count what is due in the current calendar month. Sign-in uses [Clerk](https://clerk.com). English is the default locale, with German ready to go.

## Features

- Plans with categories, accounts, and entries (expense / income / credit)
- Monthly / quarterly / yearly cadence
- **This month** totals (only entries due in the current calendar month)
- Credit end date + final installment amount
- Details sheet → edit form; Organize mode for reordering
- Invite by email (view or edit) via copy-link + mailto
- Set invited plan as default
- i18next (`en` default, `de` ready)

## Requirements

- Node.js 26+
- pnpm 11+

## Quick start

1. Install Node.js and pnpm using your preferred method for your OS.

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Decrypt the committed env files (see [dotenvx](#dotenvx-and-encrypted-env-files)), or copy `.env.example` and fill in Clerk keys:

   ```bash
   cp .env.example .env.development
   ```

4. Run in development (Vite HMR + watched API server):

   ```bash
   pnpm dev
   ```

   Open `http://127.0.0.1:5173`. API requests are proxied to the Express server (`VITE_DEV_API_TARGET`, default `http://127.0.0.1:3002`).

5. Build and run production:

   ```bash
   pnpm run build
   pnpm start
   ```

In the Clerk dashboard (dev instance), allow `http://localhost:5173` (and sign-in/up paths). Production: allow `https://budget.darkavianlabs.com` on the DAL production instance.

## Examples

```bash
curl -sS http://127.0.0.1:3002/api/health
curl -sS http://127.0.0.1:3002/healthz
curl -sS http://127.0.0.1:3002/readyz
```

## dotenvx and encrypted env files

Encrypted `.env.development` and `.env.production` are committed. Decrypt locally with the private key(s) in `.env.keys` (gitignored). If you don't have `.env.keys` yet, get the `DOTENV_PRIVATE_KEY_*` values from a teammate / password manager, then either write `.env.keys` or export them for the session:

```bash
# Windows PowerShell: $env:DOTENV_PRIVATE_KEY_DEVELOPMENT="..."
# bash: export DOTENV_PRIVATE_KEY_DEVELOPMENT=...
```

Create or rotate secrets:

```bash
pnpm run env:set:dev KEY value      # encrypts into .env.development
pnpm run env:set:prod KEY value     # encrypts into .env.production
# or decrypt → edit → re-encrypt:
pnpm run env:decrypt
# edit .env.development / .env.production
pnpm run env:encrypt
```

Clerk keys: development (`pk_test_` / `sk_test_`) in `.env.development`, live keys in `.env.production`.

Production/CI: set `DOTENV_PRIVATE_KEY_PRODUCTION` on the host (do **not** deploy `.env.keys` unless you manage it carefully on the server). Store private keys in your secrets manager the same way you would an SSH deploy key.

Suggested secret naming:

- `DOTENV_PRIVATE_KEY_DEVELOPMENT`
- `DOTENV_PRIVATE_KEY_PRODUCTION`

Use one key per environment to reduce blast radius.

## Environment

| Variable                                | Description                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `PORT`, `HOST`                          | Server bind address (defaults: `3001`, `127.0.0.1`). `.env.example` uses `PORT=3002`. |
| `NODE_ENV`                              | Typically `development`, `test`, or `production`.                                     |
| `APP_NAME`, `APP_ID`                    | Display name and app id (session cookie prefix).                                      |
| `SESSION_SECRET`                        | Required in production; the server refuses to start with the default secret.          |
| `SESSION_COOKIE_NAME`                   | Session cookie key (defaults to `<APP_ID>.sid`).                                      |
| `TRUST_PROXY`, `SECURE_COOKIES`         | Reverse proxy and HTTPS-only cookie behavior.                                         |
| `COOKIE_DOMAIN`                         | Optional shared cookie domain.                                                        |
| `SESSION_DB_PATH`                       | SQLite session store location (default `./data/sessions.db`).                         |
| `APP_DB_PATH`                           | App SQLite path (default `./data/app.db`).                                            |
| `CLERK_SECRET_KEY`                      | **Required in production.** Clerk secret key for server-side session verification.    |
| `CLERK_PUBLISHABLE_KEY`                 | Clerk publishable key for the server (falls back to `VITE_CLERK_PUBLISHABLE_KEY`).    |
| `VITE_CLERK_PUBLISHABLE_KEY`            | Clerk publishable key for the client.                                                 |
| `VITE_DEV_API_TARGET`                   | Vite dev proxy target for `/api` (default `http://127.0.0.1:3002`).                   |
| `VITE_DEV_PORT`                         | Vite dev server port (default `5173`).                                                |
| `VITE_BASE_PATH`                        | Optional Vite base path for nested deployments.                                       |
| `VITE_APP_NAME`                         | App title shown in the shell.                                                         |
| `VITE_LEGAL_ENTITY_NAME`                | Footer legal name.                                                                    |
| `VITE_LEGAL_PAGE_URL`, `LEGAL_PAGE_URL` | Legal page redirect target.                                                           |

Client `VITE_*` variables are listed in `.env.example`.

## Scripts

| Script                  | Description                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `pnpm run validate`     | Runtime preflight (Node 26+, pnpm, SQLite native), format, lint, typecheck, tests. |
| `pnpm dev`              | Vite + watched Express (via dotenvx).                                              |
| `pnpm run build`        | Typecheck, compile server, and Vite client build.                                  |
| `pnpm start`            | Run production server from `dist/` (loads dotenvx in-process).                     |
| `pnpm run typecheck`    | Typecheck server and client.                                                       |
| `pnpm run lint`         | Run Oxlint.                                                                        |
| `pnpm run lint:fix`     | Run Oxlint with `--fix`.                                                           |
| `pnpm run format`       | Run Oxfmt.                                                                         |
| `pnpm run check-format` | Verify Oxfmt formatting.                                                           |
| `pnpm run test`         | Run Vitest once.                                                                   |
| `pnpm run test:watch`   | Run Vitest in watch mode.                                                          |
| `pnpm run env:encrypt`  | Encrypt `.env.development` + `.env.production`.                                    |
| `pnpm run env:decrypt`  | Decrypt both for local editing.                                                    |
| `pnpm run env:set:dev`  | Set an encrypted key in `.env.development`.                                        |
| `pnpm run env:set:prod` | Set an encrypted key in `.env.production`.                                         |

## Development

Agent-oriented docs: [openwiki/quickstart.md](openwiki/quickstart.md). Org standards: AppBase `docs/org-standards/`.

## License

MIT
