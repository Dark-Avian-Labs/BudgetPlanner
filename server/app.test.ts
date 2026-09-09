import Database from 'better-sqlite3';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AppBundle } from './app.js';
import { createApp } from './app.js';
import { APP_NAME, APP_VERSION, SESSION_COOKIE_NAME } from './config.js';

let bundle: AppBundle | undefined;
let sessionDb: Database.Database | undefined;
let appDb: Database.Database | undefined;

beforeAll(() => {
  sessionDb = new Database(':memory:');
  sessionDb.pragma('foreign_keys = ON');
  appDb = new Database(':memory:');
  appDb.pragma('foreign_keys = ON');
  bundle = createApp({ sessionDb, appDb, sessionCleanupIntervalMs: 0 });
});

afterAll(() => {
  bundle?.sessionStore.dispose();
  sessionDb?.close();
  appDb?.close();
});

describe('health endpoints', () => {
  it('GET /healthz responds ok without creating a session cookie', async () => {
    const res = await request(bundle!.app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', app: APP_NAME });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('GET /readyz probes session and app DBs', async () => {
    const res = await request(bundle!.app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', app: APP_NAME });
  });

  it('GET /readyz returns 503 when a database probe fails', async () => {
    const downAppDb = new Database(':memory:');
    const down = createApp({
      sessionDb: new Database(':memory:'),
      appDb: downAppDb,
      sessionCleanupIntervalMs: 0,
    });
    downAppDb.close();
    const res = await request(down.app).get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready', app: APP_NAME });
    down.sessionStore.dispose();
    down.sessionDb.close();
  });

  it('GET /api/health responds ok', async () => {
    const res = await request(bundle!.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', app: APP_NAME });
  });

  it('GET /api/version returns the package version', async () => {
    const res = await request(bundle!.app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(APP_VERSION);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('security headers', () => {
  it('sets helmet headers including a CSP with Clerk origins', async () => {
    const res = await request(bundle!.app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).toContain('https://challenges.cloudflare.com');
    expect(res.headers['content-security-policy']).toContain('https://*.protect.clerk.com');
  });

  it('emits rate limit headers on API routes', async () => {
    const res = await request(bundle!.app).get('/api/health');
    const hasRateLimitHeader = Boolean(res.headers['ratelimit'] ?? res.headers['ratelimit-limit']);
    expect(hasRateLimitHeader).toBe(true);
  });
});

describe('CSRF protection', () => {
  it('GET /api/csrf issues a token and a session cookie', async () => {
    const res = await request(bundle!.app).get('/api/csrf');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toContain(SESSION_COOKIE_NAME);
    expect(res.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('rejects state-changing requests without a token', async () => {
    const res = await request(bundle!.app).post('/api/plans').send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
    expect(res.headers['x-csrf-error']).toBe('1');
  });

  it('accepts state-changing requests with a valid token', async () => {
    const agent = request.agent(bundle!.app);
    const csrfRes = await agent.get('/api/csrf');
    const token = csrfRes.body.csrfToken as string;

    const res = await agent.post('/api/nope').set('X-CSRF-Token', token).send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('auth endpoints (Clerk not configured in tests)', () => {
  it('GET /api/me responds 503 when Clerk is off', async () => {
    const res = await request(bundle!.app).get('/api/me');
    expect(res.status).toBe(503);
  });
});

describe('API 404 handling', () => {
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(bundle!.app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
