import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAppSchema } from '../db/appSchema.js';
import { getUserByClerkId, getUserById, updateUserPreferences, upsertUserFromClerk } from './users.js';

describe('upsertUserFromClerk', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createAppSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('updates email on clerk_user_id conflict without creating a second row', () => {
    const first = upsertUserFromClerk('clerk_1', 'one@example.com', db);
    const second = upsertUserFromClerk('clerk_1', 'two@example.com', db);

    const rows = db.prepare(`SELECT id, email FROM users`).all() as Array<{
      id: string;
      email: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.email).toBe('two@example.com');
  });

  it('finds an existing user by clerk id', () => {
    const created = upsertUserFromClerk('clerk_1', 'one@example.com', db);
    const found = getUserByClerkId('clerk_1', db);
    expect(found?.id).toBe(created.id);
    expect(found?.email).toBe('one@example.com');
    expect(getUserByClerkId('missing', db)).toBeNull();
  });

  it('stores locale per user', () => {
    const owner = upsertUserFromClerk('clerk_owner', 'owner@example.com', db);
    const member = upsertUserFromClerk('clerk_member', 'member@example.com', db);

    updateUserPreferences(owner.id, { locale: 'de' }, db);
    updateUserPreferences(member.id, { locale: 'en' }, db);

    expect(getUserById(owner.id, db)?.locale).toBe('de');
    expect(getUserById(member.id, db)?.locale).toBe('en');
  });
});
