import type { EntryFrequency } from './types';

export function formatMoney(
  amountCents: number,
  currency: string,
  locale: string,
  signed = false,
): string {
  const value = amountCents / 100;
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Math.abs(value));

  if (!signed) return formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function formatDueDay(day: number, locale: string): string {
  // Prefer compact day label; German docs used "01." style
  const padded = String(day).padStart(2, '0');
  if (locale.startsWith('de')) return `${padded}.`;
  return padded;
}

/** Numeric day+month, e.g. de: "10.08." / en: "10/08". */
export function formatDueMonthDay(month: number, day: number, locale: string): string {
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  if (locale.startsWith('de')) return `${d}.${m}.`;
  return `${d}/${m}`;
}

export function frequencyNumber(frequency: EntryFrequency): 1 | 3 | 6 | 12 | 0 {
  if (frequency === 'once') return 0;
  if (frequency === 'monthly') return 1;
  if (frequency === 'quarterly') return 3;
  if (frequency === 'halfyearly') return 6;
  return 12;
}

export function parseAmountToCents(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function centsToInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}
