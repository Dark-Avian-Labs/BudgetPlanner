import Database from 'better-sqlite3';

import { APP_DB_PATH, SESSION_DB_PATH } from '../config.js';

let sessionDb: Database.Database | null = null;
let appDb: Database.Database | null = null;

function openDb(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function getSessionDb(): Database.Database {
  if (!sessionDb) {
    sessionDb = openDb(SESSION_DB_PATH);
  }
  return sessionDb;
}

export function getAppDb(): Database.Database {
  if (!appDb) {
    appDb = openDb(APP_DB_PATH);
  }
  return appDb;
}

export function closeSessionDb(): void {
  if (sessionDb) {
    sessionDb.close();
    sessionDb = null;
  }
}

export function closeAppDb(): void {
  if (appDb) {
    appDb.close();
    appDb = null;
  }
}
