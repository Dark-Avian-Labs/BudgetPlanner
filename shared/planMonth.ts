export const MIN_PLAN_YEAR = 2000;
export const MAX_PLAN_YEAR = 2100;

export interface PlanMonth {
  year: number;
  month: number;
}

export function calendarMonth(now = new Date()): PlanMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isSameMonth(a: PlanMonth, b: PlanMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

export function clampPlanMonth(year: number, month: number, fallback: PlanMonth): PlanMonth {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return fallback;
  const clampedMonth = Math.min(12, Math.max(1, month));
  const clampedYear = Math.min(MAX_PLAN_YEAR, Math.max(MIN_PLAN_YEAR, year));
  return { year: clampedYear, month: clampedMonth };
}

export function shiftMonth(year: number, month: number, delta: number): PlanMonth {
  const zero = year * 12 + (month - 1) + delta;
  const minZero = MIN_PLAN_YEAR * 12;
  const maxZero = MAX_PLAN_YEAR * 12 + 11;
  const clamped = Math.min(maxZero, Math.max(minZero, zero));
  const nextYear = Math.floor(clamped / 12);
  return { year: nextYear, month: clamped - nextYear * 12 + 1 };
}

export function monthKey(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(value: string): PlanMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (year < MIN_PLAN_YEAR || year > MAX_PLAN_YEAR) return null;
  return { year, month };
}

export function formatMonthLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}
