import { describe, expect, it } from 'vitest';

import { entryPayloadFieldErrors, type EntryPayload } from './entryPayload';

const valid: EntryPayload = {
  name: 'Rent',
  amount_cents: 120000,
  kind: 'expense',
  frequency: 'monthly',
  due_day: 1,
  due_month: null,
  due_year: null,
  category_id: 'cat-1',
  account_id: null,
  comment: null,
  end_date: null,
  final_amount_cents: null,
};

describe('entryPayloadFieldErrors', () => {
  it('accepts a complete monthly entry', () => {
    expect(entryPayloadFieldErrors(valid)).toEqual([]);
  });

  it('flags empty names and out-of-range due days', () => {
    expect(entryPayloadFieldErrors({ ...valid, name: '' })).toEqual(['name']);
    expect(entryPayloadFieldErrors({ ...valid, due_day: 0 })).toEqual(['due_day']);
  });

  it('requires due_month and due_year for a one-time entry', () => {
    expect(
      entryPayloadFieldErrors({
        ...valid,
        frequency: 'once',
        due_month: null,
        due_year: null,
      }),
    ).toEqual(['due_month', 'due_year']);
  });

  it('rejects a malformed end_date', () => {
    expect(entryPayloadFieldErrors({ ...valid, end_date: '03/2028' })).toEqual(['end_date']);
  });
});
