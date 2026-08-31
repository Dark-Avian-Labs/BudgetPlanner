import { useTranslation } from 'react-i18next';

import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import {
  calendarMonth,
  formatMonthLabel,
  isSameMonth,
  MAX_PLAN_YEAR,
  MIN_PLAN_YEAR,
  monthKey,
  parseMonthKey,
  shiftMonth,
} from '../../lib/planMonth';

export function MonthSelector({
  year,
  month,
  locale,
  onChange,
}: {
  year: number;
  month: number;
  locale: string;
  onChange: (next: { year: number; month: number }) => void;
}) {
  const { t } = useTranslation();
  const current = calendarMonth();
  const viewingCurrent = isSameMonth({ year, month }, current);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const prevDisabled = isSameMonth(prev, { year, month });
  const nextDisabled = isSameMonth(next, { year, month });

  return (
    <div className="month-selector">
      <button
        type="button"
        className="icon-toggle-btn"
        aria-label={t('plan.previousMonth')}
        title={t('plan.previousMonth')}
        disabled={prevDisabled}
        onClick={() => onChange(prev)}
      >
        <MaterialSymbol name="chevron_left" />
      </button>
      <input
        type="month"
        className="form-input month-selector__input"
        min={monthKey(MIN_PLAN_YEAR, 1)}
        max={monthKey(MAX_PLAN_YEAR, 12)}
        value={monthKey(year, month)}
        aria-label={t('plan.pickMonth')}
        title={formatMonthLabel(year, month, locale)}
        onChange={(e) => {
          const parsed = parseMonthKey(e.target.value);
          if (parsed) onChange(parsed);
        }}
      />
      <button
        type="button"
        className="icon-toggle-btn"
        aria-label={t('plan.nextMonth')}
        title={t('plan.nextMonth')}
        disabled={nextDisabled}
        onClick={() => onChange(next)}
      >
        <MaterialSymbol name="chevron_right" />
      </button>
      {viewingCurrent ? null : (
        <button
          type="button"
          className="btn btn-secondary month-selector__today"
          onClick={() => onChange(calendarMonth())}
        >
          {t('plan.thisMonth')}
        </button>
      )}
    </div>
  );
}
