import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { createSessionSchema } from './sessionSchema.js';

describe('createSessionSchema', () => {
  it('creates the sessions table', () => {
    const db = new Database(':memory:');
    createSessionSchema(db);

    const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'").get() as
      | { name: string }
      | undefined;

    expect(table?.name).toBe('sessions');
    db.close();
  });
});
