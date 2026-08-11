import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { AccountColorPicker } from '../../components/budget/AccountColorPicker';
import { FrequencyBadge } from '../../components/budget/FrequencyBadge';
import { RequireAuth } from '../../components/Layout/Layout';
import { Button } from '../../components/ui/Button';
import { FormSelect } from '../../components/ui/FormSelect';
import { Input } from '../../components/ui/Input';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Modal } from '../../components/ui/Modal';
import { isAccountColor, nextAccountColor, type AccountColor } from '../../lib/accountColors';
import { centsToInput, formatMoney, parseAmountToCents } from '../../lib/format';
import {
  canEdit,
  type Account,
  type Category,
  type Entry,
  type EntryFrequency,
  type EntryKind,
  type PlanDetail,
} from '../../lib/types';
import { apiJson } from '../../utils/api';
import { AccountBreakdownView } from './AccountBreakdownView';
import { PlanListView } from './PlanListView';
import { PrintView } from './PrintView';

type SheetMode = 'closed' | 'details' | 'edit' | 'create' | 'invite';
type FieldEditor = 'closed' | 'add' | 'rename';
type PlanViewMode = 'list' | 'breakdown' | 'print';
type PendingDelete =
  | null
  | { kind: 'category'; id: string; name: string; entryCount: number }
  | { kind: 'account'; id: string; name: string };

interface EntryFormState {
  name: string;
  amount: string;
  kind: EntryKind;
  frequency: EntryFrequency;
  due_day: string;
  due_month: string;
  due_year: string;
  category_id: string;
  account_id: string;
  comment: string;
  end_date: string;
  final_amount: string;
}

function emptyForm(categoryId: string): EntryFormState {
  const now = new Date();
  return {
    name: '',
    amount: '',
    kind: 'expense',
    frequency: 'monthly',
    due_day: '1',
    due_month: String(now.getMonth() + 1),
    due_year: String(now.getFullYear()),
    category_id: categoryId,
    account_id: '',
    comment: '',
    end_date: '',
    final_amount: '',
  };
}

function entryToForm(entry: Entry): EntryFormState {
  const now = new Date();
  return {
    name: entry.name,
    amount: centsToInput(entry.amount_cents),
    kind: entry.kind,
    frequency: entry.frequency,
    due_day: String(entry.due_day),
    due_month: String(entry.due_month ?? now.getMonth() + 1),
    due_year: String(entry.due_year ?? now.getFullYear()),
    category_id: entry.category_id,
    account_id: entry.account_id ?? '',
    comment: entry.comment ?? '',
    end_date: entry.end_date ?? '',
    final_amount: entry.final_amount_cents != null ? centsToInput(entry.final_amount_cents) : '',
  };
}

