import { clerkMiddleware as clerkExpressMiddleware } from '@clerk/express';
import type { RequestHandler } from 'express';

import { getClerkAuthorizedParties } from './clerkAuthorizedParties.js';

function isPlaceholderClerkKey(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('placeholder') || lower.includes('changeme') || lower.includes('your_key');
}

function hasClerkKeyPrefix(value: string, kind: 'pk' | 'sk'): boolean {
  const prefixes = [`${kind}_test_`, `${kind}_live_`] as const;
  return prefixes.some((prefix) => value.startsWith(prefix) && value.length > prefix.length);
}

export function isClerkConfigured(): boolean {
  const publishable = process.env.CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  const secret = process.env.CLERK_SECRET_KEY?.trim() ?? '';
  if (!publishable && !secret) return false;
  if (
    isPlaceholderClerkKey(publishable) ||
    isPlaceholderClerkKey(secret) ||
    !hasClerkKeyPrefix(publishable, 'pk') ||
    !hasClerkKeyPrefix(secret, 'sk')
  ) {
    throw new Error(
      '[FATAL] Clerk keys look invalid or like placeholders. Use real pk_test_/pk_live_ and sk_test_/sk_live_ values, or leave both empty for unauthenticated local dev.',
    );
  }
  return true;
}

export function clerkMiddleware(): RequestHandler {
  if (!isClerkConfigured()) {
    return (_req, _res, next) => next();
  }
  return clerkExpressMiddleware({ authorizedParties: getClerkAuthorizedParties() });
}
