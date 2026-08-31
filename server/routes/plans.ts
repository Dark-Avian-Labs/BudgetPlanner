import { randomUUID } from 'crypto';

import { Router, type Request, type Response } from 'express';

import type { EntryFrequency, EntryKind, MemberRole } from '../db/appSchema.js';
import { getAppDb } from '../db/connection.js';
import { isAccountColor, nextAccountColor } from '../lib/accountColors.js';
import { computeMonthTotals } from '../lib/dueThisMonth.js';
import {
  ENTRY_SELECT,
  listPlanEntries,
  syncOnceArchiveState,
  type PlanEntryRow,
} from '../lib/planEntries.js';
import { calendarMonth, clampPlanMonth } from '../lib/planMonth.js';
import {
  invalidFieldsBody,
  isNonNegativeInteger,
  normalizeComment,
  normalizeCurrency,
  normalizeName,
  validateEntryBody,
} from '../lib/planValidation.js';
import { requireAuth, requirePlanAccess } from '../middleware/auth.js';
import {
  createInviteToken,
  createPlanForOwner,
  getMembership,
  updateUserPreferences,
} from '../services/users.js';

export const plansRouter = Router();

plansRouter.use(requireAuth);

interface PlanRow {
  id: string;
  name: string;
  currency: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  plan_id: string;
  name: string;
  sort_order: number;
}

