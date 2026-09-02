import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import {
  calendarMonth,
  clampPlanMonth,
  isSameMonth,
  type PlanMonth,
} from '../../../shared/planMonth';
import { FrequencyBadge } from '../../components/budget/FrequencyBadge';
import { RequireAuth } from '../../components/Layout/Layout';
import { Button } from '../../components/ui/Button';
import { FormSelect } from '../../components/ui/FormSelect';
import { Input } from '../../components/ui/Input';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Modal } from '../../components/ui/Modal';
import { formatMoney } from '../../lib/format';
import { removeEntryFromPlan } from '../../lib/planEntriesState';
import { canEdit, type Entry, type PlanDetail } from '../../lib/types';
import { ApiError, apiJson } from '../../utils/api';
import { copyTextToClipboard } from '../../utils/clipboard';
import { AccountBreakdownView } from './AccountBreakdownView';
import { EntrySheet, type EntrySheetDelete } from './EntrySheet';
import { MonthSelector } from './MonthSelector';
import { PlanListView } from './PlanListView';
import { PrintView } from './PrintView';

type SheetMode = 'closed' | 'details' | 'edit' | 'create' | 'invite';
type PlanViewMode = 'list' | 'breakdown' | 'print';
type PendingDelete =
  | null
  | EntrySheetDelete
  | { kind: 'plan'; name: string }
  | { kind: 'leave'; name: string }
  | { kind: 'member'; id: string; email: string }
  | { kind: 'invite'; id: string; email: string };

function monthFromSearch(searchParams: URLSearchParams): PlanMonth {
  const current = calendarMonth();
  const yearRaw = searchParams.get('year');
  const monthRaw = searchParams.get('month');
  if (yearRaw == null && monthRaw == null) return current;
  return clampPlanMonth(
    yearRaw == null ? current.year : Number(yearRaw),
    monthRaw == null ? current.month : Number(monthRaw),
    current,
  );
}

