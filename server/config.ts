import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { config as loadEnv } from '@dotenvx/dotenvx';

function resolveEnvFilePath(projectRoot: string): string | null {
  const normalizedNodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();

  if (normalizedNodeEnv === 'test') {
    const testPath = path.join(projectRoot, '.env.test');
    return fs.existsSync(testPath) ? testPath : null;
  }

  const envFileByMode: Record<string, string> = {
    production: '.env.production',
    development: '.env.development',
  };
  const prioritizedFiles = [
    envFileByMode[normalizedNodeEnv],
    '.env.production',
    '.env.development',
  ].filter((value, index, values): value is string => {
    return typeof value === 'string' && values.indexOf(value) === index;
  });

  for (const fileName of prioritizedFiles) {
    const candidatePath = path.join(projectRoot, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

function assertNotEncrypted(name: string, value: string): void {
  if (value.startsWith('encrypted:')) {
    throw new Error(
      `[FATAL] ${name} is still encrypted. Ensure .env.keys / DOTENV_PRIVATE_KEY_* is available.`,
    );
  }
}

const cwdRoot = process.cwd();
const envKeysPath = path.join(cwdRoot, '.env.keys');
if (fs.existsSync(envKeysPath)) {
  try {
    loadEnv({ path: envKeysPath, quiet: true });
  } catch (error) {
    console.error(`[Config] Failed to load environment keys from "${envKeysPath}".`, error);
    throw error;
  }
}

const envPath = resolveEnvFilePath(cwdRoot);
if (envPath) {
  try {
    loadEnv({ path: envPath, quiet: true, overload: true });
  } catch (error) {
    console.error(`[Config] Failed to load environment via loadEnv from "${envPath}".`, error);
    throw error;
  }
}

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

const _shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);
export const SHUTDOWN_TIMEOUT_MS =
  Number.isFinite(_shutdownTimeoutMs) && _shutdownTimeoutMs > 0 ? _shutdownTimeoutMs : 10_000;

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

const clerkPublishable =
  process.env.CLERK_PUBLISHABLE_KEY?.trim() || process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() || '';
const clerkSecret = process.env.CLERK_SECRET_KEY?.trim() || '';

if (NODE_ENV === 'production') {
  assertNotEncrypted('CLERK_PUBLISHABLE_KEY', clerkPublishable);
  assertNotEncrypted('CLERK_SECRET_KEY', clerkSecret);
  assertNotEncrypted('SESSION_SECRET', SESSION_SECRET);
}

export const CLERK_PUBLISHABLE_KEY = clerkPublishable;
export const CLERK_SECRET_KEY = clerkSecret;
export const CLERK_CONFIGURED = Boolean(CLERK_PUBLISHABLE_KEY && CLERK_SECRET_KEY);

export const LEGAL_PAGE_URL =
  process.env.LEGAL_PAGE_URL?.trim() ||
  process.env.VITE_LEGAL_PAGE_URL?.trim() ||
  'https://darkavianlabs.com/legal/';

export function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(path.resolve(SESSION_DB_PATH)), { recursive: true });
  fs.mkdirSync(path.dirname(path.resolve(APP_DB_PATH)), { recursive: true });
}
