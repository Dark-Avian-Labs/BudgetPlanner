import { randomUUID } from 'crypto';

import { Router, type Request, type Response } from 'express';

import type { EntryFrequency, EntryKind, MemberRole } from '../db/appSchema.js';
import { getAppDb } from '../db/connection.js';
import { isAccountColor, nextAccountColor } from '../lib/accountColors.js';
import { computeMonthTotals, isOnceEntryExpired } from '../lib/dueThisMonth.js';
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

interface EntryRow {
  id: string;
  plan_id: string;
  category_id: string;
  account_id: string | null;
  name: string;
  amount_cents: number;
  kind: EntryKind;
  frequency: EntryFrequency;
  due_day: number;
  due_month: number | null;
  due_year: number | null;
  comment: string | null;
  end_date: string | null;
  final_amount_cents: number | null;
  sort_order: number;
}

function parseMonthQuery(req: Request): { year: number; month: number } {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;
  return { year, month: Math.min(12, Math.max(1, month)) };
}

/** Drop one-time entries whose due month is already over (wall-clock). */
function purgeExpiredOnceEntries(db: ReturnType<typeof getAppDb>, planId?: string): void {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const rows = (
    planId
      ? db
          .prepare(
            `SELECT id, frequency, due_month, due_year FROM entries WHERE plan_id = ? AND frequency = 'once'`,
          )
          .all(planId)
      : db
          .prepare(
            `SELECT id, frequency, due_month, due_year FROM entries WHERE frequency = 'once'`,
          )
          .all()
  ) as Array<{
    id: string;
    frequency: EntryFrequency;
    due_month: number | null;
    due_year: number | null;
  }>;

  const del = db.prepare(`DELETE FROM entries WHERE id = ?`);
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (isOnceEntryExpired(row, year, month)) del.run(row.id);
    }
  });
  tx();
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
  const name =
    typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : 'Household';
  const currency =
    typeof req.body?.currency === 'string' && req.body.currency.trim()
      ? req.body.currency.trim().toUpperCase()
      : 'EUR';

  const planId = createPlanForOwner(user, name, currency);
  const plan = getAppDb()
    .prepare(
      `SELECT id, name, currency, owner_user_id, created_at, updated_at FROM plans WHERE id = ?`,
    )
    .get(planId) as PlanRow;

  res.status(201).json({ plan, role: 'owner' as const });
});

plansRouter.get('/:planId', requirePlanAccess('viewer'), (req: Request, res: Response) => {
  const planId = req.params.planId as string;
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

  purgeExpiredOnceEntries(db, planId);

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

  const entries = db
    .prepare(
      `SELECT id, plan_id, category_id, account_id, name, amount_cents, kind, frequency,
              due_day, due_month, due_year, comment, end_date, final_amount_cents, sort_order
       FROM entries WHERE plan_id = ? ORDER BY sort_order, name`,
    )
    .all(planId) as EntryRow[];

  const { year, month } = parseMonthQuery(req);
  const totals = computeMonthTotals(entries, year, month);
  const role = (res.locals as { planRole?: MemberRole }).planRole!;

  res.json({
    plan,
    role,
    categories,
    accounts,
    entries,
    totals,
    month: { year, month },
  });
});

