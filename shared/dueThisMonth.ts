export type DueEntryKind = 'expense' | 'income' | 'credit';
export type DueEntryFrequency = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'once';

export interface DueEntryInput {
  kind: DueEntryKind;
  frequency: DueEntryFrequency;
  amount_cents: number;
  due_day: number;
  due_month: number | null;
  due_year?: number | null;
  end_date: string | null;
  final_amount_cents: number | null;
}

export interface MonthTotals {
  expenseCents: number;
  incomeCents: number;
  netCents: number;
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function isDueInMonth(
  entry: Pick<DueEntryInput, 'frequency' | 'due_month' | 'due_year' | 'end_date'>,
  year: number,
  month: number,
): boolean {
  if (entry.end_date) {
    const end = parseIsoDate(entry.end_date);
    if (end) {
      const endKey = end.year * 12 + end.month;
      const curKey = year * 12 + month;
      if (curKey > endKey) return false;
    }
  }

  if (entry.frequency === 'monthly') return true;

  const anchor = entry.due_month;
  if (anchor == null) return false;

  if (entry.frequency === 'once') {
    const dueYear = entry.due_year;
    if (dueYear == null) return false;
    return year === dueYear && month === anchor;
  }

  if (entry.frequency === 'yearly') {
    return month === anchor;
  }

  const delta = (((month - anchor) % 12) + 12) % 12;
  if (entry.frequency === 'quarterly') return delta % 3 === 0;
  if (entry.frequency === 'halfyearly') return delta % 6 === 0;
  return false;
}

export function amountForMonth(entry: DueEntryInput, year: number, month: number): number | null {
  if (!isDueInMonth(entry, year, month)) return null;

  if (entry.kind === 'credit' && entry.end_date && entry.final_amount_cents != null) {
    const end = parseIsoDate(entry.end_date);
    if (end && end.year === year && end.month === month) {
      return entry.final_amount_cents;
    }
  }

  return entry.amount_cents;
}

export function computeMonthTotals(
  entries: DueEntryInput[],
  year: number,
  month: number,
): MonthTotals {
  let expenseCents = 0;
  let incomeCents = 0;

  for (const entry of entries) {
    const amount = amountForMonth(entry, year, month);
    if (amount == null) continue;
    if (entry.kind === 'income') {
      incomeCents += amount;
    } else {
      expenseCents += amount;
    }
  }

  return {
    expenseCents,
    incomeCents,
    netCents: incomeCents - expenseCents,
  };
}

export function frequencyMonths(frequency: DueEntryFrequency): 1 | 3 | 6 | 12 | 0 {
  if (frequency === 'once') return 0;
  if (frequency === 'monthly') return 1;
  if (frequency === 'quarterly') return 3;
  if (frequency === 'halfyearly') return 6;
  return 12;
}

export function isOnceEntryExpired(
  entry: Pick<DueEntryInput, 'frequency' | 'due_month' | 'due_year'>,
  year: number,
  month: number,
): boolean {
  if (entry.frequency !== 'once') return false;
  if (entry.due_month == null || entry.due_year == null) return true;
  return entry.due_year * 12 + entry.due_month < year * 12 + month;
}