interface AccountRow {
  id: string;
  plan_id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface MemberRow {
  id: string;
  email: string;
  role: MemberRole;
}

interface InviteRow {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  expires_at: string;
}

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parseMonthQuery(req: Request): { year: number; month: number } {
  const fallback = calendarMonth();
  const rawYear = Number(req.query.year);
  const rawMonth = Number(req.query.month);
  return clampPlanMonth(
    Number.isInteger(rawYear) ? rawYear : fallback.year,
    Number.isInteger(rawMonth) ? rawMonth : fallback.month,
    fallback,
  );
}

function syncPlanOnceEntries(db: ReturnType<typeof getAppDb>, planId: string): void {
  const now = calendarMonth();
  syncOnceArchiveState(db, planId, now.year, now.month);
}

function categoryBelongsToPlan(
  db: ReturnType<typeof getAppDb>,
  categoryId: string,
  planId: string,
): boolean {
  return Boolean(
    db.prepare(`SELECT id FROM categories WHERE id = ? AND plan_id = ?`).get(categoryId, planId),
  );
}

function accountBelongsToPlan(
  db: ReturnType<typeof getAppDb>,
  accountId: string,
  planId: string,
): boolean {
  return Boolean(
    db.prepare(`SELECT id FROM accounts WHERE id = ? AND plan_id = ?`).get(accountId, planId),
  );
}

function listMembers(db: ReturnType<typeof getAppDb>, planId: string): MemberRow[] {
  return db
    .prepare(
      `SELECT u.id, u.email, pm.role
       FROM plan_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.plan_id = ?
       ORDER BY pm.role, u.email COLLATE NOCASE`,
    )
    .all(planId) as MemberRow[];
}

function listPendingInvites(db: ReturnType<typeof getAppDb>, planId: string): InviteRow[] {
  return db
    .prepare(
      `SELECT id, email, role, expires_at
       FROM plan_invites
       WHERE plan_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC`,
    )
    .all(planId) as InviteRow[];
}

function clearDefaultPlan(db: ReturnType<typeof getAppDb>, userId: string, planId: string): void {
  db.prepare(
    `UPDATE users SET default_plan_id = NULL, updated_at = datetime('now')
     WHERE id = ? AND default_plan_id = ?`,
  ).run(userId, planId);
}

plansRouter.get('/', (req: Request, res: Response) => {
  const user = req.appUser!;
  const db = getAppDb();
  const plans = db
    .prepare(
      `SELECT p.id, p.name, p.currency, p.owner_user_id, p.created_at, p.updated_at, pm.role
       FROM plans p
       JOIN plan_members pm ON pm.plan_id = p.id
       WHERE pm.user_id = ?
       ORDER BY p.name COLLATE NOCASE`,
    )
    .all(user.id) as Array<PlanRow & { role: MemberRole }>;

  res.json({
    plans,
    defaultPlanId: user.default_plan_id,
    me: {
      id: user.id,
      email: user.email,
      locale: user.locale,
      defaultPlanId: user.default_plan_id,
    },
  });
});

plansRouter.post('/', (req: Request, res: Response) => {
  const user = req.appUser!;
  const rawName =
    typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : 'Household';
  const name = normalizeName(rawName);
  const currency = normalizeCurrency(req.body?.currency, 'EUR');
  if (!name) {
    res.status(400).json({ error: 'Invalid plan name' });
    return;
  }
  if (!currency) {
    res.status(400).json({ error: 'Invalid currency' });
    return;
  }

  const planId = createPlanForOwner(user, name, currency);
  const plan = getAppDb()
    .prepare(
      `SELECT id, name, currency, owner_user_id, created_at, updated_at FROM plans WHERE id = ?`,
    )
    .get(planId) as PlanRow;

  res.status(201).json({ plan, role: 'owner' as const });
});

plansRouter.get('/:planId', requirePlanAccess('viewer'), (req: Request, res: Response) => {
  const planId = routeParam(req.params.planId);
  const db = getAppDb();
  const plan = db
    .prepare(
      `SELECT id, name, currency, owner_user_id, created_at, updated_at FROM plans WHERE id = ?`,
    )
    .get(planId) as PlanRow | undefined;
  if (!plan) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const includeArchived = req.query.includeArchived === '1';
  const { year, month } = parseMonthQuery(req);
  syncPlanOnceEntries(db, planId);
  const categories = db
    .prepare(
      `SELECT id, plan_id, name, sort_order FROM categories WHERE plan_id = ? ORDER BY sort_order, name`,
    )
    .all(planId) as CategoryRow[];

  const accounts = db
    .prepare(
      `SELECT id, plan_id, name, color, sort_order FROM accounts WHERE plan_id = ? ORDER BY sort_order, name`,
    )
    .all(planId) as AccountRow[];

  const entries = listPlanEntries(db, planId, year, month, includeArchived);
  const totals = computeMonthTotals(entries, year, month);
  const role = (res.locals as { planRole?: MemberRole }).planRole!;
  const members = listMembers(db, planId);

  res.json({
    plan,
    role,
    categories,
    accounts,
    entries,
    totals,
    month: { year, month },
    members,
    pendingInvites: role === 'owner' ? listPendingInvites(db, planId) : [],
  });
});

plansRouter.patch('/:planId', requirePlanAccess('editor'), (req: Request, res: Response) => {
  const planId = routeParam(req.params.planId);
  const db = getAppDb();
  const plan = db.prepare(`SELECT id, name, currency FROM plans WHERE id = ?`).get(planId) as
    | { id: string; name: string; currency: string }
    | undefined;
  if (!plan) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const name = normalizeName(req.body?.name, plan.name);
  const currency = normalizeCurrency(req.body?.currency, plan.currency);
  if (!name) {
    res.status(400).json({ error: 'Invalid plan name' });
    return;
  }
  if (!currency) {
    res.status(400).json({ error: 'Invalid currency' });
    return;
  }

  db.prepare(
    `UPDATE plans SET name = ?, currency = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(name, currency, planId);

  const updated = db
    .prepare(
      `SELECT id, name, currency, owner_user_id, created_at, updated_at FROM plans WHERE id = ?`,
    )
    .get(planId);
  res.json({ plan: updated });
});

plansRouter.delete('/:planId', requirePlanAccess('owner'), (req: Request, res: Response) => {
  const planId = routeParam(req.params.planId);
  const db = getAppDb();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE users SET default_plan_id = NULL, updated_at = datetime('now') WHERE default_plan_id = ?`,
    ).run(planId);
    const result = db.prepare(`DELETE FROM plans WHERE id = ?`).run(planId);
    return result.changes;
  });
  if (tx() === 0) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  res.status(204).end();
});

