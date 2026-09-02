import { useTranslation } from 'react-i18next';

import { isAppLocale, LOCALES, setUserLocale } from '../../lib/locale';
import { SelectDropdown } from './SelectDropdown';

const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = {
  en: 'English',
  de: 'Deutsch',
};

export function LanguageSelector({ syncRemote }: { syncRemote: boolean }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language.startsWith('de') ? 'de' : 'en';

  return (
    <div
      className="user-menu-appearance"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="user-menu-appearance-label" id="locale-select-label">
        {t('app.language')}
      </span>
      <SelectDropdown
        id="locale-select"
        value={current}
        options={LOCALES.map((lng) => ({ value: lng, label: LOCALE_LABELS[lng] }))}
        onChange={(value) => {
          if (isAppLocale(value)) void setUserLocale(value, syncRemote);
        }}
        buttonAriaLabel={t('app.language')}
      />
    </div>
  );
}
