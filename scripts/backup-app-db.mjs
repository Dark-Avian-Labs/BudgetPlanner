import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const sourcePath = path.resolve(
  process.env.APP_DB_PATH || path.join(process.cwd(), 'data', 'app.db'),
);

if (!fs.existsSync(sourcePath)) {
  console.error(`APP_DB_PATH not found: ${sourcePath}`);
  process.exit(1);
}

const backupDir = path.join(path.dirname(sourcePath), 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destPath = path.join(backupDir, `app-${stamp}.db`);
const destSql = destPath.replaceAll('\\', '/').replaceAll("'", "''");

const db = new Database(sourcePath, { readonly: true, fileMustExist: true });
try {
  db.exec(`VACUUM INTO '${destSql}'`);
} finally {
  db.close();
}

console.log(`Wrote ${destPath}`);
