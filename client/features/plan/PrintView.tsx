import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { amountForMonth, isDueInMonth } from '../../lib/dueThisMonth';
import { formatDueDay, formatDueMonthDay, formatMoney } from '../../lib/format';
import type { Account, Category, Entry } from '../../lib/types';

export function PrintView({
  planName,
  categories,
  entries,
  accounts,
  currency,
  locale,
  year,
  month,
}: {
  planName: string;
  categories: Category[];
  entries: Entry[];
  accounts: Account[];
  currency: string;
  locale: string;
  year: number;
  month: number;
}) {
  const { t } = useTranslation();
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));

  const sections = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((category) => {
        const rows = entries
          .filter((e) => e.category_id === category.id && isDueInMonth(e, year, month))
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((entry) => {
            const amount = amountForMonth(entry, year, month) ?? entry.amount_cents;
            const signed = entry.kind === 'income' ? amount : -amount;
            return { entry, signed };
          });
        return { category, rows };
      })
      .filter((s) => s.rows.length > 0);
  }, [categories, entries, month, year]);

  return (
    <div className="print-sheet">
      <div className="print-sheet__toolbar no-print">
        <p className="text-muted text-sm">{t('plan.printHint')}</p>
        <button type="button" className="btn btn-accent" onClick={() => window.print()}>
          {t('plan.print')}
        </button>
      </div>

      <article className="print-sheet__page">
        <header className="print-sheet__header">
          <h1>{planName}</h1>
          <p>
            {t('plan.thisMonth')}: {monthLabel}
          </p>
        </header>

        {sections.length === 0 ? (
          <p>{t('plan.printEmpty')}</p>
        ) : (
          <table className="print-sheet__table">
            <colgroup>
              <col className="print-sheet__col-name" />
              <col className="print-sheet__col-amount" />
              <col className="print-sheet__col-day" />
              <col className="print-sheet__col-account" />
              <col className="print-sheet__col-comment" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t('entry.name')}</th>
                <th scope="col" className="print-sheet__amount">
                  {t('entry.amount')}
                </th>
                <th scope="col" className="print-sheet__day">
                  {t('plan.printDue')}
                </th>
                <th scope="col">{t('entry.account')}</th>
                <th scope="col">{t('entry.comment')}</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(({ category, rows }) => (
                <Fragment key={category.id}>
                  <tr className="print-sheet__category">
                    <th scope="rowgroup" colSpan={5}>
                      {category.name}
                    </th>
                  </tr>
                  {rows.map(({ entry, signed }) => (
                    <tr key={entry.id}>
                      <td>
                        {entry.name}
                        {entry.kind === 'credit' ? ` (${t('entry.credit')})` : ''}
                      </td>
                      <td className="print-sheet__amount">
                        {formatMoney(signed, currency, locale, entry.kind === 'income')}
                      </td>
                      <td className="print-sheet__day">
                        {entry.frequency === 'monthly'
                          ? formatDueDay(entry.due_day, locale)
                          : formatDueMonthDay(month, entry.due_day, locale)}
                      </td>
                      <td>{entry.account_id ? (accountMap.get(entry.account_id) ?? '') : ''}</td>
                      <td>{entry.comment ?? ''}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
