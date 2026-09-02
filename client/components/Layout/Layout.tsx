import { Show, SignInButton, useAuth, useClerk } from '@clerk/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';

import {
  APP_DISPLAY_NAME,
  APP_VERSION,
  CLERK_PUBLISHABLE_KEY,
  LEGAL_ENTITY_NAME,
  LEGAL_PAGE_URL,
} from '../../app/config';
import { APP_PATHS } from '../../app/paths';
import { buildClerkProfileAppearance } from '../../clerk';
import { LanguageSelector } from '../../components/ui/LanguageSelector';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Menu } from '../../components/ui/Menu';
import { UiStyleSelector } from '../../components/ui/UiStyleSelector';
import { useTheme } from '../../context/ThemeContext';
import { bindLocaleOwner, syncLocaleFromServer } from '../../lib/locale';
import { setClerkTokenGetter } from '../../utils/api';
import { AsciiWaveBackground } from './AsciiWaveBackground';
import { HexSideBackground } from './HexSideBackground';
import { PlanSwitcher } from './PlanSwitcher';
import { StaleClientUpdateBanner } from './StaleClientUpdateBanner';

function ClerkTokenBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    setClerkTokenGetter((options) => getToken(options));
    return () => {
      setClerkTokenGetter(null);
    };
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      bindLocaleOwner(null);
      return;
    }
    void syncLocaleFromServer();
  }, [isLoaded, isSignedIn]);

  return null;
}

function ClerkSessionMenu({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const { mode } = useTheme();

  if (!isSignedIn) {
    return (
      <>
        <Link to={APP_PATHS.signIn} className="user-menu-item" role="menuitem" onClick={onClose}>
          {t('app.signIn')}
        </Link>
        <div className="user-menu-divider" role="separator" />
        <LanguageSelector syncRemote={false} />
        <UiStyleSelector />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="user-menu-item text-left"
        role="menuitem"
        onClick={() => {
          onClose();
          clerk.openUserProfile({
            appearance: buildClerkProfileAppearance(mode),
          });
        }}
      >
        {t('app.profile')}
      </button>
      <div className="user-menu-divider" role="separator" />
      <LanguageSelector syncRemote />
      <UiStyleSelector />
      <button
        type="button"
        className="user-menu-item text-left"
        role="menuitem"
        onClick={() => {
          onClose();
          bindLocaleOwner(null);
          void clerk.signOut({ redirectUrl: '/' });
        }}
      >
        {t('app.logout')}
      </button>
    </>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { mode, toggleMode } = useTheme();
  const currentYear = new Date().getFullYear();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);
  const userMenuId = 'budgetplanner-user-menu';

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [userMenuOpen]);

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
                aria-expanded={userMenuOpen}
                aria-controls={userMenuOpen ? userMenuId : undefined}
                aria-label={t('app.userMenu')}
                onClick={() => setUserMenuOpen((prev) => !prev)}
              >
                <MaterialSymbol name="person" filled />
              </button>
              {userMenuOpen ? (
                <Menu>
                  <div id={userMenuId} role="menu" aria-orientation="vertical">
                    {clerkEnabled ? (
                      <ClerkSessionMenu onClose={() => setUserMenuOpen(false)} />
                    ) : (
                      <>
                        <LanguageSelector syncRemote={false} />
                        <UiStyleSelector />
                      </>
                    )}
                  </div>
                </Menu>
              ) : null}
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
      <StaleClientUpdateBanner appVersion={APP_VERSION} />
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
