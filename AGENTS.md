# BudgetPlanner

Household budget planner (Express + React/Vite). Styling is loosely adapted from AppBase / DAL glass tokens.

## OpenWiki

Not initialized yet. Prefer `README.md` and this file until OpenWiki is added.

## Stack

- Node >= 26, pnpm >= 11
- Express 5, SQLite (`better-sqlite3`) for sessions + app data
- React 19, Vite, Tailwind v4, Clerk (`@clerk/react` v6 / Core 3)
- i18next (`en` / `de`), `Intl` for money/dates
- Quality: oxlint, oxfmt, `pnpm run validate`

## Domain

- **Plan** → categories, accounts, entries, members, invites
- Entry `kind`: expense | income | credit
- Entry `frequency`: monthly | quarterly | halfyearly | yearly | once (`due_day`; `due_month` for non-monthly; `due_year` for once)
- One-time (`once`): due only in that year/month; auto-deleted when the calendar month ends
- Credit: `end_date`, `final_amount_cents`
- Totals: **due this month** only (not monthly-equivalent averaging)
- Roles: owner | editor | viewer; invites by email (copy link + mailto)

## UI conventions

- Mobile-first, icon-first chrome (Material Symbols)
- Frequency: calendar icon + `1` / `3` / `12`
- Tap entry → details → Edit; Organize mode for reorder
- Clerk: use `Show when="signed-in|signed-out"` (not legacy SignedIn/SignedOut)

## Auth env

Shared DAL Clerk application (same as Armory / other DAL apps). Secrets live in
**encrypted** `.env.development` / `.env.production` (committed).
Private keys are in `.env.keys` / `DOTENV_PRIVATE_KEY_*` (gitignored — never commit).

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Scripts load the matching file via dotenvx: `pnpm dev` → `.env.development`;
`pnpm run build` / `pnpm start` → `.env.production`.
