export const ACCOUNT_COLORS = [
  'rose',
  'orange',
  'amber',
  'lime',
  'teal',
  'sky',
  'indigo',
  'violet',
  'fuchsia',
] as const;

export type AccountColor = (typeof ACCOUNT_COLORS)[number];

export function isAccountColor(value: unknown): value is AccountColor {
  return typeof value === 'string' && (ACCOUNT_COLORS as readonly string[]).includes(value);
}

export function nextAccountColor(used: readonly string[]): AccountColor {
  const taken = new Set(used.filter(isAccountColor));
  const free = ACCOUNT_COLORS.find((c) => !taken.has(c));
  if (free) return free;
  return ACCOUNT_COLORS[used.length % ACCOUNT_COLORS.length]!;
}
