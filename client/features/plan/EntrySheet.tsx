import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_ACCOUNT_COLOR,
  nextAccountColor,
  remapAccountColor,
  type AccountColor,
} from '../../../shared/accountColors';
import { MAX_PLAN_YEAR, MIN_PLAN_YEAR, type PlanMonth } from '../../../shared/planMonth';
import { AccountColorPicker } from '../../components/budget/AccountColorPicker';
import { Button } from '../../components/ui/Button';
import { FormSelect } from '../../components/ui/FormSelect';
import { Input } from '../../components/ui/Input';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Modal } from '../../components/ui/Modal';
import { entryPayloadFieldErrors, type EntryPayload } from '../../lib/entryPayload';
import { centsToInput, parseAmountToCents } from '../../lib/format';
import { applyEntryToPlan } from '../../lib/planEntriesState';
import type {
  Account,
  Category,
  Entry,
  EntryFrequency,
  EntryKind,
  PlanDetail,
} from '../../lib/types';
import { ApiError, apiJson } from '../../utils/api';

type FieldEditor = 'closed' | 'add' | 'rename';

export type EntrySheetDelete =
  | { kind: 'category'; id: string; name: string; entryCount: number }
  | { kind: 'account'; id: string; name: string }
  | { kind: 'entry'; id: string; name: string };

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

