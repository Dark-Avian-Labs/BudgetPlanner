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

  it('collapses duplicate pending invites then enforces uniqueness', () => {
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
      CREATE TABLE plan_invites (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users (id, clerk_user_id, email) VALUES ('u1', 'c1', 'a@b.c');
      INSERT INTO plans (id, name, owner_user_id) VALUES ('p1', 'Home', 'u1');
      INSERT INTO plan_invites (id, plan_id, email, role, token, invited_by, expires_at)
        VALUES ('i1', 'p1', 'x@y.z', 'viewer', 'tok1', 'u1', '2099-01-01');
      INSERT INTO plan_invites (id, plan_id, email, role, token, invited_by, expires_at)
        VALUES ('i2', 'p1', 'x@y.z', 'editor', 'tok2', 'u1', '2099-01-01');
    `);

    createAppSchema(db);

    const pending = db.prepare(`SELECT id FROM plan_invites WHERE accepted_at IS NULL`).all() as Array<{ id: string }>;
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('i2');

    expect(() => {
      db.prepare(
        `INSERT INTO plan_invites (id, plan_id, email, role, token, invited_by, expires_at)
         VALUES ('i3', 'p1', 'x@y.z', 'viewer', 'tok3', 'u1', '2099-01-01')`,
      ).run();
    }).toThrow();
    db.close();
  });

  it('lowercases mixed-case pending invites before uniqueness', () => {
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
      CREATE TABLE plan_invites (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users (id, clerk_user_id, email) VALUES ('u1', 'c1', 'a@b.c');
      INSERT INTO plans (id, name, owner_user_id) VALUES ('p1', 'Home', 'u1');
      INSERT INTO plan_invites (id, plan_id, email, role, token, invited_by, expires_at)
        VALUES ('i1', 'p1', 'X@Y.Z', 'viewer', 'tok1', 'u1', '2099-01-01');
      INSERT INTO plan_invites (id, plan_id, email, role, token, invited_by, expires_at)
        VALUES ('i2', 'p1', 'x@y.z', 'editor', 'tok2', 'u1', '2099-01-01');
    `);

    createAppSchema(db);

    const pending = db.prepare(`SELECT id, email FROM plan_invites WHERE accepted_at IS NULL`).all() as Array<{
      id: string;
      email: string;
    }>;
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('i2');
    expect(pending[0]?.email).toBe('x@y.z');
    db.close();
  });

  it('remaps legacy account colors onto the rarity ladder', () => {
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
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT 'sky',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users (id, clerk_user_id, email) VALUES ('u1', 'c1', 'a@b.c');
      INSERT INTO plans (id, name, owner_user_id) VALUES ('p1', 'Home', 'u1');
      INSERT INTO accounts (id, plan_id, name, color, sort_order) VALUES
        ('a1', 'p1', 'Rose', 'rose', 0),
        ('a2', 'p1', 'Sky', 'sky', 1),
        ('a3', 'p1', 'Indigo', 'indigo', 2),
        ('a4', 'p1', 'Violet', 'violet', 3),
        ('a5', 'p1', 'Orange', 'orange', 4);
    `);

    createAppSchema(db);

    const rows = db.prepare(`SELECT id, color FROM accounts ORDER BY sort_order`).all() as Array<{
      id: string;
      color: string;
    }>;
    expect(rows).toEqual([
      { id: 'a1', color: 'red' },
      { id: 'a2', color: 'blue' },
      { id: 'a3', color: 'blue' },
      { id: 'a4', color: 'purple' },
      { id: 'a5', color: 'orange' },
    ]);
    db.close();
  });
});