function PlanPageInner() {
  const { planId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizeMode, setOrganizeMode] = useState(false);
  const [viewMode, setViewMode] = useState<PlanViewMode>('list');
  const [sheet, setSheet] = useState<SheetMode>('closed');
  const [selected, setSelected] = useState<Entry | null>(null);
  const [form, setForm] = useState<EntryFormState>(() => emptyForm(''));
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('editor');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<FieldEditor>('closed');
  const [accountEditor, setAccountEditor] = useState<FieldEditor>('closed');
  const [newAccountName, setNewAccountName] = useState('');
  const [accountColorDraft, setAccountColorDraft] = useState<AccountColor>('sky');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const locale = i18n.language;
  const now = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await apiJson<PlanDetail>(
        `/api/plans/${planId}?year=${now.year}&month=${now.month}`,
      );
      setData(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [planId, now.year, now.month]);

  useEffect(() => {
    if (isLoaded && isSignedIn) void load();
  }, [isLoaded, isSignedIn, load]);

  const editable = data ? canEdit(data.role) : false;

  function openDetails(entry: Entry) {
    setSelected(entry);
    setSheet('details');
  }

  function resetFieldEditors() {
    setCategoryEditor('closed');
    setAccountEditor('closed');
    setNewAccountName('');
    setAccountColorDraft('sky');
    setNewCategoryName('');
    setPendingDelete(null);
  }

  function openEdit(entry: Entry) {
    setSelected(entry);
    setForm(entryToForm(entry));
    resetFieldEditors();
    setSheet('edit');
  }

  function openCreate() {
    const firstCat = data?.categories[0]?.id ?? '';
    setSelected(null);
    setForm(emptyForm(firstCat));
    resetFieldEditors();
    setSheet('create');
  }

  function beginRenameCategory() {
    const cat = data?.categories.find((c) => c.id === form.category_id);
    if (!cat) return;
    setAccountEditor('closed');
    setNewCategoryName(cat.name);
    setCategoryEditor('rename');
  }

  function beginRenameAccount() {
    const acc = data?.accounts.find((a) => a.id === form.account_id);
    if (!acc) return;
    setCategoryEditor('closed');
    setNewAccountName(acc.name);
    setAccountColorDraft(isAccountColor(acc.color) ? acc.color : 'sky');
    setAccountEditor('rename');
  }

  async function createAccount() {
    if (!planId || !newAccountName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiJson<{ account: Account }>(`/api/plans/${planId}/accounts`, {
        method: 'POST',
        body: JSON.stringify({ name: newAccountName.trim(), color: accountColorDraft }),
      });
      setData((prev) => (prev ? { ...prev, accounts: [...prev.accounts, result.account] } : prev));
      setForm((f) => ({ ...f, account_id: result.account.id }));
      setNewAccountName('');
      setAccountEditor('closed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setSaving(false);
    }
  }

  async function renameAccount() {
    if (!planId || !form.account_id || !newAccountName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiJson<{ account: Account }>(
        `/api/plans/${planId}/accounts/${form.account_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: newAccountName.trim(), color: accountColorDraft }),
        },
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              accounts: prev.accounts.map((a) => (a.id === result.account.id ? result.account : a)),
            }
          : prev,
      );
      setAccountEditor('closed');
      setNewAccountName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename account');
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    if (!planId || !newCategoryName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiJson<{ category: Category }>(`/api/plans/${planId}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setData((prev) =>
        prev ? { ...prev, categories: [...prev.categories, result.category] } : prev,
      );
      setForm((f) => ({ ...f, category_id: result.category.id }));
      setNewCategoryName('');
      setCategoryEditor('closed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setSaving(false);
    }
  }

  async function renameCategory() {
    if (!planId || !form.category_id || !newCategoryName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiJson<{ category: Category }>(
        `/api/plans/${planId}/categories/${form.category_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: newCategoryName.trim() }),
        },
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              categories: prev.categories.map((c) =>
                c.id === result.category.id ? result.category : c,
              ),
            }
          : prev,
      );
      setCategoryEditor('closed');
      setNewCategoryName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename category');
    } finally {
      setSaving(false);
    }
  }

  function requestDeleteCategory() {
    if (!data || !form.category_id) return;
    if (data.categories.length <= 1) {
      setError(t('plan.cannotDeleteLastCategory'));
      return;
    }
    const cat = data.categories.find((c) => c.id === form.category_id);
    if (!cat) return;
    const entryCount = data.entries.filter((e) => e.category_id === cat.id).length;
    setPendingDelete({
      kind: 'category',
      id: cat.id,
      name: cat.name,
      entryCount,
    });
  }

  function requestDeleteAccount() {
    if (!data || !form.account_id) return;
    const acc = data.accounts.find((a) => a.id === form.account_id);
    if (!acc) return;
    setPendingDelete({ kind: 'account', id: acc.id, name: acc.name });
  }

  async function confirmPendingDelete() {
    if (!planId || !pendingDelete) return;
    setSaving(true);
    setError(null);
    try {
      if (pendingDelete.kind === 'category') {
        await apiJson(`/api/plans/${planId}/categories/${pendingDelete.id}`, {
          method: 'DELETE',
        });
        const nextCategoryId = data?.categories.find((c) => c.id !== pendingDelete.id)?.id ?? '';
        setData((prev) => {
          if (!prev) return prev;
          const categories = prev.categories.filter((c) => c.id !== pendingDelete.id);
          const entries = prev.entries.filter((e) => e.category_id !== pendingDelete.id);
          return { ...prev, categories, entries };
        });
        setForm((f) =>
          f.category_id === pendingDelete.id ? { ...f, category_id: nextCategoryId } : f,
        );
      } else {
        await apiJson(`/api/plans/${planId}/accounts/${pendingDelete.id}`, {
          method: 'DELETE',
        });
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            accounts: prev.accounts.filter((a) => a.id !== pendingDelete.id),
            entries: prev.entries.map((e) =>
              e.account_id === pendingDelete.id ? { ...e, account_id: null } : e,
            ),
          };
        });
        setForm((f) => (f.account_id === pendingDelete.id ? { ...f, account_id: '' } : f));
      }
      setPendingDelete(null);
      setCategoryEditor('closed');
      setAccountEditor('closed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveEntry() {
    if (!planId || !data) return;
    const amount = parseAmountToCents(form.amount);
    if (amount == null) {
      setError('Invalid amount');
      return;
    }
    const payload = {
      name: form.name.trim(),
      amount_cents: amount,
      kind: form.kind,
      frequency: form.frequency,
      due_day: Number(form.due_day),
      due_month: form.frequency === 'monthly' ? null : Number(form.due_month),
      due_year: form.frequency === 'once' ? Number(form.due_year) : null,
      category_id: form.category_id,
      account_id: form.account_id || null,
      comment: form.comment.trim() || null,
      end_date: form.kind === 'credit' && form.end_date ? form.end_date : null,
      final_amount_cents:
        form.kind === 'credit' && form.final_amount ? parseAmountToCents(form.final_amount) : null,
    };

    setSaving(true);
    setError(null);
    try {
      if (sheet === 'edit' && selected) {
        await apiJson(`/api/plans/${planId}/entries/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson(`/api/plans/${planId}/entries`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setSheet('closed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry() {
    if (!planId || !selected) return;
    setSaving(true);
    try {
      await apiJson(`/api/plans/${planId}/entries/${selected.id}`, { method: 'DELETE' });
      setSheet('closed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function applyReorder(next: {
    categories?: Array<{ id: string; sort_order: number }>;
    entries?: Array<{ id: string; sort_order: number; category_id?: string }>;
  }) {
    if (!planId || !data) return;

    setData((prev) => {
      if (!prev) return prev;
      const categories = next.categories
        ? prev.categories.map((c) => {
            const update = next.categories?.find((u) => u.id === c.id);
            return update ? { ...c, sort_order: update.sort_order } : c;
          })
        : prev.categories;
      const entries = next.entries
        ? prev.entries.map((e) => {
            const update = next.entries?.find((u) => u.id === e.id);
            return update
              ? {
                  ...e,
                  sort_order: update.sort_order,
                  category_id: update.category_id ?? e.category_id,
                }
              : e;
          })
        : prev.entries;
      return { ...prev, categories, entries };
    });

    try {
      await apiJson(`/api/plans/${planId}/reorder`, {
        method: 'POST',
        body: JSON.stringify(next),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
      await load();
    }
  }

  async function createInvite() {
    if (!planId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiJson<{
        invite: { acceptPath: string; token: string };
      }>(`/api/plans/${planId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const url = `${window.location.origin}${result.invite.acceptPath}`;
      setInviteLink(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted text-sm">{error ?? t('app.loading')}</p>
      </div>
    );
  }

  const currency = data.plan.currency;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {data.plan.name}
          </h1>
          <p className="text-muted text-sm">{t('plan.thisMonth')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label={t('plan.listView')}>
            <button
              type="button"
              className="icon-toggle-btn"
              aria-pressed={viewMode === 'list'}
              aria-label={t('plan.listView')}
              title={t('plan.listView')}
              onClick={() => setViewMode('list')}
            >
              <MaterialSymbol name="view_list" />
            </button>
            <button
              type="button"
              className="icon-toggle-btn"
              aria-pressed={viewMode === 'breakdown'}
              aria-label={t('plan.breakdown')}
              title={t('plan.breakdown')}
              onClick={() => {
                setOrganizeMode(false);
                setViewMode('breakdown');
              }}
            >
              <MaterialSymbol name="account_balance_wallet" />
            </button>
            <button
              type="button"
              className="icon-toggle-btn"
              aria-pressed={viewMode === 'print'}
              aria-label={t('plan.printView')}
              title={t('plan.printView')}
              onClick={() => {
                setOrganizeMode(false);
                setViewMode('print');
              }}
            >
              <MaterialSymbol name="print" />
            </button>
          </div>
          {editable && viewMode === 'list' ? (
            <>
              <button
                type="button"
                className="icon-toggle-btn"
                aria-pressed={organizeMode}
                aria-label={organizeMode ? t('app.done') : t('app.organize')}
                title={organizeMode ? t('app.done') : t('app.organize')}
                onClick={() => setOrganizeMode((v) => !v)}
              >
                <MaterialSymbol name={organizeMode ? 'check' : 'reorder'} />
              </button>
              {data.role === 'owner' ? (
                <button
                  type="button"
                  className="icon-toggle-btn"
                  aria-label={t('app.invite')}
                  title={t('app.invite')}
                  onClick={() => {
                    setInviteLink(null);
                    setInviteEmail('');
                    setSheet('invite');
                  }}
                >
                  <MaterialSymbol name="person_add" />
                </button>
              ) : null}
            </>
          ) : editable && data.role === 'owner' ? (
            <button
              type="button"
              className="icon-toggle-btn"
              aria-label={t('app.invite')}
              title={t('app.invite')}
              onClick={() => {
                setInviteLink(null);
                setInviteEmail('');
                setSheet('invite');
              }}
            >
              <MaterialSymbol name="person_add" />
            </button>
          ) : null}
        </div>
      </div>

      <section
        className={`glass-surface grid grid-cols-3 gap-2 p-4 text-center ${viewMode === 'print' ? 'no-print' : ''}`}
      >
        <div>
          <div className="text-muted text-xs">{t('plan.income')}</div>
          <div className="text-success mt-1 text-sm font-semibold tabular-nums sm:text-base">
            {formatMoney(data.totals.incomeCents, currency, locale)}
          </div>
        </div>
        <div>
          <div className="text-muted text-xs">{t('plan.expenses')}</div>
          <div className="text-danger mt-1 text-sm font-semibold tabular-nums sm:text-base">
            {formatMoney(data.totals.expenseCents, currency, locale)}
          </div>
        </div>
        <div>
          <div className="text-muted text-xs">{t('plan.net')}</div>
          <div className="text-foreground mt-1 text-sm font-semibold tabular-nums sm:text-base">
            {formatMoney(data.totals.netCents, currency, locale, true)}
          </div>
        </div>
      </section>

      {error && sheet === 'closed' && !pendingDelete ? (
        <p className="text-danger no-print text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {viewMode === 'list' ? (
        <PlanListView
          categories={data.categories}
          entries={data.entries}
          accounts={data.accounts}
          organizeMode={organizeMode && editable}
          currency={currency}
          locale={locale}
          year={now.year}
          month={now.month}
          onOpenEntry={openDetails}
          onReorder={applyReorder}
        />
      ) : null}

      {viewMode === 'breakdown' ? (
        <AccountBreakdownView
          entries={data.entries}
          accounts={data.accounts}
          currency={currency}
          locale={locale}
          year={now.year}
          month={now.month}
        />
      ) : null}

      {viewMode === 'print' ? (
        <PrintView
          planName={data.plan.name}
          categories={data.categories}
          entries={data.entries}
          accounts={data.accounts}
          currency={currency}
          locale={locale}
          year={now.year}
          month={now.month}
        />
      ) : null}

      {editable && viewMode === 'list' ? (
        <button
          type="button"
          className="btn btn-accent fixed right-4 bottom-20 z-40 !rounded-full !px-4 shadow-lg sm:right-8"
          onClick={openCreate}
          aria-label={t('plan.newEntry')}
        >
          <MaterialSymbol name="add" />
          <span className="ml-1 hidden sm:inline">{t('plan.newEntry')}</span>
        </button>
      ) : null}

      <Modal
        open={sheet === 'details' && Boolean(selected)}
        onClose={() => setSheet('closed')}
        className="glass-modal-surface max-w-md"
        ariaLabelledBy="entry-details-title"
      >
        {selected ? (
          <>
            <h2 id="entry-details-title" className="text-lg font-semibold">
              {selected.name}
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted">{t('entry.amount')}</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(
                    selected.kind === 'income' ? selected.amount_cents : -selected.amount_cents,
                    currency,
                    locale,
                    selected.kind === 'income',
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">{t('entry.frequency')}</span>
                <FrequencyBadge frequency={selected.frequency} />
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">{t('entry.kind')}</span>
                <span>{t(`entry.${selected.kind}`)}</span>
              </div>
              {selected.comment ? (
                <div>
                  <div className="text-muted mb-1">{t('entry.comment')}</div>
                  <p>{selected.comment}</p>
                </div>
              ) : (
                <p className="text-muted">{t('entry.noComment')}</p>
              )}
              {selected.kind === 'credit' ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">{t('entry.endDate')}</span>
                    <span>{selected.end_date ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">{t('entry.finalAmount')}</span>
                    <span>
                      {selected.final_amount_cents != null
                        ? formatMoney(selected.final_amount_cents, currency, locale)
                        : '—'}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="modal-actions">
              <Button variant="cancel" onClick={() => setSheet('closed')}>
                {t('app.cancel')}
              </Button>
              {editable ? (
                <Button variant="accent" onClick={() => openEdit(selected)}>
                  {t('app.edit')}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={sheet === 'edit' || sheet === 'create'}
        onClose={() => {
          setError(null);
          setSheet('closed');
        }}
        className="glass-modal-surface max-w-md"
        ariaLabelledBy="entry-form-title"
      >
        <h2 id="entry-form-title" className="text-lg font-semibold">
          {sheet === 'create' ? t('plan.newEntry') : t('app.edit')}
        </h2>
        {error ? (
          <p className="text-danger mt-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          <label className="form-group">
            <span>{t('entry.name')}</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="form-group">
            <span>{t('entry.amount')}</span>
            <Input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>
          <FormSelect
            label={t('entry.kind')}
            value={form.kind}
            options={[
              { value: 'expense', label: t('entry.expense') },
              { value: 'income', label: t('entry.income') },
              { value: 'credit', label: t('entry.credit') },
            ]}
            onChange={(value) => setForm((f) => ({ ...f, kind: value as EntryKind }))}
          />
          <FormSelect
            label={t('entry.frequency')}
            value={form.frequency}
            options={[
              { value: 'monthly', label: t('entry.monthly') },
              { value: 'quarterly', label: t('entry.quarterly') },
              { value: 'halfyearly', label: t('entry.halfyearly') },
              { value: 'yearly', label: t('entry.yearly') },
              { value: 'once', label: t('entry.once') },
            ]}
            onChange={(value) => setForm((f) => ({ ...f, frequency: value as EntryFrequency }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="form-group">
              <span>{t('entry.dueDay')}</span>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.due_day}
                onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
              />
            </label>
            {form.frequency !== 'monthly' ? (
              <label className="form-group">
                <span>{t('entry.dueMonth')}</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.due_month}
                  onChange={(e) => setForm((f) => ({ ...f, due_month: e.target.value }))}
                />
              </label>
            ) : null}
          </div>
          {form.frequency === 'once' ? (
            <label className="form-group">
              <span>{t('entry.dueYear')}</span>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={form.due_year}
                onChange={(e) => setForm((f) => ({ ...f, due_year: e.target.value }))}
              />
            </label>
          ) : null}
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <FormSelect
                className="min-w-0 flex-1"
                label={t('entry.category')}
                value={form.category_id}
                options={data.categories.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(value) => {
                  setForm((f) => ({ ...f, category_id: value }));
                  setCategoryEditor('closed');
                }}
              />
              <button
                type="button"
                className="icon-toggle-btn mb-0.5 shrink-0"
                aria-label={t('plan.addCategory')}
                title={t('plan.addCategory')}
                onClick={() => {
                  setAccountEditor('closed');
                  setNewCategoryName('');
                  setCategoryEditor((v) => (v === 'add' ? 'closed' : 'add'));
                }}
              >
                <MaterialSymbol name={categoryEditor === 'add' ? 'close' : 'add'} />
              </button>
              <button
                type="button"
                className="icon-toggle-btn mb-0.5 shrink-0"
                aria-label={t('plan.renameCategory')}
                title={t('plan.renameCategory')}
                disabled={!form.category_id}
                onClick={beginRenameCategory}
              >
                <MaterialSymbol name="edit" />
              </button>
              <button
                type="button"
                className="icon-toggle-btn mb-0.5 shrink-0"
                aria-label={t('plan.deleteCategory')}
                title={t('plan.deleteCategory')}
                disabled={!form.category_id}
                onClick={requestDeleteCategory}
              >
                <MaterialSymbol name="delete" />
              </button>
            </div>
            {categoryEditor !== 'closed' ? (
              <div className="flex items-end gap-2">
                <label className="form-group min-w-0 flex-1">
                  <span>{t('plan.categoryName')}</span>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void (categoryEditor === 'rename' ? renameCategory() : createCategory());
                      }
                    }}
                    autoFocus
                  />
                </label>
                <Button
                  variant="accent"
                  className="!min-h-10 shrink-0"
                  disabled={saving || !newCategoryName.trim()}
                  onClick={() =>
                    void (categoryEditor === 'rename' ? renameCategory() : createCategory())
                  }
                >
                  {categoryEditor === 'rename' ? t('app.save') : t('app.add')}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <FormSelect
                className="min-w-0 flex-1"
                label={t('entry.account')}
                value={form.account_id}
                placeholder={t('plan.noAccount')}
                options={[
                  { value: '', label: t('plan.noAccount') },
                  ...data.accounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                    swatchClass: isAccountColor(a.color) ? `account-swatch--${a.color}` : undefined,
                  })),
                ]}
                onChange={(value) => {
                  setForm((f) => ({ ...f, account_id: value }));
                  setAccountEditor('closed');
                }}
              />
              <button
                type="button"
                className="icon-toggle-btn mb-0.5 shrink-0"
                aria-label={t('plan.addAccount')}
                title={t('plan.addAccount')}
                onClick={() => {
                  setCategoryEditor('closed');
                  setNewAccountName('');
                  setAccountColorDraft(nextAccountColor(data.accounts.map((a) => a.color)));
                  setAccountEditor((v) => (v === 'add' ? 'closed' : 'add'));
                }}
              >
                <MaterialSymbol name={accountEditor === 'add' ? 'close' : 'add'} />
              </button>
              <button
                type="button"
                className="icon-toggle-btn mb-0.5 shrink-0"
                aria-label={t('plan.renameAccount')}
                title={t('plan.renameAccount')}
                disabled={!form.account_id}
                onClick={beginRenameAccount}
              >
                <MaterialSymbol name="edit" />
              </button>
              <button
                type="button"
                className="icon-toggle-btn mb-0.5 shrink-0"
                aria-label={t('plan.deleteAccount')}
                title={t('plan.deleteAccount')}
                disabled={!form.account_id}
                onClick={requestDeleteAccount}
              >
                <MaterialSymbol name="delete" />
              </button>
            </div>
            {accountEditor !== 'closed' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <label className="form-group min-w-0 flex-1">
                    <span>{t('plan.accountName')}</span>
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void (accountEditor === 'rename' ? renameAccount() : createAccount());
                        }
                      }}
                      autoFocus
                    />
                  </label>
                  <Button
                    variant="accent"
                    className="!min-h-10 shrink-0"
                    disabled={saving || !newAccountName.trim()}
                    onClick={() =>
                      void (accountEditor === 'rename' ? renameAccount() : createAccount())
                    }
                  >
                    {accountEditor === 'rename' ? t('app.save') : t('app.add')}
                  </Button>
                </div>
                <AccountColorPicker value={accountColorDraft} onChange={setAccountColorDraft} />
              </div>
            ) : null}
          </div>
          <label className="form-group">
            <span>{t('entry.comment')}</span>
            <textarea
              className="form-input min-h-20"
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            />
          </label>
          {form.kind === 'credit' ? (
            <>
              <label className="form-group">
                <span>{t('entry.endDate')}</span>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </label>
              <label className="form-group">
                <span>{t('entry.finalAmount')}</span>
                <Input
                  inputMode="decimal"
                  value={form.final_amount}
                  onChange={(e) => setForm((f) => ({ ...f, final_amount: e.target.value }))}
                />
              </label>
            </>
          ) : null}
        </div>
        <div className="modal-actions">
          {sheet === 'edit' ? (
            <Button variant="danger" disabled={saving} onClick={() => void deleteEntry()}>
              {t('app.delete')}
            </Button>
          ) : (
            <Button variant="cancel" onClick={() => setSheet('closed')}>
              {t('app.cancel')}
            </Button>
          )}
          <Button variant="accent" disabled={saving} onClick={() => void saveEntry()}>
            {t('app.save')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={sheet === 'invite'}
        onClose={() => {
          setError(null);
          setSheet('closed');
        }}
        className="glass-modal-surface max-w-md"
        ariaLabelledBy="invite-title"
      >
        <h2 id="invite-title" className="text-lg font-semibold">
          {t('invite.title')}
        </h2>
        {error ? (
          <p className="text-danger mt-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          <label className="form-group">
            <span>{t('invite.email')}</span>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>
          <FormSelect
            label={t('invite.role')}
            value={inviteRole}
            options={[
              { value: 'viewer', label: t('invite.viewer') },
              { value: 'editor', label: t('invite.editor') },
            ]}
            onChange={(value) => setInviteRole(value as 'viewer' | 'editor')}
          />
          {inviteLink ? (
            <div className="flex flex-col gap-2">
              <Input readOnly value={inviteLink} />
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? t('app.copied') : t('app.copyLink')}
              </Button>
              <a
                className="btn btn-accent text-center"
                href={`mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent(
                  `Join "${data.plan.name}" on BudgetPlanner`,
                )}&body=${encodeURIComponent(
                  `You've been invited to ${inviteRole === 'editor' ? 'edit' : 'view'} "${data.plan.name}".\n\n${inviteLink}\n`,
                )}`}
              >
                mailto
              </a>
            </div>
          ) : null}
        </div>
        <div className="modal-actions">
          <Button variant="cancel" onClick={() => setSheet('closed')}>
            {t('app.cancel')}
          </Button>
          {!inviteLink ? (
            <Button variant="accent" disabled={saving} onClick={() => void createInvite()}>
              {t('invite.send')}
            </Button>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={pendingDelete != null}
        onClose={() => {
          setError(null);
          setPendingDelete(null);
        }}
        className="glass-modal-surface max-w-md"
        ariaLabelledBy="delete-confirm-title"
      >
        {pendingDelete ? (
          <>
            <h2 id="delete-confirm-title" className="text-lg font-semibold">
              {pendingDelete.kind === 'category'
                ? t('plan.deleteCategory')
                : t('plan.deleteAccount')}
            </h2>
            <p className="text-muted mt-3 text-sm">
              {pendingDelete.kind === 'category'
                ? pendingDelete.entryCount > 0
                  ? t('plan.deleteCategoryConfirm', {
                      name: pendingDelete.name,
                      count: pendingDelete.entryCount,
                    })
                  : t('plan.deleteCategoryConfirmEmpty', { name: pendingDelete.name })
                : t('plan.deleteAccountConfirm', { name: pendingDelete.name })}
            </p>
            {error ? (
              <p className="text-danger mt-3 text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button
                variant="cancel"
                onClick={() => {
                  setError(null);
                  setPendingDelete(null);
                }}
              >
                {t('app.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={saving}
                onClick={() => void confirmPendingDelete()}
              >
                {t('app.delete')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <button
        type="button"
        className="sr-only"
        onClick={() => navigate('/')}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}

export function PlanPage() {
  return (
    <RequireAuth>
      <PlanPageInner />
    </RequireAuth>
  );
}
