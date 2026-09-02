import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { amountForMonth, isDueInMonth } from '../../../shared/dueThisMonth';
import { formatMonthLabel } from '../../../shared/planMonth';
import { formatMoney } from '../../lib/format';
import type { Account, Entry } from '../../lib/types';

interface AccountBreakdown {
  accountId: string | null;
  name: string;
  color: string | null;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export function AccountBreakdownView({
  entries,
  accounts,
  currency,
  locale,
  year,
  month,
}: {
  entries: Entry[];
  accounts: Account[];
  currency: string;
  locale: string;
  year: number;
  month: number;
}) {
  const { t } = useTranslation();

  const rows = useMemo(() => {
    const map = new Map<string, AccountBreakdown>();
    const ensure = (accountId: string | null, name: string, color: string | null = null) => {
      const key = accountId ?? '__none__';
      let row = map.get(key);
      if (!row) {
        row = { accountId, name, color, incomeCents: 0, expenseCents: 0, netCents: 0 };
        map.set(key, row);
      }
      return row;
    };

    for (const account of accounts) {
      ensure(account.id, account.name, account.color);
    }
    ensure(null, t('plan.noAccount'), null);

    for (const entry of entries) {
      if (!isDueInMonth(entry, year, month)) continue;
      const amount = amountForMonth(entry, year, month);
      if (amount == null) continue;
      const account = entry.account_id ? accounts.find((a) => a.id === entry.account_id) : null;
      const row = ensure(
        entry.account_id,
        account?.name ?? t('plan.noAccount'),
        account?.color ?? null,
      );
      if (entry.kind === 'income') row.incomeCents += amount;
      else row.expenseCents += amount;
    }

    for (const row of map.values()) {
      row.netCents = row.incomeCents - row.expenseCents;
    }

    return [...map.values()]
      .filter((r) => r.incomeCents > 0 || r.expenseCents > 0 || r.accountId != null)
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [accounts, entries, locale, month, t, year]);

  if (rows.every((r) => r.incomeCents === 0 && r.expenseCents === 0)) {
    return (
      <p className="text-muted py-8 text-center text-sm">
        {t('plan.breakdownEmpty', { month: formatMonthLabel(year, month, locale) })}
      </p>
    );
  }

  return (
    <section className="glass-surface overflow-hidden">
      <div className="border-glass-divider text-muted grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase">
        <span>{t('entry.account')}</span>
        <span className="text-right">{t('plan.income')}</span>
        <span className="text-right">{t('plan.expenses')}</span>
        <span className="text-right">{t('plan.net')}</span>
      </div>
      <ul className="divide-glass-divider divide-y">
        {rows.map((row) => (
          <li
            key={row.accountId ?? '__none__'}
            className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 px-4 py-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 truncate font-medium">
              {row.color ? (
                <span className={`account-swatch account-swatch--${row.color}`} aria-hidden />
              ) : null}
              <span className="truncate">{row.name}</span>
            </span>
            <span className="text-success text-right tabular-nums">
              {formatMoney(row.incomeCents, currency, locale)}
            </span>
            <span className="text-danger text-right tabular-nums">
              {formatMoney(row.expenseCents, currency, locale)}
            </span>
            <span className="text-right font-medium tabular-nums">
              {formatMoney(row.netCents, currency, locale, true)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
