import { describe, expect, it } from 'vitest';

import {
  ALLOWED_CURRENCIES,
  clampPlanYear,
  invalidFieldsBody,
  isNonNegativeInteger,
  normalizeComment,
  normalizeCurrency,
  normalizeName,
  validateEntryBody,
} from './planValidation.js';

describe('normalizeCurrency', () => {
  it('accepts the allowlist and falls back when empty', () => {
    expect(normalizeCurrency(undefined, 'EUR')).toBe('EUR');
    expect(normalizeCurrency('usd', 'EUR')).toBe('USD');
    expect(ALLOWED_CURRENCIES).toContain('CHF');
  });

  it('rejects unknown codes', () => {
    expect(normalizeCurrency('XXX', 'EUR')).toBeNull();
    expect(normalizeCurrency(12, 'EUR')).toBeNull();
  });
});

describe('normalizeName', () => {
  it('trims and rejects empty or oversized names', () => {
    expect(normalizeName('  Rent  ')).toBe('Rent');
    expect(normalizeName('')).toBeNull();
    expect(normalizeName('x'.repeat(121))).toBeNull();
    expect(normalizeName(undefined, 'Household')).toBe('Household');
  });
});

describe('normalizeComment', () => {
  it('keeps fallback, trims, and rejects oversized comments', () => {
    expect(normalizeComment(undefined, 'keep')).toBe('keep');
    expect(normalizeComment('  note  ', null)).toBe('note');
    expect(normalizeComment('x'.repeat(2001), null)).toBeNull();
  });
});

describe('clampPlanYear', () => {
  it('clamps to 2000–2100', () => {
    expect(clampPlanYear(1999, 2026)).toBe(2000);
    expect(clampPlanYear(2101, 2026)).toBe(2100);
    expect(clampPlanYear(2026, 2000)).toBe(2026);
    expect(clampPlanYear(Number.NaN, 2026)).toBe(2026);
  });
});

describe('isNonNegativeInteger', () => {
  it('accepts only whole numbers >= 0', () => {
    expect(isNonNegativeInteger(0)).toBe(true);
    expect(isNonNegativeInteger(150)).toBe(true);
    expect(isNonNegativeInteger(-1)).toBe(false);
    expect(isNonNegativeInteger(1.5)).toBe(false);
  });
});

describe('validateEntryBody', () => {
  const valid = {
    name: 'Rent',
    amount_cents: 1000,
    kind: 'expense',
    frequency: 'monthly',
    due_day: 1,
    category_id: 'cat-1',
  };

  it('accepts a complete monthly entry', () => {
    expect(validateEntryBody(valid)).toEqual([]);
  });

  it('requires integer due_month/due_year and non-negative final_amount_cents', () => {
    expect(validateEntryBody({ ...valid, due_month: 1.5 })).toContain('due_month');
    expect(validateEntryBody({ ...valid, due_year: 1999 })).toContain('due_year');
    expect(validateEntryBody({ ...valid, final_amount_cents: -1 })).toContain('final_amount_cents');
    expect(validateEntryBody({ ...valid, final_amount_cents: 1.2 })).toContain('final_amount_cents');
    expect(validateEntryBody({ ...valid, final_amount_cents: 0 })).toEqual([]);
  });

  it('validates only provided fields when partial', () => {
    expect(validateEntryBody({ amount_cents: 50 }, true)).toEqual([]);
    expect(validateEntryBody({ amount_cents: -1 }, true)).toEqual(['amount_cents']);
  });

  it('rejects malformed end_date values', () => {
    expect(validateEntryBody({ ...valid, end_date: '03/2028' })).toContain('end_date');
    expect(validateEntryBody({ ...valid, end_date: '2028-13-01' })).toContain('end_date');
    expect(validateEntryBody({ ...valid, end_date: '2028-03-01' })).toEqual([]);
    expect(validateEntryBody({ ...valid, end_date: null })).toEqual([]);
  });
});

describe('invalidFieldsBody', () => {
  it('returns a stable error code plus the field list', () => {
    expect(invalidFieldsBody(['name', 'due_day'])).toEqual({
      error: 'Invalid fields',
      fields: ['name', 'due_day'],
    });
  });
});
