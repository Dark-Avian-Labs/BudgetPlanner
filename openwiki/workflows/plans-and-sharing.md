---
type: Workflow
title: Plans and Sharing
description: Plans, categories, accounts, entries, invite links, and write-side validation.
tags: [plans, money, invites, validation]
timestamp: 2026-08-23T04:20:00Z
---

# Overview

A plan is a shared household budget. The owner invites people by email as `editor` or `viewer`. Entries are expenses, income, or credits with a cadence. This-month totals use [shared due math](../architecture/project-structure.md) (`shared/dueThisMonth.ts`). Auth gate: [Clerk](../integrations/clerk.md).

# Where to start

| Concern       | Path                                        |
| ------------- | ------------------------------------------- |
| HTTP          | `server/routes/plans.ts`                    |
| Write rules   | `server/lib/planValidation.ts`              |
| Schema        | `server/db/appSchema.ts`                    |
| Users/invites | `server/services/users.ts`                  |
| UI            | `client/features/plan/PlanPage.tsx`         |
| Plan switcher | `client/components/Layout/PlanSwitcher.tsx` |
| Invite accept | `client/features/invite/InvitePage.tsx`     |

# Data model

- `plans` — name, currency (`EUR` / `USD` / `GBP` / `CHF` / `SEK` / `NOK` / `DKK`), owner.
- `plan_members` — `owner` / `editor` / `viewer` (`idx_plan_members_user`).
- `plan_invites` — email, role, unique token, expiry.
- `categories` / `accounts` — per-plan, reorderable.
- `entries` — `amount_cents` (non-negative integer), kind, frequency, due day/month/year, optional credit end date + `final_amount_cents`, `archived_at`.

# Writes

`validateEntryBody` and helpers in `planValidation.ts` reject bad currency, empty/overlong names, comments over 2000 chars, years outside 2000–2100, and non-integer cents. `category_id` / `account_id` on create, PATCH, and reorder must already belong to that plan (`categoryBelongsToPlan` / `accountBelongsToPlan` in `plans.ts`). Viewers cannot mutate.

# Sharing

Invites are email + copy-link + mailto (`server/services/users.ts`). Accepting `/invite/:token` adds a member. Leave / remove / revoke / delete-plan flows confirm in the UI (`PlanPage.tsx`). The header [PlanSwitcher](../architecture/project-structure.md) changes the default plan.

# What to watch out for

- Store money as cents. Do not persist a float.
- Do not trust client-supplied category/account IDs without the same-plan check.
- Archived entries stay in the row; this-month math skips them via `archived_at`.
