import { describe, expect, it } from 'vitest';

import { ACCOUNT_COLORS, nextAccountColor, remapAccountColor } from './accountColors.js';

describe('remapAccountColor', () => {
  it('maps legacy picker names to the closest rarity hue', () => {
    expect(remapAccountColor('rose')).toBe('red');
    expect(remapAccountColor('amber')).toBe('gold');
    expect(remapAccountColor('lime')).toBe('green');
    expect(remapAccountColor('sky')).toBe('blue');
    expect(remapAccountColor('indigo')).toBe('blue');
    expect(remapAccountColor('violet')).toBe('purple');
    expect(remapAccountColor('fuchsia')).toBe('pink');
  });

  it('keeps ladder names', () => {
    for (const color of ACCOUNT_COLORS) {
      expect(remapAccountColor(color)).toBe(color);
    }
  });
});

describe('nextAccountColor', () => {
  it('skips taken ladder colors', () => {
    expect(nextAccountColor(['red', 'orange'])).toBe('gold');
  });
});
