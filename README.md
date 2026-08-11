# BudgetPlanner

Mobile-first household budget planner for shared recurring expenses, income, and credits.

## Stack

- Express 5 + SQLite (`better-sqlite3`)
- React 19 + Vite + Tailwind v4 (DAL glass styling, loosely adapted from AppBase)
- Clerk authentication (separate Clerk application)
- i18next (`en` default, `de` ready)

## Setup

```bash
pnpm install
```

Encrypted `.env.development` / `.env.production` are committed. Decrypt locally with
the private key(s) in `.env.keys` (gitignored). If you don't have `.env.keys` yet,
get the `DOTENV_PRIVATE_KEY_*` values from a teammate / password manager, then either:

```bash
# Option A: write .env.keys (DOTENV_PRIVATE_KEY_DEVELOPMENT=... / _PRODUCTION=...)
# Option B: export for the session
#   Windows PowerShell: $env:DOTENV_PRIVATE_KEY_DEVELOPMENT="..."
#   bash: export DOTENV_PRIVATE_KEY_DEVELOPMENT=...
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

Clerk keys: development (`pk_test_` / `sk_test_`) in `.env.development`, live keys in
`.env.production`.

In the Clerk dashboard (dev instance), allow `http://localhost:5173` (and sign-in/up paths).
Production: allow `https://budget.darkavianlabs.com` on the DAL production instance.

```bash
pnpm dev
```

- Client: http://127.0.0.1:5173
- API: http://127.0.0.1:3002

Production/CI: set `DOTENV_PRIVATE_KEY_PRODUCTION` on the host (do **not** deploy `.env.keys`
unless you manage it carefully on the server).

## Features (v1)

- Plans with categories, accounts, and entries (expense / income / credit)
- Monthly / quarterly / yearly cadence
- **This month** totals (only entries due in the current calendar month)
- Credit end date + final installment amount
- Details sheet → edit form; Organize mode for reordering
- Invite by email (view or edit) via copy-link + mailto
- Set invited plan as default

## Scripts

| Script                  | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `pnpm dev`              | Vite + watched Express (via dotenvx)           |
| `pnpm run validate`     | preflight → format → lint → typecheck → test   |
| `pnpm run build`        | production build                               |
| `pnpm start`            | serve production build (in-process dotenvx)    |
| `pnpm run env:encrypt`  | Encrypt `.env.development` + `.env.production` |
| `pnpm run env:decrypt`  | Decrypt both for local editing                 |
| `pnpm run env:set:dev`  | Set an encrypted key in `.env.development`     |
| `pnpm run env:set:prod` | Set an encrypted key in `.env.production`      |
