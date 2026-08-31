import { clerkClient, getAuth } from '@clerk/express';
import type { NextFunction, Request, Response } from 'express';

import { CLERK_CONFIGURED } from '../config.js';
import type { MemberRole } from '../db/appSchema.js';
import {
  canEdit,
  getMembership,
  getUserByClerkId,
  upsertUserFromClerk,
  type AppUser,
} from '../services/users.js';

export type AuthedRequest = Request & { appUser: AppUser };

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

function emailFromClaims(claims: Record<string, unknown> | null): string | null {
  const claimEmail =
    (typeof claims?.email === 'string' && claims.email) ||
    (typeof claims?.primary_email === 'string' && claims.primary_email) ||
    null;
  return claimEmail ? claimEmail.toLowerCase() : null;
}

function isPlaceholderClerkEmail(email: string): boolean {
  return email.endsWith('@users.clerk');
}

function usableEmail(email: string | null): string | null {
  if (!email || isPlaceholderClerkEmail(email)) return null;
  return email;
}

async function emailFromClerkApi(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress;
    if (primary) return primary.toLowerCase();
  } catch (err) {
    console.warn('[auth] Could not load Clerk user email', err);
  }
  return null;
}

async function resolveEmail(
  userId: string,
  claims: Record<string, unknown> | null,
  existingEmail: string | null,
): Promise<string | null> {
  return (
    usableEmail(emailFromClaims(claims)) ??
    usableEmail(existingEmail) ??
    usableEmail(await emailFromClerkApi(userId))
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_CONFIGURED) {
    res.status(503).json({
      error: 'Clerk is not configured. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.',
    });
    return;
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const existing = getUserByClerkId(auth.userId);
    const email = await resolveEmail(
      auth.userId,
      (auth.sessionClaims as Record<string, unknown> | null) ?? null,
      existing?.email ?? null,
    );
    if (!email) {
      if (existing && !existing.email.endsWith('@users.clerk')) {
        req.appUser = existing;
        next();
        return;
      }
      res.status(503).json({ error: 'Could not resolve account email. Try again shortly.' });
      return;
    }
    req.appUser =
      existing && existing.email === email ? existing : upsertUserFromClerk(auth.userId, email);
    next();
  } catch (err) {
    console.error('[auth] Failed to sync user', err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
}

export function requirePlanAccess(minRole: 'viewer' | 'editor' | 'owner' = 'viewer') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.appUser;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const rawPlanId = req.params.planId ?? req.params.id;
    const planId = Array.isArray(rawPlanId) ? rawPlanId[0] : rawPlanId;
    if (!planId) {
      res.status(400).json({ error: 'Missing plan id' });
      return;
    }

    const membership = getMembership(planId, user.id);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this plan' });
      return;
    }

    if (minRole === 'editor' && !canEdit(membership.role)) {
      res.status(403).json({ error: 'Edit permission required' });
      return;
    }

    if (minRole === 'owner' && membership.role !== 'owner') {
      res.status(403).json({ error: 'Owner permission required' });
      return;
    }

    (res.locals as { planRole?: MemberRole }).planRole = membership.role;
    next();
  };
}
