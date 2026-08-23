import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { createAppSchema } from './appSchema.js';

describe('createAppSchema', () => {
  it('adds archived_at to an existing entries table', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        clerk_user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        locale TEXT NOT NULL DEFAULT 'en',
        default_plan_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE entries (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        account_id TEXT,
        name TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        kind TEXT NOT NULL,
        frequency TEXT NOT NULL,
        due_day INTEGER NOT NULL,
        due_month INTEGER,
        due_year INTEGER,
        comment TEXT,
        end_date TEXT,
        final_amount_cents INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    expect(() => createAppSchema(db)).not.toThrow();
    const cols = db.prepare(`PRAGMA table_info(entries)`).all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === 'archived_at')).toBe(true);
    db.close();
  });
});
