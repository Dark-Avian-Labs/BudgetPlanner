import { parseIsoDate } from './dueThisMonth';

const MAX_NAME_LENGTH = 120;
const MAX_COMMENT_LENGTH = 2000;

export type EntryPayload = {
  name: string;
  amount_cents: number;
  kind: string;
  frequency: string;
  due_day: number;
  due_month: number | null;
  due_year: number | null;
  category_id: string;
  account_id: string | null;
  comment: string | null;
  end_date: string | null;
  final_amount_cents: number | null;
};

export function entryPayloadFieldErrors(payload: EntryPayload): string[] {
  const fields: string[] = [];
  if (!payload.name || payload.name.length > MAX_NAME_LENGTH) fields.push('name');
  if (!Number.isInteger(payload.amount_cents) || payload.amount_cents < 0) {
    fields.push('amount_cents');
  }
  if (!['expense', 'income', 'credit'].includes(payload.kind)) fields.push('kind');
  if (!['monthly', 'quarterly', 'halfyearly', 'yearly', 'once'].includes(payload.frequency)) {
    fields.push('frequency');
  }
  if (!Number.isInteger(payload.due_day) || payload.due_day < 1 || payload.due_day > 31) {
    fields.push('due_day');
  }
  if (!payload.category_id) fields.push('category_id');
  if (payload.frequency !== 'monthly') {
    if (
      payload.due_month == null ||
      !Number.isInteger(payload.due_month) ||
      payload.due_month < 1 ||
      payload.due_month > 12
    ) {
      fields.push('due_month');
    }
  }
  if (payload.frequency === 'once') {
    if (payload.due_year == null || !Number.isInteger(payload.due_year)) {
      fields.push('due_year');
    }
  }
  if (payload.comment != null && payload.comment.length > MAX_COMMENT_LENGTH) {
    fields.push('comment');
  }
  if (payload.end_date != null && parseIsoDate(payload.end_date) == null) {
    fields.push('end_date');
  }
  if (
    payload.final_amount_cents != null &&
    (!Number.isInteger(payload.final_amount_cents) || payload.final_amount_cents < 0)
  ) {
    fields.push('final_amount_cents');
  }
  return fields;
}
