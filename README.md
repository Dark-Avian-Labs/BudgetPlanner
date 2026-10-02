<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# BudgetPlanner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

BudgetPlanner is the household ledger for recurring bills, income, and credits. You keep one plan, see what is actually due this month, and hand someone else a link when they need to look at it too.

It is for the people who pay the same bills and want the argument to be about the number on the screen, on a phone, at the table.

## Features

**One plan, three kinds of money.** Expenses, income, and credits live in the same list. Credits can carry an end date and a final installment, so a loan does not look like a bill that lasts forever.

**Cadence that matches the bill.** Monthly, quarterly, twice a year, or yearly. The this-month totals only count what falls in the current calendar month. That is the number worth arguing about. The rest of the year stays on the row so you can still see it coming.

**A link instead of a shared login.** Invite someone by email as a viewer or an editor. The app gives you a link to send. An invited plan can be the one that opens by default.

**English and German.** The language follows the browser, and a switcher in the app changes it. Amounts use the currency set on the plan. There is a print view when the table needs paper.

## What you should know

The plan sits behind a Dark Avian Labs account. The same sign-in opens Codex, Armory, Outfitter, and Sentinel. The left rail jumps between those sites.

A viewer can read the plan. An editor can change entries. The invite is a link, so the other person still signs in with their own account before it opens.

Live: [budget.darkavianlabs.com](https://budget.darkavianlabs.com)

## Self-hosting

Node 26 or newer, and pnpm 12. Copy `.env.example` to `.env.development` for local work. `pnpm dev` reads that file.

```
pnpm install
pnpm dev
```

`pnpm run build` insists on `.env.production` and will stop if that file is missing or still encrypted. A hosted process also needs `NODE_ENV=production`, or `pnpm start` keeps reading `.env.development`. Fill the Clerk keys before you build. The client bundle picks up `VITE_` values at build time.

## License

MIT
