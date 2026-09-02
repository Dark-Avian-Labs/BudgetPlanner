import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  calendarMonth,
  enumerateMonths,
  formatMonthLabel,
  isSameMonth,
  monthKey,
  parseMonthKey,
  shiftMonth,
} from '../../../shared/planMonth';
import { SelectDropdown } from '../../components/ui/SelectDropdown';

const MONTHS_BACK = 24;
const MONTHS_FORWARD = 12;

const TRIGGER_CLASS =
  'user-menu-select-trigger flex h-10 w-full cursor-pointer items-center justify-between gap-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50';

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

  const options = useMemo(() => {
    const now = calendarMonth();
    const from = shiftMonth(now.year, now.month, -MONTHS_BACK);
    const to = shiftMonth(now.year, now.month, MONTHS_FORWARD);
    const selected = { year, month };
    let months = enumerateMonths(from, to);
    if (!months.some((item) => isSameMonth(item, selected))) {
      months = [...months, selected].sort(
        (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
      );
    }
    return months.map((item) => ({
      value: monthKey(item.year, item.month),
      label: formatMonthLabel(item.year, item.month, locale),
    }));
  }, [locale, month, year]);

  return (
    <SelectDropdown
      className="month-selector"
      value={monthKey(year, month)}
      options={options}
      onChange={(value) => {
        const parsed = parseMonthKey(value);
        if (parsed) onChange(parsed);
      }}
      buttonAriaLabel={t('plan.pickMonth')}
      triggerClassName={TRIGGER_CLASS}
      placement="floating"
      preserveOrder
    />
  );
}
