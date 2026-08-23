import { frequencyNumber } from './dueThisMonth';

export { frequencyNumber };

export function formatMoney(
  amountCents: number,
  currency: string,
  locale: string,
  signed = false,
): string {
  const value = amountCents / 100;
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(Math.abs(value));
  } catch {
    formatted = `${Math.abs(value).toFixed(2)} ${currency}`;
  }

  if (!signed) return formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function formatDueDay(day: number, locale: string): string {
  const padded = String(day).padStart(2, '0');
  if (locale.startsWith('de')) return `${padded}.`;
  return padded;
}

export function formatDueMonthDay(month: number, day: number, locale: string): string {
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  if (locale.startsWith('de')) return `${d}.${m}.`;
  return `${d}/${m}`;
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
