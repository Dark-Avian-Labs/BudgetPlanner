import { describe, expect, it } from 'vitest';

import {
  calendarMonth,
  clampPlanMonth,
  enumerateMonths,
  monthKey,
  parseMonthKey,
  shiftMonth,
} from '../../shared/planMonth.js';

describe('shiftMonth', () => {
  it('steps into the next year', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('steps into the previous year', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('clamps at the allowed range', () => {
    expect(shiftMonth(2000, 1, -1)).toEqual({ year: 2000, month: 1 });
    expect(shiftMonth(2100, 12, 1)).toEqual({ year: 2100, month: 12 });
  });
});

describe('clampPlanMonth', () => {
  const fallback = { year: 2026, month: 8 };

  it('keeps a valid month', () => {
    expect(clampPlanMonth(2026, 9, fallback)).toEqual({ year: 2026, month: 9 });
  });

  it('falls back on non-integers', () => {
    expect(clampPlanMonth(Number.NaN, 9, fallback)).toEqual(fallback);
    expect(clampPlanMonth(2026, 9.5, fallback)).toEqual(fallback);
  });

  it('clamps out-of-range month and year', () => {
    expect(clampPlanMonth(1999, 0, fallback)).toEqual({ year: 2000, month: 1 });
    expect(clampPlanMonth(2200, 15, fallback)).toEqual({ year: 2100, month: 12 });
  });
});

describe('monthKey', () => {
  it('round-trips with parseMonthKey', () => {
    expect(parseMonthKey(monthKey(2026, 8))).toEqual({ year: 2026, month: 8 });
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('nope')).toBeNull();
  });
});

describe('calendarMonth', () => {
  it('reads year and 1-based month from a Date', () => {
    expect(calendarMonth(new Date(2026, 7, 31))).toEqual({ year: 2026, month: 8 });
  });
});

describe('enumerateMonths', () => {
  it('lists inclusive months wrapping a year boundary', () => {
    expect(enumerateMonths({ year: 2026, month: 11 }, { year: 2027, month: 2 })).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });
});
