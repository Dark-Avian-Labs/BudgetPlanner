/** Client-side mirror of server due-this-month rules for list highlighting. */
import type { Entry, EntryFrequency } from './types';

function parseIsoDate(iso: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isDueInMonth(
  entry: Pick<Entry, 'frequency' | 'due_month' | 'due_year' | 'end_date'>,
  year: number,
  month: number,
): boolean {
  if (entry.end_date) {
    const end = parseIsoDate(entry.end_date);
    if (end) {
      if (year * 12 + month > end.year * 12 + end.month) return false;
    }
  }

  if (entry.frequency === 'monthly') return true;
  const anchor = entry.due_month;
  if (anchor == null) return false;
  if (entry.frequency === 'once') {
    if (entry.due_year == null) return false;
    return year === entry.due_year && month === anchor;
  }
  if (entry.frequency === 'yearly') return month === anchor;
  const delta = (((month - anchor) % 12) + 12) % 12;
  if (entry.frequency === 'quarterly') return delta % 3 === 0;
  if (entry.frequency === 'halfyearly') return delta % 6 === 0;
  return false;
}

export function amountForMonth(entry: Entry, year: number, month: number): number | null {
  if (!isDueInMonth(entry, year, month)) return null;
  if (entry.kind === 'credit' && entry.end_date && entry.final_amount_cents != null) {
    const end = parseIsoDate(entry.end_date);
    if (end && end.year === year && end.month === month) return entry.final_amount_cents;
  }
  return entry.amount_cents;
}

export function frequencyNumber(frequency: EntryFrequency): 1 | 3 | 6 | 12 | 0 {
  if (frequency === 'once') return 0;
  if (frequency === 'monthly') return 1;
  if (frequency === 'quarterly') return 3;
  if (frequency === 'halfyearly') return 6;
  return 12;
}
