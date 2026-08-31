import path from 'path';

import { clerkMiddleware } from '@clerk/express';
import cookieParser from 'cookie-parser';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';

import {
  PORT,
  HOST,
  SESSION_SECRET,
  NODE_ENV,
  SESSION_DB_PATH,
  APP_DB_PATH,
  TRUST_PROXY,
  SECURE_COOKIES,
  COOKIE_DOMAIN,
  APP_NAME,
  APP_VERSION,
  PROJECT_ROOT,
  SESSION_COOKIE_NAME,
  CLERK_CONFIGURED,
  LEGAL_PAGE_URL,
  SHUTDOWN_TIMEOUT_MS,
  ensureDataDirs,
} from './config.js';
import { createAppSchema } from './db/appSchema.js';
import { closeAppDb, closeSessionDb, getAppDb, getSessionDb } from './db/connection.js';
import { createSessionSchema } from './db/sessionSchema.js';
import { SqliteSessionStore } from './db/sqliteSessionStore.js';
import { createAppHelmet } from './http/helmetCsp.js';
import { apiRouter } from './routes/api.js';

ensureDataDirs();

const sessionDb = getSessionDb();
createSessionSchema(sessionDb);
console.log(`[${APP_NAME}] Session store ready (${SESSION_DB_PATH})`);

const appDb = getAppDb();
createAppSchema(appDb);
console.log(`[${APP_NAME}] App database ready (${APP_DB_PATH})`);

const app = express();

if (TRUST_PROXY) app.set('trust proxy', 1);
if (NODE_ENV === 'production' && SECURE_COOKIES && !TRUST_PROXY) {
  throw new Error('TRUST_PROXY must be enabled in production when SECURE_COOKIES is enabled.');
}

app.use(createAppHelmet({ hsts: NODE_ENV === 'production' }));

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', app: APP_NAME });
});

app.get('/readyz', (_req, res) => {
  try {
    sessionDb.prepare('SELECT 1').get();
    appDb.prepare('SELECT 1').get();
    res.json({ status: 'ready', app: APP_NAME });
  } catch {
    res.status(503).json({ status: 'not_ready', app: APP_NAME });
  }
});

if (CLERK_CONFIGURED) {
  app.use(clerkMiddleware());
  console.log(`[${APP_NAME}] Clerk auth enabled`);
} else {
  console.warn(`[${APP_NAME}] Clerk keys missing — auth routes will return 503`);
}

const baselineLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === '/healthz' ||
    req.path === '/readyz' ||
    req.path === '/api/version' ||
    req.path === '/favicon.ico' ||
    /^\/assets\/.+\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(req.path),
});
app.use(baselineLimiter);

const sessionStore = new SqliteSessionStore({
  db: sessionDb,
  cleanupIntervalMs: 15 * 60 * 1000,
});

const cookieOptions: express.CookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: SECURE_COOKIES,
  sameSite: 'lax',
};
if (COOKIE_DOMAIN) cookieOptions.domain = COOKIE_DOMAIN;

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: cookieOptions,
  }),
);

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req: express.Request) => {
    if (req.body?._csrf) return req.body._csrf as string;
    const header = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    return (Array.isArray(header) ? header[0] : header) ?? null;
  },
  getTokenFromState: (req) => {
    const s = req.session;
    if (!s) return null;
    return (s as { csrfToken?: string }).csrfToken ?? null;
  },
  storeTokenInState: (req, token) => {
    if (req.session) {
      req.session.csrfToken = token as string;
    }
  },
});

app.use(csrfSynchronisedProtection);
app.locals.generateCsrfToken = generateToken;

const appApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});

const staticAssetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ version: APP_VERSION });
});

app.use('/api', appApiLimiter, apiRouter);

app.get('/favicon.ico', publicPageLimiter, (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'favicon.ico'));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const clientDir = path.join(PROJECT_ROOT, 'dist', 'client');
const clientIndexPath = path.join(clientDir, 'index.html');

function sendLegalRedirect(res: express.Response): void {
  res.redirect(LEGAL_PAGE_URL);
}

function sendSpaIndex(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(clientIndexPath);
}

app.get('/legal', publicPageLimiter, (_req, res) => {
  sendLegalRedirect(res);
});

app.use(
  '/assets',
  staticAssetLimiter,
  express.static(path.join(clientDir, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }),
);
app.use(
  publicPageLimiter,
  express.static(clientDir, {
    index: false,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);
app.use(publicPageLimiter, (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  sendSpaIndex(res);
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err.message || '';
  const lowerMessage = message.toLowerCase();
  const errorCode = (err as { code?: string }).code;
  const statusCode =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { status?: number; statusCode?: number }).statusCode;
  const isNamedCsrfError =
    err.name === 'CsrfError' || (err.constructor && err.constructor.name === 'CsrfError');
  const isForbiddenError =
    err.name === 'ForbiddenError' || (err.constructor && err.constructor.name === 'ForbiddenError');
  const isCsrfError =
    isNamedCsrfError ||
    errorCode === 'EBADCSRFTOKEN' ||
    (isForbiddenError && lowerMessage.includes('csrf'));
  if (isCsrfError) {
    res.setHeader('X-CSRF-Error', '1');
    res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
    return;
  }
  const status =
    typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  console.error('[Error]', err.stack ?? err.message);
  if (status >= 500) {
    res.status(status).json({ error: 'Internal server error' });
    return;
  }
  res.status(status).json({ error: message || 'Request failed' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[${APP_NAME}] Server running on http://${HOST}:${PORT} (${NODE_ENV})`);
});

function shutdown(baseExitCode = 0): void {
  let done = false;
  function closeAndExit(exitCode: number): void {
    if (done) return;
    done = true;
    sessionStore.dispose();
    try {
      closeSessionDb();
    } catch (err) {
      console.error('[Shutdown] Failed to close session DB:', err);
      exitCode = 1;
    }
    try {
      closeAppDb();
    } catch (err) {
      console.error('[Shutdown] Failed to close app DB:', err);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
  const timeout = setTimeout(() => closeAndExit(1), SHUTDOWN_TIMEOUT_MS);
  server.close((err) => {
    clearTimeout(timeout);
    if (err) {
      console.error('[Shutdown] HTTP server close failed:', err);
      closeAndExit(1);
      return;
    }
    closeAndExit(baseExitCode);
  });
  server.closeIdleConnections();
  setTimeout(
    () => {
      server.closeAllConnections();
    },
    Math.max(0, SHUTDOWN_TIMEOUT_MS - 500),
  );
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.on('unhandledRejection', (reason) => {
  console.error(
    '[Crash] Unhandled promise rejection; shutting down',
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  );
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  console.error('[Crash] Uncaught exception; shutting down', err.stack ?? err.message);
  shutdown(1);
});

export default app;