plansRouter.post('/:planId/leave', requirePlanAccess('viewer'), (req: Request, res: Response) => {
  const planId = routeParam(req.params.planId);
  const user = req.appUser!;
  const role = (res.locals as { planRole?: MemberRole }).planRole;
  if (role === 'owner') {
    res.status(400).json({ error: 'Owner cannot leave the plan. Delete it instead.' });
    return;
  }

  const db = getAppDb();
  const tx = db.transaction(() => {
    clearDefaultPlan(db, user.id, planId);
    db.prepare(`DELETE FROM plan_members WHERE plan_id = ? AND user_id = ?`).run(planId, user.id);
  });
  tx();
  res.status(204).end();
});

plansRouter.delete(
  '/:planId/members/:userId',
  requirePlanAccess('owner'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const userId = routeParam(req.params.userId);
    const db = getAppDb();
    const membership = getMembership(planId, userId);
    if (!membership) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    if (membership.role === 'owner') {
      res.status(400).json({ error: 'Cannot remove the plan owner' });
      return;
    }

    const tx = db.transaction(() => {
      clearDefaultPlan(db, userId, planId);
      db.prepare(`DELETE FROM plan_members WHERE plan_id = ? AND user_id = ?`).run(planId, userId);
    });
    tx();
    res.status(204).end();
  },
);

plansRouter.delete(
  '/:planId/invites/:inviteId',
  requirePlanAccess('owner'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const inviteId = routeParam(req.params.inviteId);
    const result = getAppDb()
      .prepare(`DELETE FROM plan_invites WHERE id = ? AND plan_id = ? AND accepted_at IS NULL`)
      .run(inviteId, planId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    res.status(204).end();
  },
);

plansRouter.post(
  '/:planId/categories',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const name = normalizeName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const db = getAppDb();
    const max = db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories WHERE plan_id = ?`)
      .get(planId) as { m: number };
    const id = randomUUID();
    db.prepare(`INSERT INTO categories (id, plan_id, name, sort_order) VALUES (?, ?, ?, ?)`).run(
      id,
      planId,
      name,
      max.m + 1,
    );
    const category = db
      .prepare(`SELECT id, plan_id, name, sort_order FROM categories WHERE id = ?`)
      .get(id);
    res.status(201).json({ category });
  },
);

plansRouter.patch(
  '/:planId/categories/:categoryId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const categoryId = routeParam(req.params.categoryId);
    const db = getAppDb();
    const existing = db
      .prepare(`SELECT id, name, sort_order FROM categories WHERE id = ? AND plan_id = ?`)
      .get(categoryId, planId) as { id: string; name: string; sort_order: number } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const name = normalizeName(req.body?.name, existing.name);
    if (!name) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    const sortOrder = isNonNegativeInteger(req.body?.sort_order)
      ? req.body.sort_order
      : existing.sort_order;
    db.prepare(
      `UPDATE categories SET name = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(name, sortOrder, categoryId);
    const category = db
      .prepare(`SELECT id, plan_id, name, sort_order FROM categories WHERE id = ?`)
      .get(categoryId);
    res.json({ category });
  },
);

plansRouter.delete(
  '/:planId/categories/:categoryId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const categoryId = routeParam(req.params.categoryId);
    const result = getAppDb()
      .prepare(`DELETE FROM categories WHERE id = ? AND plan_id = ?`)
      .run(categoryId, planId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.status(204).end();
  },
);

plansRouter.post(
  '/:planId/accounts',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const name = normalizeName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const db = getAppDb();
    const existingColors = (
      db.prepare(`SELECT color FROM accounts WHERE plan_id = ?`).all(planId) as Array<{
        color: string;
      }>
    ).map((r) => r.color);
    const color = isAccountColor(req.body?.color)
      ? req.body.color
      : nextAccountColor(existingColors);
    const max = db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM accounts WHERE plan_id = ?`)
      .get(planId) as { m: number };
    const id = randomUUID();
    db.prepare(
      `INSERT INTO accounts (id, plan_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, planId, name, color, max.m + 1);
    const account = db
      .prepare(`SELECT id, plan_id, name, color, sort_order FROM accounts WHERE id = ?`)
      .get(id);
    res.status(201).json({ account });
  },
);

