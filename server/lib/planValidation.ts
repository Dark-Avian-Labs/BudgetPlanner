import { parseIsoDate } from '../../shared/dueThisMonth.js';
import { MAX_PLAN_YEAR, MIN_PLAN_YEAR } from '../../shared/planMonth.js';

export const ALLOWED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK'] as const;
export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

export const MAX_NAME_LENGTH = 120;
export const MAX_COMMENT_LENGTH = 2000;
export const MIN_YEAR = MIN_PLAN_YEAR;
export const MAX_YEAR = MAX_PLAN_YEAR;

const ALLOWED_CURRENCY_SET = new Set<string>(ALLOWED_CURRENCIES);

export function isAllowedCurrency(value: string): value is AllowedCurrency {
  return ALLOWED_CURRENCY_SET.has(value);
}

export function normalizeCurrency(value: unknown, fallback: string): string | null {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  if (!isAllowedCurrency(code)) return null;
  return code;
}

export function normalizeName(value: unknown, fallback?: string): string | null {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  return name;
}

export function normalizeComment(value: unknown, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const comment = value.trim();
  if (comment.length > MAX_COMMENT_LENGTH) return null;
  return comment || null;
}

export function clampPlanYear(year: number, fallback: number): number {
  if (!Number.isInteger(year)) return fallback;
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function validateEntryBody(body: Record<string, unknown>, partial = false): string[] {
  const errors: string[] = [];
  if (!partial || body.name !== undefined) {
    if (normalizeName(body.name) == null) errors.push('name');
  }
  if (!partial || body.amount_cents !== undefined) {
    if (!isNonNegativeInteger(body.amount_cents)) errors.push('amount_cents');
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
    if (
      typeof body.due_day !== 'number' ||
      !Number.isInteger(body.due_day) ||
      body.due_day < 1 ||
      body.due_day > 31
    ) {
      errors.push('due_day');
    }
  }
  if (!partial || body.category_id !== undefined) {
    if (typeof body.category_id !== 'string' || !body.category_id) errors.push('category_id');
  }
  if (body.due_month !== undefined && body.due_month !== null) {
    if (
      typeof body.due_month !== 'number' ||
      !Number.isInteger(body.due_month) ||
      body.due_month < 1 ||
      body.due_month > 12
    ) {
      errors.push('due_month');
    }
  }
  if (body.due_year !== undefined && body.due_year !== null) {
    if (
      typeof body.due_year !== 'number' ||
      !Number.isInteger(body.due_year) ||
      body.due_year < MIN_YEAR ||
      body.due_year > MAX_YEAR
    ) {
      errors.push('due_year');
    }
  }
  if (body.final_amount_cents !== undefined && body.final_amount_cents !== null) {
    if (!isNonNegativeInteger(body.final_amount_cents)) errors.push('final_amount_cents');
  }
  if (body.comment !== undefined && body.comment !== null) {
    if (normalizeComment(body.comment, null) == null && typeof body.comment === 'string') {
      errors.push('comment');
    } else if (typeof body.comment !== 'string') {
      errors.push('comment');
    }
  }
  if (body.end_date !== undefined && body.end_date !== null && body.end_date !== '') {
    if (typeof body.end_date !== 'string' || parseIsoDate(body.end_date) == null) {
      errors.push('end_date');
    }
  }
  return errors;
}

export function invalidFieldsBody(fields: string[]): { error: 'Invalid fields'; fields: string[] } {
  return { error: 'Invalid fields', fields };
}
