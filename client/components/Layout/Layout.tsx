import { Show, SignInButton, SignOutButton, UserButton, useAuth } from '@clerk/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';

import {
  APP_DISPLAY_NAME,
  CLERK_PUBLISHABLE_KEY,
  LEGAL_ENTITY_NAME,
  LEGAL_PAGE_URL,
} from '../../app/config';
import { APP_PATHS } from '../../app/paths';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Menu } from '../../components/ui/Menu';
import { UiStyleSelector } from '../../components/ui/UiStyleSelector';
import { useTheme } from '../../context/ThemeContext';
import { LOCALES, setUserLocale, syncLocaleFromServer, type AppLocale } from '../../lib/locale';
import { setClerkTokenGetter } from '../../utils/api';
import { AsciiWaveBackground } from './AsciiWaveBackground';
import { HexSideBackground } from './HexSideBackground';
import { PlanSwitcher } from './PlanSwitcher';

function ClerkTokenBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void syncLocaleFromServer();
  }, [isLoaded, isSignedIn]);

  return null;
}

function AuthMenuItems({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="user-menu-divider" role="separator" />
      <Show when="signed-in">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <UserButton />
          <SignOutButton>
            <button type="button" className="btn btn-cancel !min-h-8 !text-xs" onClick={onClose}>
              {t('app.signOut')}
            </button>
          </SignOutButton>
        </div>
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="btn btn-accent mx-2 mb-1 !min-h-8" onClick={onClose}>
            {t('app.signIn')}
          </button>
        </SignInButton>
      </Show>
    </>
  );
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const { mode, toggleMode } = useTheme();
  const currentYear = new Date().getFullYear();
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);

  useEffect(() => {
    if (!settingsMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [settingsMenuOpen]);

  async function chooseLocale(lng: AppLocale) {
    await setUserLocale(lng, clerkEnabled);
    setSettingsMenuOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {clerkEnabled ? <ClerkTokenBridge /> : null}
      <HexSideBackground />
      <AsciiWaveBackground />
      <header className="no-print relative z-30 px-4 pt-4 pb-2 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3">
          <Link to={APP_PATHS.home} className="brand-lockup w-fit min-w-0">
            <span className="brand-lockup__title brand-lockup--fx truncate text-lg sm:text-xl">
              {APP_DISPLAY_NAME}
            </span>
          </Link>

          <div className="flex items-center justify-end gap-2">
            {clerkEnabled ? <PlanSwitcher /> : null}
            <button
              type="button"
              className="icon-toggle-btn"
              onClick={toggleMode}
              aria-label={t('app.theme')}
              title={t('app.theme')}
            >
              <MaterialSymbol name={mode === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                className="icon-toggle-btn"
                aria-haspopup="menu"
                aria-expanded={settingsMenuOpen}
                aria-label={t('app.settings')}
                onClick={() => setSettingsMenuOpen((prev) => !prev)}
              >
                <MaterialSymbol name="settings" />
              </button>
              {settingsMenuOpen && (
                <Menu>
                  <div className="flex flex-col gap-2 p-1">
                    <div className="text-muted px-2 text-xs tracking-wide uppercase">
                      {t('app.language')}
                    </div>
                    <div className="flex gap-2 px-2">
                      {LOCALES.map((lng) => (
                        <button
                          key={lng}
                          type="button"
                          className={`btn btn-secondary !min-h-8 !px-3 !text-xs ${
                            i18n.language.startsWith(lng) ? '!bg-accent/20' : ''
                          }`}
                          onClick={() => {
                            void chooseLocale(lng);
                          }}
                        >
                          {lng.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="user-menu-divider" role="separator" />
                    <UiStyleSelector />
                    {clerkEnabled ? (
                      <AuthMenuItems onClose={() => setSettingsMenuOpen(false)} />
                    ) : null}
                  </div>
                </Menu>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="relative z-0 flex-1 px-4 pb-24 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Outlet />
        </div>
      </main>
      <footer className="no-print relative z-10 flex h-12 items-center justify-center px-4">
        <div className="mx-auto w-full max-w-3xl text-center">
          <a
            href={LEGAL_PAGE_URL}
            className="text-muted hover:text-foreground text-sm"
            target={LEGAL_PAGE_URL.startsWith('http') ? '_blank' : undefined}
            rel={LEGAL_PAGE_URL.startsWith('http') ? 'noreferrer' : undefined}
          >
            ©{currentYear} {LEGAL_ENTITY_NAME}
          </a>
        </div>
      </footer>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="glass-surface p-6 text-sm">
        <p>{t('auth.clerkMissing')}</p>
      </div>
    );
  }

  return (
    <>
      <Show when="signed-out" fallback={null}>
        <div className="glass-surface flex flex-col items-start gap-4 p-6">
          <p className="text-sm">{t('auth.signInSubtitle')}</p>
          <SignInButton mode="modal">
            <button type="button" className="btn btn-accent">
              {t('app.signIn')}
            </button>
          </SignInButton>
        </div>
      </Show>
      <Show when="signed-in">{children}</Show>
    </>
  );
}
