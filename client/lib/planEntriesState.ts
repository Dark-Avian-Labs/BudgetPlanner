import { computeMonthTotals } from './dueThisMonth';
import type { Entry, PlanDetail } from './types';

export function isEntryVisibleInMonth(entry: Entry, year: number, month: number): boolean {
  if (entry.archived_at == null) return true;
  return entry.frequency === 'once' && entry.due_year === year && entry.due_month === month;
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function withTotals(prev: PlanDetail, entries: Entry[]): PlanDetail {
  return {
    ...prev,
    entries,
    totals: computeMonthTotals(entries, prev.month.year, prev.month.month),
  };
}

export function applyEntryToPlan(prev: PlanDetail, entry: Entry): PlanDetail {
  const without = prev.entries.filter((row) => row.id !== entry.id);
  const visible = isEntryVisibleInMonth(entry, prev.month.year, prev.month.month);
  const entries = visible ? sortEntries([...without, entry]) : without;
  return withTotals(prev, entries);
}

export function removeEntryFromPlan(prev: PlanDetail, entryId: string): PlanDetail {
  return withTotals(
    prev,
    prev.entries.filter((row) => row.id !== entryId),
  );
}
