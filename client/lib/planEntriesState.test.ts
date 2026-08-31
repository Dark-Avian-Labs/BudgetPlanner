import { describe, expect, it } from 'vitest';

import { applyEntryToPlan, removeEntryFromPlan } from './planEntriesState';
import type { Entry, PlanDetail } from './types';

function entry(overrides: Partial<Entry> & Pick<Entry, 'id' | 'name'>): Entry {
  return {
    plan_id: 'p1',
    category_id: 'cat1',
    account_id: null,
    amount_cents: 1000,
    kind: 'expense',
    frequency: 'monthly',
    due_day: 1,
    due_month: null,
    due_year: null,
    comment: null,
    end_date: null,
    final_amount_cents: null,
    archived_at: null,
    sort_order: 0,
    ...overrides,
  };
}

function plan(entries: Entry[]): PlanDetail {
  return {
    plan: { id: 'p1', name: 'Home', currency: 'EUR', owner_user_id: 'u1' },
    role: 'owner',
    categories: [],
    accounts: [],
    entries,
    totals: { expenseCents: 0, incomeCents: 0, netCents: 0 },
    month: { year: 2026, month: 8 },
    members: [],
    pendingInvites: [],
  };
}

describe('applyEntryToPlan', () => {
  it('inserts a new monthly entry and recomputes totals', () => {
    const next = applyEntryToPlan(plan([]), entry({ id: 'e1', name: 'Rent', amount_cents: 500 }));
    expect(next.entries.map((row) => row.id)).toEqual(['e1']);
    expect(next.totals.expenseCents).toBe(500);
  });

  it('drops a once entry archived for a different month', () => {
    const current = entry({ id: 'e1', name: 'July fee', frequency: 'once', due_month: 7, due_year: 2026 });
    const archived = {
      ...current,
      archived_at: '2026-08-01 00:00:00',
    };
    const next = applyEntryToPlan(plan([current]), archived);
    expect(next.entries).toEqual([]);
    expect(next.totals.expenseCents).toBe(0);
  });

  it('keeps an archived once entry when viewing its due month', () => {
    const archived = entry({
      id: 'e1',
      name: 'August fee',
      frequency: 'once',
      due_month: 8,
      due_year: 2026,
      archived_at: '2026-09-01 00:00:00',
      amount_cents: 250,
    });
    const next = applyEntryToPlan(plan([]), archived);
    expect(next.entries).toHaveLength(1);
    expect(next.totals.expenseCents).toBe(250);
  });
});

describe('removeEntryFromPlan', () => {
  it('removes the row and recomputes totals', () => {
    const keep = entry({ id: 'keep', name: 'Keep', amount_cents: 100, sort_order: 0 });
    const gone = entry({ id: 'gone', name: 'Gone', amount_cents: 400, sort_order: 1 });
    const next = removeEntryFromPlan(plan([keep, gone]), 'gone');
    expect(next.entries.map((row) => row.id)).toEqual(['keep']);
    expect(next.totals.expenseCents).toBe(100);
  });
});
