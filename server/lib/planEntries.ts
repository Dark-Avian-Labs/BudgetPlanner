import type Database from 'better-sqlite3';

import type { EntryFrequency } from '../db/appSchema.js';
import { isOnceEntryExpired } from './dueThisMonth.js';

export const ENTRY_SELECT = `id, plan_id, category_id, account_id, name, amount_cents, kind, frequency,
              due_day, due_month, due_year, comment, end_date, final_amount_cents, archived_at, sort_order`;

export function syncOnceArchiveState(
  db: Database.Database,
  planId: string,
  year: number,
  month: number,
): void {
  const rows = db
    .prepare(
      `SELECT id, frequency, due_month, due_year, archived_at FROM entries WHERE plan_id = ?`,
    )
    .all(planId) as Array<{
    id: string;
    frequency: EntryFrequency;
    due_month: number | null;
    due_year: number | null;
    archived_at: string | null;
  }>;

  const archive = db.prepare(
    `UPDATE entries SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
  );
  const unarchive = db.prepare(
    `UPDATE entries SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const shouldArchive = row.frequency === 'once' && isOnceEntryExpired(row, year, month);
      if (shouldArchive && row.archived_at == null) archive.run(row.id);
      if (!shouldArchive && row.archived_at != null) unarchive.run(row.id);
    }
  });
  tx();
}

export function listPlanEntries(
  db: Database.Database,
  planId: string,
  year: number,
  month: number,
  includeAllArchived = false,
): unknown[] {
  if (includeAllArchived) {
    return db
      .prepare(`SELECT ${ENTRY_SELECT} FROM entries WHERE plan_id = ? ORDER BY sort_order, name`)
      .all(planId);
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
    .all(planId, year, month);
}