plansRouter.patch(
  '/:planId/accounts/:accountId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const accountId = routeParam(req.params.accountId);
    const db = getAppDb();
    const existing = db
      .prepare(`SELECT id, name, color, sort_order FROM accounts WHERE id = ? AND plan_id = ?`)
      .get(accountId, planId) as
      | { id: string; name: string; color: string; sort_order: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const name = normalizeName(req.body?.name, existing.name);
    if (!name) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    const sortOrder = isNonNegativeInteger(req.body?.sort_order)
      ? req.body.sort_order
      : existing.sort_order;
    const color = isAccountColor(req.body?.color) ? req.body.color : existing.color;
    db.prepare(
      `UPDATE accounts SET name = ?, color = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(name, color, sortOrder, accountId);
    const account = db
      .prepare(`SELECT id, plan_id, name, color, sort_order FROM accounts WHERE id = ?`)
      .get(accountId);
    res.json({ account });
  },
);

plansRouter.delete(
  '/:planId/accounts/:accountId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const accountId = routeParam(req.params.accountId);
    const result = getAppDb()
      .prepare(`DELETE FROM accounts WHERE id = ? AND plan_id = ?`)
      .run(accountId, planId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.status(204).end();
  },
);

plansRouter.post('/:planId/entries', requirePlanAccess('editor'), (req: Request, res: Response) => {
  const planId = routeParam(req.params.planId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const errors = validateEntryBody(body);
  if (errors.length) {
    res.status(400).json(invalidFieldsBody(errors));
    return;
  }

  const frequency = body.frequency as EntryFrequency;
  let dueMonth: number | null = typeof body.due_month === 'number' ? body.due_month : null;
  let dueYear: number | null = typeof body.due_year === 'number' ? body.due_year : null;
  if (frequency !== 'monthly' && (dueMonth == null || dueMonth < 1 || dueMonth > 12)) {
    res.status(400).json(invalidFieldsBody(['due_month']));
    return;
  }
  if (frequency === 'monthly') {
    dueMonth = null;
    dueYear = null;
  } else if (frequency === 'once') {
    if (dueYear == null) {
      res.status(400).json(invalidFieldsBody(['due_year']));
      return;
    }
  } else {
    dueYear = null;
  }

  const db = getAppDb();
  if (!categoryBelongsToPlan(db, body.category_id as string, planId)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }

  const accountId = typeof body.account_id === 'string' && body.account_id ? body.account_id : null;
  if (accountId && !accountBelongsToPlan(db, accountId, planId)) {
    res.status(400).json({ error: 'Invalid account' });
    return;
  }

  const comment = normalizeComment(body.comment, null);
  if (body.comment !== undefined && body.comment !== null && comment == null) {
    res.status(400).json(invalidFieldsBody(['comment']));
    return;
  }

  const max = db
    .prepare(
      `SELECT COALESCE(MAX(sort_order), -1) AS m FROM entries WHERE plan_id = ? AND category_id = ?`,
    )
    .get(planId, body.category_id) as { m: number };

  const id = randomUUID();
  db.prepare(
    `INSERT INTO entries (
      id, plan_id, category_id, account_id, name, amount_cents, kind, frequency,
      due_day, due_month, due_year, comment, end_date, final_amount_cents, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    planId,
    body.category_id,
    accountId,
    (body.name as string).trim(),
    body.amount_cents,
    body.kind,
    frequency,
    body.due_day,
    dueMonth,
    dueYear,
    comment,
    typeof body.end_date === 'string' && body.end_date ? body.end_date : null,
    typeof body.final_amount_cents === 'number' ? body.final_amount_cents : null,
    max.m + 1,
  );

  syncPlanOnceEntries(db, planId);
  const entry = db.prepare(`SELECT ${ENTRY_SELECT} FROM entries WHERE id = ?`).get(id);
  res.status(201).json({ entry });
});

plansRouter.patch(
  '/:planId/entries/:entryId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const entryId = routeParam(req.params.entryId);
    const db = getAppDb();
    const existing = db
      .prepare(`SELECT ${ENTRY_SELECT} FROM entries WHERE id = ? AND plan_id = ?`)
      .get(entryId, planId) as PlanEntryRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const errors = validateEntryBody(body, true);
    if (errors.length) {
      res.status(400).json(invalidFieldsBody(errors));
      return;
    }

    const name = normalizeName(body.name, existing.name);
    if (!name) {
      res.status(400).json(invalidFieldsBody(['name']));
      return;
    }
    const amountCents = isNonNegativeInteger(body.amount_cents)
      ? body.amount_cents
      : existing.amount_cents;
    const kind = (typeof body.kind === 'string' ? body.kind : existing.kind) as EntryKind;
    const frequency = (
      typeof body.frequency === 'string' ? body.frequency : existing.frequency
    ) as EntryFrequency;
    const dueDay = typeof body.due_day === 'number' ? body.due_day : existing.due_day;
    let dueMonth =
      body.due_month !== undefined ? (body.due_month as number | null) : existing.due_month;
    let dueYear =
      body.due_year !== undefined ? (body.due_year as number | null) : existing.due_year;
    if (frequency === 'monthly') {
      dueMonth = null;
      dueYear = null;
    } else {
      if (dueMonth == null || dueMonth < 1 || dueMonth > 12) {
        res.status(400).json(invalidFieldsBody(['due_month']));
        return;
      }
      if (frequency === 'once') {
        if (dueYear == null) {
          res.status(400).json(invalidFieldsBody(['due_year']));
          return;
        }
      } else {
        dueYear = null;
      }
    }
    const categoryId =
      typeof body.category_id === 'string' && body.category_id
        ? body.category_id
        : existing.category_id;
    if (!categoryBelongsToPlan(db, categoryId, planId)) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    const accountId =
      body.account_id === null
        ? null
        : typeof body.account_id === 'string'
          ? body.account_id || null
          : existing.account_id;
    if (accountId && !accountBelongsToPlan(db, accountId, planId)) {
      res.status(400).json({ error: 'Invalid account' });
      return;
    }
    const comment = normalizeComment(body.comment, existing.comment);
    if (body.comment !== undefined && body.comment !== null && comment == null) {
      res.status(400).json(invalidFieldsBody(['comment']));
      return;
    }
    const endDate =
      body.end_date !== undefined
        ? typeof body.end_date === 'string' && body.end_date
          ? body.end_date
          : null
        : existing.end_date;
    const finalAmount =
      body.final_amount_cents !== undefined
        ? isNonNegativeInteger(body.final_amount_cents)
          ? body.final_amount_cents
          : null
        : existing.final_amount_cents;
    const sortOrder = isNonNegativeInteger(body.sort_order) ? body.sort_order : existing.sort_order;

    db.prepare(
      `UPDATE entries SET
        category_id = ?, account_id = ?, name = ?, amount_cents = ?, kind = ?, frequency = ?,
        due_day = ?, due_month = ?, due_year = ?, comment = ?, end_date = ?, final_amount_cents = ?,
        sort_order = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      categoryId,
      accountId,
      name,
      amountCents,
      kind,
      frequency,
      dueDay,
      dueMonth,
      dueYear,
      comment,
      endDate,
      finalAmount,
      sortOrder,
      entryId,
    );

    syncPlanOnceEntries(db, planId);
    const entry = db.prepare(`SELECT ${ENTRY_SELECT} FROM entries WHERE id = ?`).get(entryId);
    res.json({ entry });
  },
);

plansRouter.delete(
  '/:planId/entries/:entryId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = routeParam(req.params.planId);
    const entryId = routeParam(req.params.entryId);
    const result = getAppDb()
      .prepare(`DELETE FROM entries WHERE id = ? AND plan_id = ?`)
      .run(entryId, planId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.status(204).end();
  },
);

plansRouter.post('/:planId/reorder', requirePlanAccess('editor'), (req: Request, res: Response) => {
  const planId = routeParam(req.params.planId);
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : null;
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
  const db = getAppDb();
  syncPlanOnceEntries(db, planId);

  try {
    const tx = db.transaction(() => {
      if (categories) {
        const stmt = db.prepare(
          `UPDATE categories SET sort_order = ?, updated_at = datetime('now')
           WHERE id = ? AND plan_id = ?`,
        );
        for (const item of categories as Array<{ id: string; sort_order: number }>) {
          if (typeof item.id !== 'string' || !isNonNegativeInteger(item.sort_order)) {
            throw new Error('Invalid category reorder');
          }
          const result = stmt.run(item.sort_order, item.id, planId);
          if (result.changes === 0) throw new Error('Invalid category');
        }
      }
      if (entries) {
        const stmt = db.prepare(
          `UPDATE entries SET sort_order = ?, category_id = COALESCE(?, category_id),
            updated_at = datetime('now') WHERE id = ? AND plan_id = ?`,
        );
        for (const item of entries as Array<{
          id: string;
          sort_order: number;
          category_id?: string;
        }>) {
          if (typeof item.id !== 'string' || !isNonNegativeInteger(item.sort_order)) {
            throw new Error('Invalid entry reorder');
          }
          if (item.category_id && !categoryBelongsToPlan(db, item.category_id, planId)) {
            throw new Error('Invalid category');
          }
          const result = stmt.run(item.sort_order, item.category_id ?? null, item.id, planId);
          if (result.changes === 0) throw new Error('Invalid entry');
        }
      }
    });
    tx();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid reorder';
    res.status(400).json({ error: message });
    return;
  }
  res.json({ ok: true });
});

plansRouter.post('/:planId/invites', requirePlanAccess('owner'), (req: Request, res: Response) => {
  const planId = routeParam(req.params.planId);
  const user = req.appUser!;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const role = req.body?.role === 'editor' ? 'editor' : 'viewer';
  if (!email || !email.includes('@') || email.length > 254) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  const existingMember = getAppDb()
    .prepare(
      `SELECT pm.role FROM plan_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.plan_id = ? AND lower(u.email) = ?`,
    )
    .get(planId, email) as { role: string } | undefined;
  if (existingMember) {
    res.status(409).json({ error: 'That email already belongs to a plan member' });
    return;
  }

  const token = createInviteToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const db = getAppDb();

  const pending = db
    .prepare(
      `SELECT id FROM plan_invites
       WHERE plan_id = ? AND lower(email) = ? AND accepted_at IS NULL`,
    )
    .get(planId, email) as { id: string } | undefined;

  let id: string;
  let created = false;
  if (pending) {
    id = pending.id;
    db.prepare(
      `UPDATE plan_invites
       SET role = ?, token = ?, invited_by = ?, expires_at = ?
       WHERE id = ?`,
    ).run(role, token, user.id, expiresAt, id);
  } else {
    id = randomUUID();
    db.prepare(
      `INSERT INTO plan_invites (id, plan_id, email, role, token, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, planId, email, role, token, user.id, expiresAt);
    created = true;
  }

  const plan = db.prepare(`SELECT name FROM plans WHERE id = ?`).get(planId) as {
    name: string;
  };

  res.status(created ? 201 : 200).json({
    invite: {
      id,
      email,
      role,
      token,
      expiresAt,
      acceptPath: `/invite/${token}`,
    },
    mailto: {
      to: email,
      subject: `Join "${plan.name}" on BudgetPlanner`,
      body: `You've been invited to ${role === 'editor' ? 'edit' : 'view'} the budget plan "${plan.name}".\n\nOpen this link after signing in:\n`,
    },
  });
});

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get('/', (req: Request, res: Response) => {
  const user = req.appUser!;
  res.json({
    id: user.id,
    email: user.email,
    locale: user.locale,
    defaultPlanId: user.default_plan_id,
  });
});

