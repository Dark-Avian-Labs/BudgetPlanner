# BudgetPlanner

Shell, auth, env, and validate are in AppBase `AGENTS.md`. Port 3003. Playwright 3103. This app uses the compact shell: `max-w-3xl` and an `h-14` header.

Household budget. Clerk is identity only. Membership is `plan_members` in app SQLite, not Clerk Organizations.

Money is integer cents. `shared/dueThisMonth.ts` is the only this-month implementation. Do not fork it.

Without Clerk keys, auth routes return 503 and the server still starts. Do not copy placeholder keys from another app.

`APP_DB_PATH` and `SESSION_DB_PATH` must be different files. `pnpm run db:backup` copies the app DB only.

The owner cannot leave a plan. They delete it. Invite accept requires the signed-in email to match the invite. Viewers cannot mutate. Archived rows use `archived_at`.

English and German strings both exist. Add a key to both locale files.