plansRouter.patch('/:planId', requirePlanAccess('editor'), (req: Request, res: Response) => {
  const planId = req.params.planId!;
  const db = getAppDb();
  const plan = db.prepare(`SELECT id, name, currency FROM plans WHERE id = ?`).get(planId) as
    | { id: string; name: string; currency: string }
    | undefined;
  if (!plan) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const name =
    typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : plan.name;
  const currency =
    typeof req.body?.currency === 'string' && req.body.currency.trim()
      ? req.body.currency.trim().toUpperCase()
      : plan.currency;

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

// Categories
plansRouter.post(
  '/:planId/categories',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = req.params.planId!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
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
    const { planId, categoryId } = req.params;
    const db = getAppDb();
    const existing = db
      .prepare(`SELECT id, name, sort_order FROM categories WHERE id = ? AND plan_id = ?`)
      .get(categoryId, planId) as { id: string; name: string; sort_order: number } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : existing.name;
    const sortOrder =
      typeof req.body?.sort_order === 'number' ? req.body.sort_order : existing.sort_order;
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
    const { planId, categoryId } = req.params;
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

// Accounts
plansRouter.post(
  '/:planId/accounts',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const planId = req.params.planId!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
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
    const { planId, accountId } = req.params;
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
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : existing.name;
    const sortOrder =
      typeof req.body?.sort_order === 'number' ? req.body.sort_order : existing.sort_order;
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
    const { planId, accountId } = req.params;
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

function validateEntryBody(body: Record<string, unknown>, partial = false) {
  const errors: string[] = [];
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) errors.push('name');
  }
  if (!partial || body.amount_cents !== undefined) {
    if (
      typeof body.amount_cents !== 'number' ||
      body.amount_cents < 0 ||
      !Number.isInteger(body.amount_cents)
    ) {
      errors.push('amount_cents');
    }
  }
  if (!partial || body.kind !== undefined) {
    if (!['expense', 'income', 'credit'].includes(body.kind as string)) errors.push('kind');
  }
  if (!partial || body.frequency !== undefined) {
    if (
      !['monthly', 'quarterly', 'halfyearly', 'yearly', 'once'].includes(body.frequency as string)
    ) {
      errors.push('frequency');
    }
  }
  if (!partial || body.due_day !== undefined) {
    if (typeof body.due_day !== 'number' || body.due_day < 1 || body.due_day > 31) {
      errors.push('due_day');
    }
  }
  if (!partial || body.category_id !== undefined) {
    if (typeof body.category_id !== 'string' || !body.category_id) errors.push('category_id');
  }
  return errors;
}

plansRouter.post('/:planId/entries', requirePlanAccess('editor'), (req: Request, res: Response) => {
  const planId = req.params.planId!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const errors = validateEntryBody(body);
  if (errors.length) {
    res.status(400).json({ error: `Invalid fields: ${errors.join(', ')}` });
    return;
  }

  const frequency = body.frequency as EntryFrequency;
  let dueMonth: number | null = typeof body.due_month === 'number' ? body.due_month : null;
  let dueYear: number | null = typeof body.due_year === 'number' ? body.due_year : null;
  if (frequency !== 'monthly' && (dueMonth == null || dueMonth < 1 || dueMonth > 12)) {
    res.status(400).json({ error: 'due_month is required for non-monthly entries' });
    return;
  }
  if (frequency === 'monthly') {
    dueMonth = null;
    dueYear = null;
  } else if (frequency === 'once') {
    if (dueYear == null || dueYear < 2000 || dueYear > 2100) {
      res.status(400).json({ error: 'due_year is required for one-time entries' });
      return;
    }
  } else {
    dueYear = null;
  }

  const db = getAppDb();
  const cat = db
    .prepare(`SELECT id FROM categories WHERE id = ? AND plan_id = ?`)
    .get(body.category_id, planId);
  if (!cat) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }

  const accountId = typeof body.account_id === 'string' && body.account_id ? body.account_id : null;
  if (accountId) {
    const acc = db
      .prepare(`SELECT id FROM accounts WHERE id = ? AND plan_id = ?`)
      .get(accountId, planId);
    if (!acc) {
      res.status(400).json({ error: 'Invalid account' });
      return;
    }
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
    typeof body.comment === 'string' ? body.comment.trim() || null : null,
    typeof body.end_date === 'string' && body.end_date ? body.end_date : null,
    typeof body.final_amount_cents === 'number' ? body.final_amount_cents : null,
    max.m + 1,
  );

  const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(id);
  res.status(201).json({ entry });
});

plansRouter.patch(
  '/:planId/entries/:entryId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const { planId, entryId } = req.params;
    const db = getAppDb();
    const existing = db
      .prepare(`SELECT * FROM entries WHERE id = ? AND plan_id = ?`)
      .get(entryId, planId) as EntryRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const errors = validateEntryBody(body, true);
    if (errors.length) {
      res.status(400).json({ error: `Invalid fields: ${errors.join(', ')}` });
      return;
    }

    const name =
      typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
    const amountCents =
      typeof body.amount_cents === 'number' ? body.amount_cents : existing.amount_cents;
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
        res.status(400).json({ error: 'due_month is required for non-monthly entries' });
        return;
      }
      if (frequency === 'once') {
        if (dueYear == null || dueYear < 2000 || dueYear > 2100) {
          res.status(400).json({ error: 'due_year is required for one-time entries' });
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
    const accountId =
      body.account_id === null
        ? null
        : typeof body.account_id === 'string'
          ? body.account_id || null
          : existing.account_id;
    const comment =
      body.comment !== undefined
        ? typeof body.comment === 'string'
          ? body.comment.trim() || null
          : null
        : existing.comment;
    const endDate =
      body.end_date !== undefined
        ? typeof body.end_date === 'string' && body.end_date
          ? body.end_date
          : null
        : existing.end_date;
    const finalAmount =
      body.final_amount_cents !== undefined
        ? typeof body.final_amount_cents === 'number'
          ? body.final_amount_cents
          : null
        : existing.final_amount_cents;
    const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : existing.sort_order;

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

    const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(entryId);
    res.json({ entry });
  },
);

plansRouter.delete(
  '/:planId/entries/:entryId',
  requirePlanAccess('editor'),
  (req: Request, res: Response) => {
    const { planId, entryId } = req.params;
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
  const planId = req.params.planId!;
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : null;
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
  const db = getAppDb();

  const tx = db.transaction(() => {
    if (categories) {
      const stmt = db.prepare(
        `UPDATE categories SET sort_order = ?, updated_at = datetime('now')
           WHERE id = ? AND plan_id = ?`,
      );
      for (const item of categories as Array<{ id: string; sort_order: number }>) {
        stmt.run(item.sort_order, item.id, planId);
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
        stmt.run(item.sort_order, item.category_id ?? null, item.id, planId);
      }
    }
  });
  tx();
  res.json({ ok: true });
});

plansRouter.post('/:planId/invites', requirePlanAccess('owner'), (req: Request, res: Response) => {
  const planId = req.params.planId!;
  const user = req.appUser!;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const role = req.body?.role === 'editor' ? 'editor' : 'viewer';
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  const token = createInviteToken();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  getAppDb()
    .prepare(
      `INSERT INTO plan_invites (id, plan_id, email, role, token, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, planId, email, role, token, user.id, expiresAt);

  const plan = getAppDb().prepare(`SELECT name FROM plans WHERE id = ?`).get(planId) as {
    name: string;
  };

  res.status(201).json({
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

invitesRouter.get('/:token', (req: Request, res: Response) => {
  const token = req.params.token!;
  const row = getAppDb()
    .prepare(
      `SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, p.id AS plan_id, p.name AS plan_name, p.currency
       FROM plan_invites i
       JOIN plans p ON p.id = i.plan_id
       WHERE i.token = ?`,
    )
    .get(token) as
    | {
        id: string;
        email: string;
        role: 'editor' | 'viewer';
        expires_at: string;
        accepted_at: string | null;
        plan_id: string;
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
    email: row.email,
    role: row.role,
    plan: { id: row.plan_id, name: row.plan_name, currency: row.currency },
    expiresAt: row.expires_at,
  });
});

invitesRouter.post('/:token/accept', requireAuth, (req: Request, res: Response) => {
  const token = req.params.token!;
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

  const setDefault = Boolean(req.body?.setAsDefault);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO plan_members (plan_id, user_id, role)
       VALUES (?, ?, ?)
       ON CONFLICT(plan_id, user_id) DO UPDATE SET role = excluded.role`,
    ).run(invite.plan_id, user.id, invite.role);

    db.prepare(`UPDATE plan_invites SET accepted_at = datetime('now') WHERE id = ?`).run(invite.id);

    if (setDefault || !user.default_plan_id) {
      db.prepare(
        `UPDATE users SET default_plan_id = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(invite.plan_id, user.id);
    }
  });
  tx();

  res.json({
    planId: invite.plan_id,
    role: invite.role,
    setAsDefault: setDefault || !user.default_plan_id,
  });
});
