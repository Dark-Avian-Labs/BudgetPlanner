<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# BudgetPlanner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/BudgetPlanner/ci.yml?style=flat-square&label=CI)](https://github.com/Dark-Avian-Labs/BudgetPlanner/actions/workflows/ci.yml)
[![PR](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/BudgetPlanner/pr.yml?style=flat-square&label=PR)](https://github.com/Dark-Avian-Labs/BudgetPlanner/actions/workflows/pr.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Shared household budget for recurring expenses, income, and credits. Invite by email (view or edit). This-month totals only count what is due in the current calendar month. English default, German ready. Sign-in uses [Clerk](https://clerk.com). Plan membership lives in app SQLite, not Clerk Organizations.

Live: [budget.darkavianlabs.com](https://budget.darkavianlabs.com)

Default API port is **3002**. Keep `PORT` and `VITE_DEV_API_TARGET` aligned. Vite is **5173**.

## Gotchas

- Encrypted `.env.development` / `.env.production` are committed. Decrypt with `.env.keys` or `DOTENV_PRIVATE_KEY_*`. Never encrypt `VITE_*`. Do not copy Armory/Codex placeholder Clerk keys — they are fatal here too.
- Without Clerk keys the server still starts, but auth routes return **503**. Production needs real keys, `APP_PUBLIC_BASE_URL`, and `COOKIE_DOMAIN=.darkavianlabs.com` to share login with the other DAL apps. Allow `http://localhost:5173` on the Clerk dev instance.
- `APP_DB_PATH` and `SESSION_DB_PATH` must be different files. Do not reuse Armory or Codex SQLite.
- Invite accept requires the signed-in Clerk email to match the invite (case-insensitive). Mismatch is 403. The owner cannot leave a plan; they delete it.
- After changing Node versions on Windows, `pnpm rebuild better-sqlite3`.

## License

MIT
