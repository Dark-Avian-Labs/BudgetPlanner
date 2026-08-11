import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resolveInitialLocale } from '../lib/locale';
import de from './locales/de.json';
import en from './locales/en.json';

const initialLocale = resolveInitialLocale();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLocale;
}

export default i18n;
