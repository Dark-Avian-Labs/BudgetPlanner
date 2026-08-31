import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import Database from 'better-sqlite3';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppSchema } from '../db/appSchema.js';
import type { AppUser } from '../services/users.js';

const authState = vi.hoisted(() => ({
  user: null as AppUser | null,
}));

const dbState = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('../db/connection.js', () => ({
  getAppDb: () => {
    if (!dbState.db) throw new Error('test database is not open');
    return dbState.db;
  },
}));

vi.mock('../middleware/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth.js')>('../middleware/auth.js');
  return {
    ...actual,
    requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
      if (!authState.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      req.appUser = authState.user;
      next();
    },
  };
});

const { invitesRouter, plansRouter } = await import('./plans.js');
const { createPlanForOwner } = await import('../services/users.js');

function insertUser(id: string, clerkUserId: string, email: string): AppUser {
  const db = dbState.db!;
  db.prepare(`INSERT INTO users (id, clerk_user_id, email) VALUES (?, ?, ?)`).run(id, clerkUserId, email);
  return {
    id,
    clerk_user_id: clerkUserId,
    email,
    locale: 'en',
    default_plan_id: null,
  };
}

function addMember(planId: string, userId: string, role: 'editor' | 'viewer'): void {
  dbState.db!.prepare(`INSERT INTO plan_members (plan_id, user_id, role) VALUES (?, ?, ?)`).run(planId, userId, role);
}

function firstCategoryId(planId: string): string {
  const row = dbState
    .db!.prepare(`SELECT id FROM categories WHERE plan_id = ? ORDER BY sort_order LIMIT 1`)
    .get(planId) as { id: string };
  return row.id;
}

function monthlyEntry(categoryId: string, name = 'Rent') {
  return {
    name,
    amount_cents: 1000,
    kind: 'expense',
    frequency: 'monthly',
    due_day: 1,
    category_id: categoryId,
  };
}

