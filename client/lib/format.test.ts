import { describe, expect, it } from 'vitest';

import { parseAmountToCents } from './format';

describe('parseAmountToCents', () => {
  it('converts euro strings to integer cents', () => {
    expect(parseAmountToCents('12.34')).toBe(1234);
    expect(parseAmountToCents('0.09')).toBe(9);
  });

  it('rejects cent totals outside the safe-integer range', () => {
    expect(parseAmountToCents('9007199254740991.99')).toBeNull();
  });
});
