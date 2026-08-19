import type Database from 'better-sqlite3';

import { ACCOUNT_COLORS } from '../lib/accountColors.js';

export type MemberRole = 'owner' | 'editor' | 'viewer';
export type EntryKind = 'expense' | 'income' | 'credit';
export type EntryFrequency = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'once';

const ENTRIES_DDL = `
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'credit')),
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'halfyearly', 'yearly', 'once')),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  due_month INTEGER CHECK (due_month IS NULL OR (due_month >= 1 AND due_month <= 12)),
  due_year INTEGER CHECK (due_year IS NULL OR (due_year >= 2000 AND due_year <= 2100)),
  comment TEXT,
  end_date TEXT,
  final_amount_cents INTEGER CHECK (final_amount_cents IS NULL OR final_amount_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
`;

export function createAppSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      clerk_user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      default_plan_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan_members (
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (plan_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS plan_invites (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
      token TEXT NOT NULL UNIQUE,
      invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_plan_invites_token ON plan_invites(token);
    CREATE INDEX IF NOT EXISTS idx_plan_invites_email ON plan_invites(email);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_categories_plan ON categories(plan_id, sort_order);

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'sky',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_plan ON accounts(plan_id, sort_order);

    CREATE TABLE IF NOT EXISTS entries (
      ${ENTRIES_DDL}
    );

    CREATE INDEX IF NOT EXISTS idx_entries_plan ON entries(plan_id, category_id, sort_order);
  `);

  migrateEntriesHalfyearlyFrequency(db);
  migrateAccountsColor(db);
  migrateEntriesOnceFrequency(db);
}

function migrateAccountsColor(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(accounts)`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === 'color')) return;

  db.exec(`ALTER TABLE accounts ADD COLUMN color TEXT NOT NULL DEFAULT 'sky'`);

  const accounts = db
    .prepare(`SELECT id, plan_id FROM accounts ORDER BY plan_id, sort_order, name`)
    .all() as Array<{ id: string; plan_id: string }>;

  const update = db.prepare(`UPDATE accounts SET color = ? WHERE id = ?`);
  const counts = new Map<string, number>();
  const tx = db.transaction(() => {
    for (const account of accounts) {
      const index = counts.get(account.plan_id) ?? 0;
      counts.set(account.plan_id, index + 1);
      const color = ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]!;
      update.run(color, account.id);
    }
  });
  tx();
}

function migrateEntriesHalfyearlyFrequency(db: Database.Database): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entries'`)
    .get() as { sql: string } | undefined;
  if (!row?.sql || row.sql.includes("'halfyearly'") || row.sql.includes("'once'")) return;

  rebuildEntriesTable(db, /* includeOnce */ false);
}

function migrateEntriesOnceFrequency(db: Database.Database): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entries'`)
    .get() as { sql: string } | undefined;
  if (!row?.sql) return;

  const cols = db.prepare(`PRAGMA table_info(entries)`).all() as Array<{ name: string }>;
  const hasDueYear = cols.some((c) => c.name === 'due_year');
  const hasOnce = row.sql.includes("'once'");

  if (hasOnce && hasDueYear) return;

  if (!hasOnce) {
    rebuildEntriesTable(db, /* includeOnce */ true);
    return;
  }

  if (!hasDueYear) {
    db.exec(
      `ALTER TABLE entries ADD COLUMN due_year INTEGER CHECK (due_year IS NULL OR (due_year >= 2000 AND due_year <= 2100))`,
    );
  }
}

function rebuildEntriesTable(db: Database.Database, includeOnce: boolean): void {
  const frequencyCheck = includeOnce
    ? `('monthly', 'quarterly', 'halfyearly', 'yearly', 'once')`
    : `('monthly', 'quarterly', 'halfyearly', 'yearly')`;
  const dueYearCol = includeOnce
    ? `due_year INTEGER CHECK (due_year IS NULL OR (due_year >= 2000 AND due_year <= 2100)),`
    : '';
  const dueYearSelect = includeOnce ? 'NULL AS due_year,' : '';
  const dueYearInsert = includeOnce ? 'due_year,' : '';

  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE entries_new (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'credit')),
        frequency TEXT NOT NULL CHECK (frequency IN ${frequencyCheck}),
        due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
        due_month INTEGER CHECK (due_month IS NULL OR (due_month >= 1 AND due_month <= 12)),
        ${dueYearCol}
        comment TEXT,
        end_date TEXT,
        final_amount_cents INTEGER CHECK (final_amount_cents IS NULL OR final_amount_cents >= 0),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO entries_new (
        id, plan_id, category_id, account_id, name, amount_cents, kind, frequency,
        due_day, due_month, ${dueYearInsert} comment, end_date, final_amount_cents, sort_order,
        created_at, updated_at
      )
      SELECT
        id, plan_id, category_id, account_id, name, amount_cents, kind, frequency,
        due_day, due_month, ${dueYearSelect} comment, end_date, final_amount_cents, sort_order,
        created_at, updated_at
      FROM entries;

      DROP TABLE entries;
      ALTER TABLE entries_new RENAME TO entries;
      CREATE INDEX IF NOT EXISTS idx_entries_plan ON entries(plan_id, category_id, sort_order);
    `);
  });
  tx();
  db.pragma('foreign_keys = ON');
}
