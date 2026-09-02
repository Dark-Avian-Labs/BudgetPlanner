export const ACCOUNT_COLORS = [
  'red',
  'orange',
  'gold',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;

export type AccountColor = (typeof ACCOUNT_COLORS)[number];

export const DEFAULT_ACCOUNT_COLOR: AccountColor = 'blue';

/** Old picker names → closest rarity hue. Sky and indigo both sit nearer blue than teal/purple. */
const LEGACY_ACCOUNT_COLORS: Record<string, AccountColor> = {
  rose: 'red',
  amber: 'gold',
  lime: 'green',
  sky: 'blue',
  indigo: 'blue',
  violet: 'purple',
  fuchsia: 'pink',
};

export function isAccountColor(value: unknown): value is AccountColor {
  return typeof value === 'string' && (ACCOUNT_COLORS as readonly string[]).includes(value);
}

export function remapAccountColor(value: unknown): AccountColor | null {
  if (typeof value !== 'string') return null;
  if (isAccountColor(value)) return value;
  return LEGACY_ACCOUNT_COLORS[value] ?? null;
}

export function nextAccountColor(used: readonly string[]): AccountColor {
  const taken = new Set(used.filter(isAccountColor));
  const free = ACCOUNT_COLORS.find((c) => !taken.has(c));
  if (free) return free;
  return ACCOUNT_COLORS[used.length % ACCOUNT_COLORS.length]!;
}
