import { randomBytes, randomUUID } from 'crypto';

import type { MemberRole } from '../db/appSchema.js';
import { getAppDb } from '../db/connection.js';

export interface AppUser {
  id: string;
  clerk_user_id: string;
  email: string;
  locale: string;
  default_plan_id: string | null;
}

const DEFAULT_CATEGORIES = ['Accounts & Credit', 'Household', 'Entertainment', 'Parents'];

export function upsertUserFromClerk(clerkUserId: string, email: string): AppUser {
  const db = getAppDb();
  const existing = db
    .prepare(
      `SELECT id, clerk_user_id, email, locale, default_plan_id
       FROM users WHERE clerk_user_id = ?`,
    )
    .get(clerkUserId) as AppUser | undefined;

  if (existing) {
    if (existing.email !== email) {
      db.prepare(`UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?`).run(
        email,
        existing.id,
      );
      return { ...existing, email };
    }
    return existing;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, clerk_user_id, email, locale)
     VALUES (?, ?, ?, 'en')`,
  ).run(id, clerkUserId, email);

  return {
    id,
    clerk_user_id: clerkUserId,
    email,
    locale: 'en',
    default_plan_id: null,
  };
}

export function getUserById(id: string): AppUser | null {
  const row = getAppDb()
    .prepare(`SELECT id, clerk_user_id, email, locale, default_plan_id FROM users WHERE id = ?`)
    .get(id) as AppUser | undefined;
  return row ?? null;
}

export function updateUserPreferences(
  userId: string,
  patch: { locale?: string; default_plan_id?: string | null },
): AppUser {
  const user = getUserById(userId);
  if (!user) throw new Error('User not found');

  const locale = patch.locale ?? user.locale;
  const defaultPlanId =
    patch.default_plan_id !== undefined ? patch.default_plan_id : user.default_plan_id;

  getAppDb()
    .prepare(
      `UPDATE users
       SET locale = ?, default_plan_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(locale, defaultPlanId, userId);

  return { ...user, locale, default_plan_id: defaultPlanId };
}

export function getMembership(planId: string, userId: string): { role: MemberRole } | null {
  const row = getAppDb()
    .prepare(`SELECT role FROM plan_members WHERE plan_id = ? AND user_id = ?`)
    .get(planId, userId) as { role: MemberRole } | undefined;
  return row ?? null;
}

export function canEdit(role: MemberRole): boolean {
  return role === 'owner' || role === 'editor';
}

export function createPlanForOwner(owner: AppUser, name: string, currency = 'EUR'): string {
  const db = getAppDb();
  const planId = randomUUID();

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO plans (id, name, currency, owner_user_id) VALUES (?, ?, ?, ?)`).run(
      planId,
      name,
      currency,
      owner.id,
    );

    db.prepare(`INSERT INTO plan_members (plan_id, user_id, role) VALUES (?, ?, 'owner')`).run(
      planId,
      owner.id,
    );

    const insertCategory = db.prepare(
      `INSERT INTO categories (id, plan_id, name, sort_order) VALUES (?, ?, ?, ?)`,
    );
    DEFAULT_CATEGORIES.forEach((catName, index) => {
      insertCategory.run(randomUUID(), planId, catName, index);
    });

    if (!owner.default_plan_id) {
      db.prepare(
        `UPDATE users SET default_plan_id = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(planId, owner.id);
    }
  });

  tx();
  return planId;
}

export function createInviteToken(): string {
  return randomBytes(24).toString('base64url');
}