function PlanPageInner() {
  const { planId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizeMode, setOrganizeMode] = useState(false);
  const [viewMode, setViewMode] = useState<PlanViewMode>('list');
  const [sheet, setSheet] = useState<SheetMode>('closed');
  const [selected, setSelected] = useState<Entry | null>(null);
  const selectedMonth = monthFromSearch(searchParams);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('editor');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const locale = i18n.language;
  const viewingCurrentMonth = isSameMonth(selectedMonth, calendarMonth());

  const setSelectedMonth = useCallback(
    (next: PlanMonth) => {
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          if (isSameMonth(next, calendarMonth())) {
            nextParams.delete('year');
            nextParams.delete('month');
          } else {
            nextParams.set('year', String(next.year));
            nextParams.set('month', String(next.month));
          }
          return nextParams;
        },
        { replace: true },
      );
      if (!isSameMonth(next, calendarMonth())) setOrganizeMode(false);
    },
    [setSearchParams],
  );

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await apiJson<PlanDetail>(
        `/api/plans/${planId}?year=${selectedMonth.year}&month=${selectedMonth.month}`,
      );
      setData(detail);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) setError(t('plan.notFound'));
        else if (err.status === 401 || err.status === 403) setError(t('plan.accessDenied'));
        else setError(err.message);
      } else {
        setError(t('plan.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [planId, selectedMonth.year, selectedMonth.month, t]);

  useEffect(() => {
    if (isLoaded && isSignedIn) void load();
  }, [isLoaded, isSignedIn, load]);

  const editable = data ? canEdit(data.role) : false;

  function openDetails(entry: Entry) {
    setSelected(entry);
    setSheet('details');
  }

  function openEdit(entry: Entry) {
    setSelected(entry);
    setSheet('edit');
  }

  function openCreate() {
    setSelected(null);
    setSheet('create');
  }

  async function confirmPendingDelete() {
    if (!planId || !pendingDelete) return;
    setSaving(true);
    setError(null);
    try {
      switch (pendingDelete.kind) {
        case 'category': {
          await apiJson(`/api/plans/${planId}/categories/${pendingDelete.id}`, {
            method: 'DELETE',
          });
          setData((prev) => {
            if (!prev) return prev;
            const categories = prev.categories.filter((c) => c.id !== pendingDelete.id);
            const entries = prev.entries.filter((e) => e.category_id !== pendingDelete.id);
            return { ...prev, categories, entries };
          });
          break;
        }
        case 'account': {
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
          break;
        }
        case 'entry': {
          await apiJson(`/api/plans/${planId}/entries/${pendingDelete.id}`, { method: 'DELETE' });
          setSheet('closed');
          setData((prev) => (prev ? removeEntryFromPlan(prev, pendingDelete.id) : prev));
          break;
        }
        case 'plan': {
          await apiJson(`/api/plans/${planId}`, { method: 'DELETE' });
          navigate('/');
          break;
        }
        case 'leave': {
          await apiJson(`/api/plans/${planId}/leave`, { method: 'POST' });
          navigate('/');
          break;
        }
        case 'member': {
          await apiJson(`/api/plans/${planId}/members/${pendingDelete.id}`, { method: 'DELETE' });
          await load();
          break;
        }
        case 'invite': {
          await apiJson(`/api/plans/${planId}/invites/${pendingDelete.id}`, { method: 'DELETE' });
          await load();
          break;
        }
        default: {
          const _exhaustive: never = pendingDelete;
          return _exhaustive;
        }
      }
      setPendingDelete(null);
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted text-sm">{t('app.loading')}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-danger text-sm">{error ?? t('plan.loadFailed')}</p>
        <Button variant="accent" onClick={() => void load()}>
          {t('app.retry')}
        </Button>
      </div>
    );
  }

  const currency = data.plan.currency;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground min-w-0 truncate text-2xl font-semibold tracking-tight">
          {data.plan.name}
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <MonthSelector
            year={selectedMonth.year}
            month={selectedMonth.month}
            locale={locale}
            onChange={setSelectedMonth}
          />
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
          {editable && viewMode === 'list' && viewingCurrentMonth ? (
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
              <button
                type="button"
                className="icon-toggle-btn"
                aria-label={t('plan.people')}
                title={t('plan.people')}
                onClick={() => {
                  setInviteLink(null);
                  setInviteEmail('');
                  setSheet('invite');
                }}
              >
                <MaterialSymbol name={data.role === 'owner' ? 'person_add' : 'group'} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="icon-toggle-btn"
              aria-label={t('plan.people')}
              title={t('plan.people')}
              onClick={() => {
                setInviteLink(null);
                setInviteEmail('');
                setSheet('invite');
              }}
            >
              <MaterialSymbol name={data.role === 'owner' ? 'person_add' : 'group'} />
            </button>
          )}
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
          organizeMode={organizeMode && editable && viewingCurrentMonth}
          currency={currency}
          locale={locale}
          year={selectedMonth.year}
          month={selectedMonth.month}
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
          year={selectedMonth.year}
          month={selectedMonth.month}
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
          year={selectedMonth.year}
          month={selectedMonth.month}
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

      {planId && (sheet === 'edit' || sheet === 'create') ? (
        <EntrySheet
          open
          mode={sheet === 'create' ? 'create' : 'edit'}
          planId={planId}
          entry={selected}
          data={data}
          selectedMonth={selectedMonth}
          error={error}
          saving={saving}
          onClose={() => {
            setError(null);
            setSheet('closed');
          }}
          onError={setError}
          onSaving={setSaving}
          onPlanChange={(updater) => setData((prev) => (prev ? updater(prev) : prev))}
          onRequestDelete={setPendingDelete}
        />
      ) : null}

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
          {t('plan.people')}
        </h2>
        {error ? (
          <p className="text-danger mt-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
              {t('plan.members')}
            </h3>
            <ul className="divide-glass-divider divide-y">
              {(data.members ?? []).map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{member.email}</div>
                    <div className="text-muted text-xs">
                      {member.role === 'owner'
                        ? t('plan.owner')
                        : member.role === 'editor'
                          ? t('invite.editor')
                          : t('invite.viewer')}
                    </div>
                  </div>
                  {data.role === 'owner' && member.role !== 'owner' ? (
                    <Button
                      variant="danger"
                      disabled={saving}
                      onClick={() =>
                        setPendingDelete({ kind: 'member', id: member.id, email: member.email })
                      }
                    >
                      {t('plan.removeMember')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {data.role === 'owner' && (data.pendingInvites ?? []).length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
                {t('plan.pendingInvites')}
              </h3>
              <ul className="divide-glass-divider divide-y">
                {data.pendingInvites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{invite.email}</div>
                      <div className="text-muted text-xs">
                        {invite.role === 'editor' ? t('invite.editor') : t('invite.viewer')}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={saving}
                      onClick={() =>
                        setPendingDelete({ kind: 'invite', id: invite.id, email: invite.email })
                      }
                    >
                      {t('plan.revokeInvite')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.role === 'owner' ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
                {t('invite.title')}
              </h3>
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
                  <Input id="invite-link-input" readOnly value={inviteLink} />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const input = document.getElementById(
                        'invite-link-input',
                      ) as HTMLInputElement | null;
                      const ok = await copyTextToClipboard(inviteLink, input);
                      if (ok) {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      } else {
                        setError(t('app.copyFailed'));
                      }
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
              ) : (
                <Button variant="accent" disabled={saving} onClick={() => void createInvite()}>
                  {t('invite.send')}
                </Button>
              )}
            </section>
          ) : null}

          {data.role === 'owner' ? (
            <Button
              variant="danger"
              disabled={saving}
              onClick={() => setPendingDelete({ kind: 'plan', name: data.plan.name })}
            >
              {t('plan.deletePlan')}
            </Button>
          ) : (
            <Button
              variant="danger"
              disabled={saving}
              onClick={() => setPendingDelete({ kind: 'leave', name: data.plan.name })}
            >
              {t('plan.leave')}
            </Button>
          )}
        </div>
        <div className="modal-actions">
          <Button variant="cancel" onClick={() => setSheet('closed')}>
            {t('app.cancel')}
          </Button>
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
                : pendingDelete.kind === 'account'
                  ? t('plan.deleteAccount')
                  : pendingDelete.kind === 'entry'
                    ? t('app.delete')
                    : pendingDelete.kind === 'plan'
                      ? t('plan.deletePlan')
                      : pendingDelete.kind === 'leave'
                        ? t('plan.leave')
                        : pendingDelete.kind === 'member'
                          ? t('plan.removeMember')
                          : t('plan.revokeInvite')}
            </h2>
            <p className="text-muted mt-3 text-sm">
              {pendingDelete.kind === 'category'
                ? pendingDelete.entryCount > 0
                  ? t('plan.deleteCategoryConfirm', {
                      name: pendingDelete.name,
                      count: pendingDelete.entryCount,
                    })
                  : t('plan.deleteCategoryConfirmEmpty', { name: pendingDelete.name })
                : pendingDelete.kind === 'account'
                  ? t('plan.deleteAccountConfirm', { name: pendingDelete.name })
                  : pendingDelete.kind === 'entry'
                    ? t('entry.deleteConfirm', { name: pendingDelete.name })
                    : pendingDelete.kind === 'plan'
                      ? t('plan.deletePlanConfirm', { name: pendingDelete.name })
                      : pendingDelete.kind === 'leave'
                        ? t('plan.leaveConfirm', { name: pendingDelete.name })
                        : pendingDelete.kind === 'member'
                          ? t('plan.removeMemberConfirm', { email: pendingDelete.email })
                          : t('plan.revokeInviteConfirm', { email: pendingDelete.email })}
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
                {pendingDelete.kind === 'leave'
                  ? t('plan.leave')
                  : pendingDelete.kind === 'invite'
                    ? t('plan.revokeInvite')
                    : pendingDelete.kind === 'member'
                      ? t('plan.removeMember')
                      : t('app.delete')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
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
