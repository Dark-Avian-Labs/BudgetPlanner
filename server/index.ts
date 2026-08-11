import { createRequire } from 'module';
import path from 'path';

import { clerkMiddleware } from '@clerk/express';
import cookieParser from 'cookie-parser';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';

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
  PROJECT_ROOT,
  SESSION_COOKIE_NAME,
  CLERK_CONFIGURED,
  LEGAL_PAGE_URL,
  ensureDataDirs,
} from './config.js';
import { createAppSchema } from './db/appSchema.js';
import { closeAppDb, getAppDb, getSessionDb } from './db/connection.js';
import { createSessionSchema } from './db/sessionSchema.js';
import { createAppHelmet } from './http/helmetCsp.js';
import { apiRouter } from './routes/api.js';

const require = createRequire(import.meta.url);
const SQLiteStore = require('better-sqlite3-session-store')(session);

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

app.use(
  SECURE_COOKIES
    ? createAppHelmet()
    : helmet({
        // Plain HTTP LAN / local: avoid HTTPS upgrades and CSP that blocks Clerk.
        hsts: false,
        contentSecurityPolicy: false,
      }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
    req.path === '/favicon.ico' ||
    /^\/assets\/.+\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(req.path),
});
app.use(baselineLimiter);

const sessionStore = new SQLiteStore({
  client: sessionDb,
  expired: { clear: true, intervalMs: 15 * 60 * 1000 },
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

app.use((req, res, next) => {
  (res.locals as { csrfToken?: string }).csrfToken = generateToken(req);
  next();
});

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

app.use('/api', appApiLimiter, apiRouter);

app.get('/favicon.ico', publicPageLimiter, (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'favicon.ico'));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

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

const clientDir = path.join(PROJECT_ROOT, 'dist', 'client');
const clientIndexPath = path.join(clientDir, 'index.html');

function sendLegalRedirect(res: express.Response): void {
  res.redirect(LEGAL_PAGE_URL);
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
app.use(publicPageLimiter, express.static(clientDir, { maxAge: '1h' }));
app.use(publicPageLimiter, (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  res.sendFile(clientIndexPath);
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.stack ?? err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[${APP_NAME}] Server running on http://${HOST}:${PORT} (${NODE_ENV})`);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;
function shutdown(): void {
  let done = false;
  function closeAndExit(): void {
    if (done) return;
    done = true;
    try {
      sessionDb.close();
    } catch (err) {
      console.error('[Shutdown] Failed to close session DB:', err);
    }
    try {
      closeAppDb();
    } catch (err) {
      console.error('[Shutdown] Failed to close app DB:', err);
    }
    process.exit(0);
  }
  const timeout = setTimeout(() => closeAndExit(), SHUTDOWN_TIMEOUT_MS);
  server.close(() => {
    clearTimeout(timeout);
    closeAndExit();
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
