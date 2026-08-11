export type MemberRole = 'owner' | 'editor' | 'viewer';
export type EntryKind = 'expense' | 'income' | 'credit';
export type EntryFrequency = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'once';

export interface PlanSummary {
  id: string;
  name: string;
  currency: string;
  owner_user_id: string;
  role: MemberRole;
}

export interface Category {
  id: string;
  plan_id: string;
  name: string;
  sort_order: number;
}

export interface Account {
  id: string;
  plan_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface Entry {
  id: string;
  plan_id: string;
  category_id: string;
  account_id: string | null;
  name: string;
  amount_cents: number;
  kind: EntryKind;
  frequency: EntryFrequency;
  due_day: number;
  due_month: number | null;
  due_year: number | null;
  comment: string | null;
  end_date: string | null;
  final_amount_cents: number | null;
  sort_order: number;
}

export interface MonthTotals {
  expenseCents: number;
  incomeCents: number;
  netCents: number;
}

export interface PlanDetail {
  plan: {
    id: string;
    name: string;
    currency: string;
    owner_user_id: string;
  };
  role: MemberRole;
  categories: Category[];
  accounts: Account[];
  entries: Entry[];
  totals: MonthTotals;
  month: { year: number; month: number };
}

export interface Me {
  id: string;
  email: string;
  locale: string;
  defaultPlanId: string | null;
}

export function canEdit(role: MemberRole): boolean {
  return role === 'owner' || role === 'editor';
}