async function withServer(run: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api/plans', plansRouter);
  app.use('/api/invites', invitesRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function http(
  base: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? (JSON.parse(text) as unknown) : undefined };
}

describe('plan authorization and invites', () => {
  let owner: AppUser;
  let editor: AppUser;
  let viewer: AppUser;
  let outsider: AppUser;
  let planId: string;
  let otherPlanId: string;

  beforeEach(() => {
    const db = new Database(':memory:');
    createAppSchema(db);
    dbState.db = db;
    owner = insertUser('u-owner', 'clerk-owner', 'owner@example.com');
    editor = insertUser('u-editor', 'clerk-editor', 'editor@example.com');
    viewer = insertUser('u-viewer', 'clerk-viewer', 'viewer@example.com');
    outsider = insertUser('u-out', 'clerk-out', 'out@example.com');
    planId = createPlanForOwner(owner, 'Home');
    otherPlanId = createPlanForOwner(owner, 'Other');
    addMember(planId, editor.id, 'editor');
    addMember(planId, viewer.id, 'viewer');
    authState.user = owner;
  });

  afterEach(() => {
    authState.user = null;
    dbState.db?.close();
    dbState.db = null;
  });

  it('blocks viewers from mutating and outsiders from reading', async () => {
    await withServer(async (base) => {
      authState.user = viewer;
      const categoryId = firstCategoryId(planId);
      const mutate = await http(base, 'POST', `/api/plans/${planId}/entries`, monthlyEntry(categoryId));
      expect(mutate.status).toBe(403);

      const rename = await http(base, 'PATCH', `/api/plans/${planId}`, { name: 'Nope' });
      expect(rename.status).toBe(403);

      const read = await http(base, 'GET', `/api/plans/${planId}`);
      expect(read.status).toBe(200);

      authState.user = outsider;
      const denied = await http(base, 'GET', `/api/plans/${planId}`);
      expect(denied.status).toBe(403);
    });
  });

  it('lets editors write entries but not invite, and rejects cross-plan ids', async () => {
    await withServer(async (base) => {
      authState.user = editor;
      const categoryId = firstCategoryId(planId);
      const created = await http(base, 'POST', `/api/plans/${planId}/entries`, monthlyEntry(categoryId));
      expect(created.status).toBe(201);

      const invite = await http(base, 'POST', `/api/plans/${planId}/invites`, {
        email: 'new@example.com',
        role: 'viewer',
      });
      expect(invite.status).toBe(403);

      const foreignCategory = firstCategoryId(otherPlanId);
      const crossPlan = await http(base, 'POST', `/api/plans/${planId}/entries`, {
        ...monthlyEntry(foreignCategory, 'Leak'),
      });
      expect(crossPlan.status).toBe(400);
      expect(crossPlan.data).toEqual({ error: 'Invalid category' });

      const foreignAccountId = 'acct-other';
      dbState
        .db!.prepare(`INSERT INTO accounts (id, plan_id, name, color, sort_order) VALUES (?, ?, 'Bank', 'sky', 0)`)
        .run(foreignAccountId, otherPlanId);
      const crossAccount = await http(base, 'POST', `/api/plans/${planId}/entries`, {
        ...monthlyEntry(categoryId, 'With account'),
        account_id: foreignAccountId,
      });
      expect(crossAccount.status).toBe(400);
      expect(crossAccount.data).toEqual({ error: 'Invalid account' });
    });
  });

  it('refuses to let the owner leave, and returns structured field errors', async () => {
    await withServer(async (base) => {
      authState.user = owner;
      const leave = await http(base, 'POST', `/api/plans/${planId}/leave`);
      expect(leave.status).toBe(400);

      authState.user = editor;
      const editorLeave = await http(base, 'POST', `/api/plans/${planId}/leave`);
      expect(editorLeave.status).toBe(204);

      authState.user = owner;
      const invalid = await http(base, 'POST', `/api/plans/${planId}/entries`, {
        name: '',
        amount_cents: 1000,
        kind: 'expense',
        frequency: 'monthly',
        due_day: 1,
        category_id: firstCategoryId(planId),
      });
      expect(invalid.status).toBe(400);
      expect(invalid.data).toEqual({ error: 'Invalid fields', fields: ['name'] });
    });
  });

  it('resends a pending invite and enforces accept-email matching', async () => {
    await withServer(async (base) => {
      authState.user = owner;
      const first = await http(base, 'POST', `/api/plans/${planId}/invites`, {
        email: 'guest@example.com',
        role: 'viewer',
      });
      expect(first.status).toBe(201);
      const firstInvite = (first.data as { invite: { id: string; token: string; role: string } }).invite;

      const memberConflict = await http(base, 'POST', `/api/plans/${planId}/invites`, {
        email: editor.email,
        role: 'viewer',
      });
      expect(memberConflict.status).toBe(409);

      const resent = await http(base, 'POST', `/api/plans/${planId}/invites`, {
        email: 'guest@example.com',
        role: 'editor',
      });
      expect(resent.status).toBe(200);
      const resentInvite = (resent.data as { invite: { id: string; token: string; role: string } }).invite;
      expect(resentInvite.id).toBe(firstInvite.id);
      expect(resentInvite.token).not.toBe(firstInvite.token);
      expect(resentInvite.role).toBe('editor');

      const pendingCount = (
        dbState
          .db!.prepare(`SELECT COUNT(*) AS n FROM plan_invites WHERE plan_id = ? AND accepted_at IS NULL`)
          .get(planId) as { n: number }
      ).n;
      expect(pendingCount).toBe(1);

      authState.user = outsider;
      const mismatch = await http(base, 'POST', `/api/invites/${resentInvite.token}/accept`);
      expect(mismatch.status).toBe(403);

      const guest = insertUser('u-guest', 'clerk-guest', 'guest@example.com');
      authState.user = guest;
      const accepted = await http(base, 'POST', `/api/invites/${resentInvite.token}/accept`);
      expect(accepted.status).toBe(200);
      expect(accepted.data).toEqual(expect.objectContaining({ planId, role: 'editor' }));

      const oldToken = await http(base, 'POST', `/api/invites/${firstInvite.token}/accept`);
      expect(oldToken.status).toBe(404);
    });
  });
});
