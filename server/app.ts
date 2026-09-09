import fs from 'fs';
import path from 'path';

import { getAuth } from '@clerk/express';
import type Database from 'better-sqlite3';
import cookieParser from 'cookie-parser';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';

import { clerkMiddleware } from './auth/middleware.js';
import {
  APP_NAME,
  APP_VERSION,
  CLERK_CONFIGURED,
  COOKIE_DOMAIN,
  LEGAL_PAGE_URL,
  NODE_ENV,
  PROJECT_ROOT,
  SECURE_COOKIES,
  SESSION_COOKIE_NAME,
  SESSION_SECRET,
  TRUST_PROXY,
  ensureDataDirs,
} from './config.js';
import { createAppSchema } from './db/appSchema.js';
import { getAppDb, getSessionDb } from './db/connection.js';
import { createSessionSchema } from './db/sessionSchema.js';
import { SqliteSessionStore } from './db/sqliteSessionStore.js';
import { errorHandler } from './http/errorHandler.js';
import { createAppHelmet } from './http/helmetCsp.js';
import { apiRouter } from './routes/api.js';
import { bindClerkUserSessionMiddleware } from './session/bindClerkUserSession.js';

export interface AppBundle {
  app: express.Express;
  sessionDb: Database.Database;
  appDb: Database.Database;
  sessionStore: SqliteSessionStore;
}

export interface CreateAppOptions {
  sessionDb?: Database.Database;
  appDb?: Database.Database;
  sessionCleanupIntervalMs?: number;
}

export function createApp(options: CreateAppOptions = {}): AppBundle {
  ensureDataDirs();

  const sessionDb = options.sessionDb ?? getSessionDb();
  const appDb = options.appDb ?? getAppDb();
  createSessionSchema(sessionDb);
  createAppSchema(appDb);

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

  app.use(clerkMiddleware());
  if (CLERK_CONFIGURED) {
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
      req.path === '/favicon.png' ||
      /^\/assets\/.+\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(req.path),
  });
  app.use(baselineLimiter);

  const sessionStore = new SqliteSessionStore({
    db: sessionDb,
    cleanupIntervalMs:
      options.sessionCleanupIntervalMs ?? (NODE_ENV === 'test' ? 0 : 15 * 60 * 1000),
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
  app.use(
    '/api',
    bindClerkUserSessionMiddleware(
      (req) => {
        if (!CLERK_CONFIGURED) return null;
        return getAuth(req).userId ?? null;
      },
      (req) => {
        const generate = req.app.locals.generateCsrfToken as
          | ((request: express.Request, overwrite?: boolean) => string)
          | undefined;
        generate?.(req, true);
      },
    ),
  );

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

  const faviconPng = path.join(PROJECT_ROOT, 'favicon.png');
  app.get('/favicon.png', publicPageLimiter, (_req, res) => {
    res.sendFile(faviconPng);
  });
  app.get('/favicon.ico', publicPageLimiter, (_req, res) => {
    res.sendFile(faviconPng);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const clientDir = path.join(PROJECT_ROOT, 'dist', 'client');
  const clientIndexPath = path.join(clientDir, 'index.html');

  function sendLegalRedirect(res: express.Response): void {
    res.redirect(LEGAL_PAGE_URL);
  }

  function sendSpaIndex(res: express.Response): boolean {
    if (!fs.existsSync(clientIndexPath)) {
      return false;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(clientIndexPath);
    return true;
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
    if (!sendSpaIndex(res)) {
      res.status(503).json({ error: 'Client build missing. Run `pnpm run build` first.' });
    }
  });

  app.use(errorHandler);

  return { app, sessionDb, appDb, sessionStore };
}
