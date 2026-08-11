import { useTranslation } from 'react-i18next';

import { frequencyNumber } from '../../lib/dueThisMonth';
import type { EntryFrequency } from '../../lib/types';
import { MaterialSymbol } from '../ui/MaterialSymbol';

export function FrequencyBadge({ frequency }: { frequency: EntryFrequency }) {
  const { t } = useTranslation();
  const n = frequencyNumber(frequency);
  const label = t(`entry.${frequency}`);

  return (
    <span className="text-muted inline-flex items-center gap-0.5" title={label} aria-label={label}>
      <MaterialSymbol name="calendar_month" className="text-[1.1rem] leading-none" />
      <span className="text-xs font-medium tabular-nums">{frequency === 'once' ? '×' : n}</span>
    </span>
  );
}
