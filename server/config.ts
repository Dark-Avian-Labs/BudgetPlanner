import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parentName = path.basename(path.resolve(__dirname, '..'));
export const PROJECT_ROOT = path.resolve(__dirname, parentName === 'dist' ? '../..' : '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const SESSION_DB_PATH =
  process.env.SESSION_DB_PATH || process.env.CENTRAL_DB_PATH || path.join(DATA_DIR, 'sessions.db');
export const APP_DB_PATH = process.env.APP_DB_PATH || path.join(DATA_DIR, 'app.db');

const _port = parseInt(process.env.PORT || '3001', 10);
export const PORT = Number.isFinite(_port) && _port > 0 ? _port : 3001;
export const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_SESSION_SECRET = 'budgetplanner-dev-secret-change-me';
export const SESSION_SECRET = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
export const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production' && SESSION_SECRET === DEFAULT_SESSION_SECRET) {
  console.error(
    '[FATAL] SESSION_SECRET must be set in production. Refusing to start with the default secret.',
  );
  process.exit(1);
}

export const APP_NAME = process.env.APP_NAME?.trim() || 'BudgetPlanner';
export const APP_ID = process.env.APP_ID?.trim() || 'budgetplanner';

export const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
export const SECURE_COOKIES =
  process.env.SECURE_COOKIES === '1' || process.env.SECURE_COOKIES === 'true';
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME?.trim() || `${APP_ID}.sid`;

export const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY?.trim() || '';
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY?.trim() || '';
export const CLERK_CONFIGURED = Boolean(CLERK_PUBLISHABLE_KEY && CLERK_SECRET_KEY);

export const LEGAL_PAGE_URL =
  process.env.LEGAL_PAGE_URL?.trim() ||
  process.env.VITE_LEGAL_PAGE_URL?.trim() ||
  'https://darkavianlabs.com/legal/';

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
