import { useTranslation } from 'react-i18next';

import { ACCOUNT_COLORS, type AccountColor } from '../../lib/accountColors';

export function AccountColorPicker({
  value,
  onChange,
}: {
  value: AccountColor;
  onChange: (color: AccountColor) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted text-xs">{t('plan.accountColor')}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('plan.accountColor')}>
        {ACCOUNT_COLORS.map((color) => {
          const selected = value === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(`plan.accountColors.${color}`)}
              title={t(`plan.accountColors.${color}`)}
              className={`account-color-swatch account-color-swatch--${color} ${
                selected ? 'account-color-swatch--selected' : ''
              }`}
              onClick={() => onChange(color)}
            />
          );
        })}
      </div>
    </div>
  );
}