function emptyForm(categoryId: string, year: number, month: number): EntryFormState {
  return {
    name: '',
    amount: '',
    kind: 'expense',
    frequency: 'monthly',
    due_day: '1',
    due_month: String(month),
    due_year: String(year),
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

function formatEntryFieldsMessage(
  fields: string[],
  t: (key: string, options?: { fields?: string }) => string,
): string {
  const labels = fields.map((field) => {
    const key = `entry.fields.${field}`;
    const label = t(key);
    return label === key ? field : label;
  });
  return t('entry.invalidFields', { fields: labels.join(', ') });
}

export function EntrySheet({
  open,
  mode,
  planId,
  entry,
  data,
  selectedMonth,
  error,
  saving,
  onClose,
  onError,
  onSaving,
  onPlanChange,
  onRequestDelete,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  planId: string;
  entry: Entry | null;
  data: PlanDetail;
  selectedMonth: PlanMonth;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onError: (message: string | null) => void;
  onSaving: (saving: boolean) => void;
  onPlanChange: (updater: (prev: PlanDetail) => PlanDetail) => void;
  onRequestDelete: (pending: EntrySheetDelete) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<EntryFormState>(() =>
    emptyForm(data.categories[0]?.id ?? '', selectedMonth.year, selectedMonth.month),
  );
  const [categoryEditor, setCategoryEditor] = useState<FieldEditor>('closed');
  const [accountEditor, setAccountEditor] = useState<FieldEditor>('closed');
  const [newAccountName, setNewAccountName] = useState('');
  const [accountColorDraft, setAccountColorDraft] = useState<AccountColor>(DEFAULT_ACCOUNT_COLOR);
  const [newCategoryName, setNewCategoryName] = useState('');

  function resetFieldEditors() {
    setCategoryEditor('closed');
    setAccountEditor('closed');
    setNewAccountName('');
    setAccountColorDraft(DEFAULT_ACCOUNT_COLOR);
    setNewCategoryName('');
  }

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && entry) setForm(entryToForm(entry));
    else setForm(emptyForm(data.categories[0]?.id ?? '', selectedMonth.year, selectedMonth.month));
    resetFieldEditors();
  }, [open, mode, entry?.id]); // ponytail: snapshot category/month at open; adding a category must not reset the form

  useEffect(() => {
    if (!form.category_id || data.categories.some((c) => c.id === form.category_id)) return;
    setForm((f) => ({ ...f, category_id: data.categories[0]?.id ?? '' }));
    setCategoryEditor('closed');
  }, [data.categories, form.category_id]);

  useEffect(() => {
    if (!form.account_id || data.accounts.some((a) => a.id === form.account_id)) return;
    setForm((f) => ({ ...f, account_id: '' }));
    setAccountEditor('closed');
  }, [data.accounts, form.account_id]);

  function beginRenameCategory() {
    const cat = data.categories.find((c) => c.id === form.category_id);
    if (!cat) return;
    setAccountEditor('closed');
    setNewCategoryName(cat.name);
    setCategoryEditor('rename');
  }

  function beginRenameAccount() {
    const acc = data.accounts.find((a) => a.id === form.account_id);
    if (!acc) return;
    setCategoryEditor('closed');
    setNewAccountName(acc.name);
    setAccountColorDraft(remapAccountColor(acc.color) ?? DEFAULT_ACCOUNT_COLOR);
    setAccountEditor('rename');
  }

  async function createAccount() {
    if (!newAccountName.trim()) return;
    onSaving(true);
    onError(null);
    try {
      const result = await apiJson<{ account: Account }>(`/api/plans/${planId}/accounts`, {
        method: 'POST',
        body: JSON.stringify({ name: newAccountName.trim(), color: accountColorDraft }),
      });
      onPlanChange((prev) => ({ ...prev, accounts: [...prev.accounts, result.account] }));
      setForm((f) => ({ ...f, account_id: result.account.id }));
      setNewAccountName('');
      setAccountEditor('closed');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      onSaving(false);
    }
  }

  async function renameAccount() {
    if (!form.account_id || !newAccountName.trim()) return;
    onSaving(true);
    onError(null);
    try {
      const result = await apiJson<{ account: Account }>(
        `/api/plans/${planId}/accounts/${form.account_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: newAccountName.trim(), color: accountColorDraft }),
        },
      );
      onPlanChange((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.id === result.account.id ? result.account : a)),
      }));
      setAccountEditor('closed');
      setNewAccountName('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to rename account');
    } finally {
      onSaving(false);
    }
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    onSaving(true);
    onError(null);
    try {
      const result = await apiJson<{ category: Category }>(`/api/plans/${planId}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      onPlanChange((prev) => ({ ...prev, categories: [...prev.categories, result.category] }));
      setForm((f) => ({ ...f, category_id: result.category.id }));
      setNewCategoryName('');
      setCategoryEditor('closed');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      onSaving(false);
    }
  }

  async function renameCategory() {
    if (!form.category_id || !newCategoryName.trim()) return;
    onSaving(true);
    onError(null);
    try {
      const result = await apiJson<{ category: Category }>(
        `/api/plans/${planId}/categories/${form.category_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: newCategoryName.trim() }),
        },
      );
      onPlanChange((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => (c.id === result.category.id ? result.category : c)),
      }));
      setCategoryEditor('closed');
      setNewCategoryName('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to rename category');
    } finally {
      onSaving(false);
    }
  }

  function requestDeleteCategory() {
    if (!form.category_id) return;
    if (data.categories.length <= 1) {
      onError(t('plan.cannotDeleteLastCategory'));
      return;
    }
    const cat = data.categories.find((c) => c.id === form.category_id);
    if (!cat) return;
    onRequestDelete({
      kind: 'category',
      id: cat.id,
      name: cat.name,
      entryCount: data.entries.filter((e) => e.category_id === cat.id).length,
    });
  }

  function requestDeleteAccount() {
    if (!form.account_id) return;
    const acc = data.accounts.find((a) => a.id === form.account_id);
    if (!acc) return;
    onRequestDelete({ kind: 'account', id: acc.id, name: acc.name });
  }

  function requestDeleteEntry() {
    if (!entry) return;
    onRequestDelete({ kind: 'entry', id: entry.id, name: entry.name });
  }

  async function saveEntry() {
    const amount = parseAmountToCents(form.amount);
    if (amount == null) {
      onError(t('entry.invalidAmount'));
      return;
    }
    let finalAmountCents: number | null = null;
    if (form.kind === 'credit' && form.final_amount.trim()) {
      const parsedFinal = parseAmountToCents(form.final_amount);
      if (parsedFinal == null) {
        onError(formatEntryFieldsMessage(['final_amount_cents'], t));
        return;
      }
      finalAmountCents = parsedFinal;
    }
    const payload: EntryPayload = {
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
      final_amount_cents: finalAmountCents,
    };
    const fieldErrors = entryPayloadFieldErrors(payload);
    if (fieldErrors.length) {
      onError(formatEntryFieldsMessage(fieldErrors, t));
      return;
    }

    onSaving(true);
    onError(null);
    try {
      if (mode === 'edit' && entry) {
        const result = await apiJson<{ entry: Entry }>(`/api/plans/${planId}/entries/${entry.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onPlanChange((prev) => applyEntryToPlan(prev, result.entry));
      } else {
        const result = await apiJson<{ entry: Entry }>(`/api/plans/${planId}/entries`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onPlanChange((prev) => applyEntryToPlan(prev, result.entry));
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) {
        onError(formatEntryFieldsMessage(err.fields, t));
      } else {
        onError(err instanceof Error ? err.message : t('entry.saveFailed'));
      }
    } finally {
      onSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="glass-modal-surface max-w-md"
      ariaLabelledBy="entry-form-title"
    >
      <h2 id="entry-form-title" className="text-lg font-semibold">
        {mode === 'create' ? t('plan.newEntry') : t('app.edit')}
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
              min={MIN_PLAN_YEAR}
              max={MAX_PLAN_YEAR}
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
                ...data.accounts.map((a) => {
                  const color = remapAccountColor(a.color);
                  return {
                    value: a.id,
                    label: a.name,
                    swatchClass: color ? `account-swatch--${color}` : undefined,
                  };
                }),
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
        {mode === 'edit' ? (
          <Button variant="danger" disabled={saving} onClick={requestDeleteEntry}>
            {t('app.delete')}
          </Button>
        ) : (
          <Button variant="cancel" onClick={onClose}>
            {t('app.cancel')}
          </Button>
        )}
        <Button variant="accent" disabled={saving} onClick={() => void saveEntry()}>
          {t('app.save')}
        </Button>
      </div>
    </Modal>
  );
}