meRouter.patch('/', (req: Request, res: Response) => {
  const user = req.appUser!;
  const locale =
    typeof req.body?.locale === 'string' && ['en', 'de'].includes(req.body.locale)
      ? req.body.locale
      : undefined;
  let defaultPlanId: string | null | undefined = undefined;
  if (req.body?.defaultPlanId === null) defaultPlanId = null;
  else if (typeof req.body?.defaultPlanId === 'string') {
    const membership = getMembership(req.body.defaultPlanId, user.id);
    if (!membership) {
      res.status(400).json({ error: 'Not a member of that plan' });
      return;
    }
    defaultPlanId = req.body.defaultPlanId;
  }

  const updated = updateUserPreferences(user.id, {
    locale,
    default_plan_id: defaultPlanId,
  });
  res.json({
    id: updated.id,
    email: updated.email,
    locale: updated.locale,
    defaultPlanId: updated.default_plan_id,
  });
});

export const invitesRouter = Router();

invitesRouter.get('/:token', requireAuth, (req: Request, res: Response) => {
  const token = routeParam(req.params.token);
  const row = getAppDb()
    .prepare(
      `SELECT i.role, i.expires_at, i.accepted_at, p.name AS plan_name, p.currency
       FROM plan_invites i
       JOIN plans p ON p.id = i.plan_id
       WHERE i.token = ?`,
    )
    .get(token) as
    | {
        role: 'editor' | 'viewer';
        expires_at: string;
        accepted_at: string | null;
        plan_name: string;
        currency: string;
      }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }
  if (row.accepted_at) {
    res.status(410).json({ error: 'Invite already accepted' });
    return;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: 'Invite expired' });
    return;
  }

  res.json({
    role: row.role,
    planName: row.plan_name,
    currency: row.currency,
    expiresAt: row.expires_at,
  });
});

