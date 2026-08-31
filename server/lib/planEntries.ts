import type Database from 'better-sqlite3';

import type { EntryFrequency, EntryKind } from '../db/appSchema.js';

export const ENTRY_SELECT = `id, plan_id, category_id, account_id, name, amount_cents, kind, frequency,
              due_day, due_month, due_year, comment, end_date, final_amount_cents, archived_at, sort_order`;

export type PlanEntryRow = {
  id: string;
  plan_id: string;
  category_id: string;
  account_id: string | null;
  name: string;
  amount_cents: number;
  kind: EntryKind;
  frequency: EntryFrequency;
  due_day: number;
  due_month: number | null;
  due_year: number | null;
  comment: string | null;
  end_date: string | null;
  final_amount_cents: number | null;
  archived_at: string | null;
  sort_order: number;
};

export function syncOnceArchiveState(
  db: Database.Database,
  planId: string,
  year: number,
  month: number,
): void {
  const hasWork = db
    .prepare(
      `SELECT 1 AS ok FROM entries
       WHERE plan_id = ? AND (frequency = 'once' OR archived_at IS NOT NULL)
       LIMIT 1`,
    )
    .get(planId) as { ok: number } | undefined;
  if (!hasWork) return;

  const monthKey = year * 12 + month;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE entries
       SET archived_at = datetime('now'), updated_at = datetime('now')
       WHERE plan_id = ?
         AND frequency = 'once'
         AND archived_at IS NULL
         AND (
           due_month IS NULL
           OR due_year IS NULL
           OR (due_year * 12 + due_month) < ?
         )`,
    ).run(planId, monthKey);

    db.prepare(
      `UPDATE entries
       SET archived_at = NULL, updated_at = datetime('now')
       WHERE plan_id = ?
         AND frequency = 'once'
         AND archived_at IS NOT NULL
         AND due_month IS NOT NULL
         AND due_year IS NOT NULL
         AND (due_year * 12 + due_month) >= ?`,
    ).run(planId, monthKey);

    db.prepare(
      `UPDATE entries
       SET archived_at = NULL, updated_at = datetime('now')
       WHERE plan_id = ?
         AND frequency != 'once'
         AND archived_at IS NOT NULL`,
    ).run(planId);
  });
  tx();
}

export function listPlanEntries(
  db: Database.Database,
  planId: string,
  year: number,
  month: number,
  includeAllArchived = false,
): PlanEntryRow[] {
  if (includeAllArchived) {
    return db
      .prepare(`SELECT ${ENTRY_SELECT} FROM entries WHERE plan_id = ? ORDER BY sort_order, name`)
      .all(planId) as PlanEntryRow[];
  }

  return db
    .prepare(
      `SELECT ${ENTRY_SELECT} FROM entries
       WHERE plan_id = ?
         AND (
           archived_at IS NULL
           OR (frequency = 'once' AND due_year = ? AND due_month = ?)
         )
       ORDER BY sort_order, name`,
    )
    .all(planId, year, month) as PlanEntryRow[];
}
