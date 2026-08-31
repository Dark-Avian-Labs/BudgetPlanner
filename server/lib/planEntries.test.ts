import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAppSchema } from '../db/appSchema.js';
import { listPlanEntries, syncOnceArchiveState } from './planEntries.js';

function seedPlan(db: Database.Database): void {
  db.exec(`
    INSERT INTO users (id, clerk_user_id, email) VALUES ('u1', 'c1', 'a@b.c');
    INSERT INTO plans (id, name, owner_user_id) VALUES ('p1', 'Home', 'u1');
    INSERT INTO categories (id, plan_id, name, sort_order) VALUES ('cat1', 'p1', 'Bills', 0);
  `);
}

function insertEntry(
  db: Database.Database,
  row: {
    id: string;
    name: string;
    frequency: string;
    due_month: number | null;
    due_year: number | null;
    archived_at?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO entries (
      id, plan_id, category_id, name, amount_cents, kind, frequency,
      due_day, due_month, due_year, archived_at, sort_order
    ) VALUES (?, 'p1', 'cat1', ?, 1000, 'expense', ?, 1, ?, ?, ?, 0)`,
  ).run(row.id, row.name, row.frequency, row.due_month, row.due_year, row.archived_at ?? null);
}

describe('syncOnceArchiveState', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createAppSchema(db);
    seedPlan(db);
  });

  afterEach(() => {
    db.close();
  });

  it('archives once entries after their due month and restores future ones', () => {
    insertEntry(db, {
      id: 'past',
      name: 'Old bill',
      frequency: 'once',
      due_month: 7,
      due_year: 2026,
    });
    insertEntry(db, {
      id: 'current',
      name: 'This month',
      frequency: 'once',
      due_month: 8,
      due_year: 2026,
    });
    insertEntry(db, {
      id: 'future-archived',
      name: 'Moved up',
      frequency: 'once',
      due_month: 9,
      due_year: 2026,
      archived_at: '2026-08-01 00:00:00',
    });
    insertEntry(db, {
      id: 'rent',
      name: 'Rent',
      frequency: 'monthly',
      due_month: null,
      due_year: null,
    });

    syncOnceArchiveState(db, 'p1', 2026, 8);

    const rows = db.prepare(`SELECT id, archived_at FROM entries ORDER BY id`).all() as Array<{
      id: string;
      archived_at: string | null;
    }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.archived_at]));

    expect(byId.past).not.toBeNull();
    expect(byId.current).toBeNull();
    expect(byId['future-archived']).toBeNull();
    expect(byId.rent).toBeNull();
  });
});

describe('listPlanEntries', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createAppSchema(db);
    seedPlan(db);
    insertEntry(db, {
      id: 'rent',
      name: 'Rent',
      frequency: 'monthly',
      due_month: null,
      due_year: null,
    });
    insertEntry(db, {
      id: 'july-once',
      name: 'July fee',
      frequency: 'once',
      due_month: 7,
      due_year: 2026,
      archived_at: '2026-08-01 00:00:00',
    });
    insertEntry(db, {
      id: 'june-once',
      name: 'June fee',
      frequency: 'once',
      due_month: 6,
      due_year: 2026,
      archived_at: '2026-07-01 00:00:00',
    });
  });

  afterEach(() => {
    db.close();
  });

  it('includes archived once entries only for the requested month', () => {
    const july = listPlanEntries(db, 'p1', 2026, 7) as Array<{ id: string }>;
    expect(july.map((e) => e.id).sort()).toEqual(['july-once', 'rent']);

    const august = listPlanEntries(db, 'p1', 2026, 8) as Array<{ id: string }>;
    expect(august.map((e) => e.id)).toEqual(['rent']);
  });

  it('returns every archived row when includeAllArchived is set', () => {
    const all = listPlanEntries(db, 'p1', 2026, 8, true) as Array<{ id: string }>;
    expect(all.map((e) => e.id).sort()).toEqual(['july-once', 'june-once', 'rent']);
  });
});
