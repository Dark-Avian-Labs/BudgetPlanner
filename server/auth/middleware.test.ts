import { afterEach, describe, expect, it } from 'vitest';

import { isClerkConfigured } from './middleware.js';

describe('isClerkConfigured', () => {
  const previousPublishable = process.env.CLERK_PUBLISHABLE_KEY;
  const previousSecret = process.env.CLERK_SECRET_KEY;

  afterEach(() => {
    if (previousPublishable === undefined) delete process.env.CLERK_PUBLISHABLE_KEY;
    else process.env.CLERK_PUBLISHABLE_KEY = previousPublishable;
    if (previousSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previousSecret;
  });

  it('returns false when both keys are empty', () => {
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    expect(isClerkConfigured()).toBe(false);
  });

  it('rejects bare pk_test_ and sk_test_ prefixes', () => {
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_';
    process.env.CLERK_SECRET_KEY = 'sk_test_abc';
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });

  it('rejects a secret that is only sk_live_', () => {
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_live_abc';
    process.env.CLERK_SECRET_KEY = 'sk_live_';
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });

  it('rejects placeholder keys', () => {
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });
});
