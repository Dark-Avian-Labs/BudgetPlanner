import { describe, expect, it } from 'vitest';

import { amountForMonth, computeMonthTotals, isDueInMonth, isOnceEntryExpired } from '../../shared/dueThisMonth.js';

describe('isDueInMonth', () => {
  it('includes monthly entries every month', () => {
    expect(isDueInMonth({ frequency: 'monthly', due_month: null, end_date: null }, 2026, 8)).toBe(true);
  });

  it('includes quarterly only on cadence months', () => {
    const entry = { frequency: 'quarterly' as const, due_month: 4, end_date: null };
    expect(isDueInMonth(entry, 2026, 4)).toBe(true);
    expect(isDueInMonth(entry, 2026, 7)).toBe(true);
    expect(isDueInMonth(entry, 2026, 8)).toBe(false);
  });

  it('includes halfyearly only every 6 months from anchor', () => {
    const entry = { frequency: 'halfyearly' as const, due_month: 2, end_date: null };
    expect(isDueInMonth(entry, 2026, 2)).toBe(true);
    expect(isDueInMonth(entry, 2026, 8)).toBe(true);
    expect(isDueInMonth(entry, 2026, 5)).toBe(false);
    expect(isDueInMonth(entry, 2026, 11)).toBe(false);
  });

  it('includes once only in the exact due year and month', () => {
    const entry = {
      frequency: 'once' as const,
      due_month: 8,
      due_year: 2026,
      end_date: null,
    };
    expect(isDueInMonth(entry, 2026, 8)).toBe(true);
    expect(isDueInMonth(entry, 2026, 9)).toBe(false);
    expect(isDueInMonth(entry, 2027, 8)).toBe(false);
  });

  it('marks once entries expired after their due month', () => {
    const entry = { frequency: 'once' as const, due_month: 8, due_year: 2026 };
    expect(isOnceEntryExpired(entry, 2026, 8)).toBe(false);
    expect(isOnceEntryExpired(entry, 2026, 9)).toBe(true);
    expect(isOnceEntryExpired(entry, 2027, 1)).toBe(true);
  });

  it('includes yearly only in anchor month', () => {
    const entry = { frequency: 'yearly' as const, due_month: 1, end_date: null };
    expect(isDueInMonth(entry, 2026, 1)).toBe(true);
    expect(isDueInMonth(entry, 2026, 8)).toBe(false);
  });

  it('excludes credits after end_date', () => {
    const entry = {
      frequency: 'monthly' as const,
      due_month: null,
      end_date: '2028-03-01',
    };
    expect(isDueInMonth(entry, 2028, 3)).toBe(true);
    expect(isDueInMonth(entry, 2028, 4)).toBe(false);
  });
});

describe('amountForMonth', () => {
  it('uses final_amount_cents in the credit end month', () => {
    const entry = {
      kind: 'credit' as const,
      frequency: 'monthly' as const,
      amount_cents: 95_000,
      due_day: 1,
      due_month: null,
      end_date: '2028-03-01',
      final_amount_cents: 89_197,
    };
    expect(amountForMonth(entry, 2028, 2)).toBe(95_000);
    expect(amountForMonth(entry, 2028, 3)).toBe(89_197);
    expect(amountForMonth(entry, 2028, 4)).toBeNull();
  });
});

describe('computeMonthTotals', () => {
  it('sums only entries due this month', () => {
    const totals = computeMonthTotals(
      [
        {
          kind: 'expense',
          frequency: 'monthly',
          amount_cents: 100_00,
          due_day: 1,
          due_month: null,
          end_date: null,
          final_amount_cents: null,
        },
        {
          kind: 'expense',
          frequency: 'yearly',
          amount_cents: 500_00,
          due_day: 1,
          due_month: 1,
          end_date: null,
          final_amount_cents: null,
        },
        {
          kind: 'income',
          frequency: 'monthly',
          amount_cents: 300_000,
          due_day: 1,
          due_month: null,
          end_date: null,
          final_amount_cents: null,
        },
      ],
      2026,
      8,
    );
    expect(totals.expenseCents).toBe(100_00);
    expect(totals.incomeCents).toBe(300_000);
    expect(totals.netCents).toBe(300_000 - 100_00);
  });
});
