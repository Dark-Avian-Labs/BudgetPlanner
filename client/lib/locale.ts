import i18n from 'i18next';

import { apiJson } from '../utils/api';

export const LOCALES = ['en', 'de'] as const;
export type AppLocale = (typeof LOCALES)[number];

const STORAGE_KEY = 'budgetplanner.locale';

let localeOwnerId: string | null = null;

function storageKey(): string {
  return localeOwnerId ? `${STORAGE_KEY}.${localeOwnerId}` : STORAGE_KEY;
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'de';
}

export function bindLocaleOwner(userId: string | null): void {
  localeOwnerId = userId;
}

export function readStoredLocale(): AppLocale | null {
  try {
    const raw = window.localStorage.getItem(storageKey());
    return isAppLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: AppLocale): void {
  try {
    window.localStorage.setItem(storageKey(), locale);
  } catch {
    // ignore
  }
}

export function resolveInitialLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = readStoredLocale();
  if (stored) return stored;
  const nav = window.navigator.language?.toLowerCase() ?? '';
  if (nav.startsWith('de')) return 'de';
  return 'en';
}

export async function applyLocale(locale: AppLocale): Promise<void> {
  writeStoredLocale(locale);
  document.documentElement.lang = locale;
  if (!i18n.language.startsWith(locale)) {
    await i18n.changeLanguage(locale);
  }
}

export async function setUserLocale(locale: AppLocale, syncRemote: boolean): Promise<void> {
  await applyLocale(locale);
  if (!syncRemote) return;
  try {
    await apiJson('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ locale }),
    });
  } catch {
    // ignore
  }
}

export async function syncLocaleFromServer(): Promise<void> {
  try {
    const me = await apiJson<{ locale?: string; id?: string }>('/api/me');
    if (typeof me.id === 'string' && me.id) bindLocaleOwner(me.id);
    if (isAppLocale(me.locale)) {
      await applyLocale(me.locale);
      return;
    }
  } catch {
    // ignore
  }
  await applyLocale(resolveInitialLocale());
}