invitesRouter.post('/:token/accept', requireAuth, (req: Request, res: Response) => {
  const token = routeParam(req.params.token);
  const user = req.appUser!;
  const db = getAppDb();

  const invite = db
    .prepare(
      `SELECT id, plan_id, email, role, expires_at, accepted_at FROM plan_invites WHERE token = ?`,
    )
    .get(token) as
    | {
        id: string;
        plan_id: string;
        email: string;
        role: 'editor' | 'viewer';
        expires_at: string;
        accepted_at: string | null;
      }
    | undefined;

  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }
  if (invite.accepted_at) {
    res.status(410).json({ error: 'Invite already accepted' });
    return;
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: 'Invite expired' });
    return;
  }
  if (user.email.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
    res.status(403).json({ error: 'Invite email does not match your account' });
    return;
  }

  const setDefault = Boolean(req.body?.setAsDefault);

  const tx = db.transaction(() => {
    const existing = db
      .prepare(`SELECT role FROM plan_members WHERE plan_id = ? AND user_id = ?`)
      .get(invite.plan_id, user.id) as { role: string } | undefined;
    if (existing?.role === 'owner') {
      throw new Error('OWNER_INVITE');
    }

    db.prepare(
      `INSERT INTO plan_members (plan_id, user_id, role)
       VALUES (?, ?, ?)
       ON CONFLICT(plan_id, user_id) DO UPDATE SET role = excluded.role
       WHERE plan_members.role != 'owner'`,
    ).run(invite.plan_id, user.id, invite.role);

    db.prepare(`UPDATE plan_invites SET accepted_at = datetime('now') WHERE id = ?`).run(invite.id);

    if (setDefault || !user.default_plan_id) {
      db.prepare(
        `UPDATE users SET default_plan_id = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(invite.plan_id, user.id);
    }
  });
  try {
    tx();
  } catch (err) {
    if (err instanceof Error && err.message === 'OWNER_INVITE') {
      res
        .status(409)
        .json({ error: 'Plan owners cannot accept an invite that would change their role' });
      return;
    }
    throw err;
  }

  res.json({
    planId: invite.plan_id,
    role: invite.role,
    setAsDefault: setDefault || !user.default_plan_id,
  });
});
