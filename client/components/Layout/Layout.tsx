import { useAuth, useClerk } from '@clerk/react';
import { Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';

import feathers from '../../../assets/feathers.png';
import {
  APP_DISPLAY_NAME,
  APP_ID,
  APP_VERSION,
  CLERK_PUBLISHABLE_KEY,
  LEGAL_ENTITY_NAME,
  LEGAL_PAGE_URL,
} from '../../app/config';
import { APP_PATHS } from '../../app/paths';
import { buildClerkProfileAppearance } from '../../clerk';
import { ChunkErrorBoundary } from '../../components/ui/ChunkErrorBoundary';
import { LanguageSelector } from '../../components/ui/LanguageSelector';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Menu } from '../../components/ui/Menu';
import { UiStyleSelector } from '../../components/ui/UiStyleSelector';
import { useRovingMenu } from '../../components/ui/useRovingMenu';
import { useTheme } from '../../context/ThemeContext';
import { bindLocaleOwner, syncLocaleFromServer } from '../../lib/locale';
import { AsciiWaveBackground } from './AsciiWaveBackground';
import { DalAppNav } from './DalAppNav';
import { HexSideBackground } from './HexSideBackground';
import { PlanSwitcher } from './PlanSwitcher';
import { StaleClientUpdateBanner } from './StaleClientUpdateBanner';

function ClerkTokenBridge() {
  const { isLoaded, isSignedIn } = useAuth();

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
        <Link
          to={APP_PATHS.signIn}
          className="user-menu-item"
          role="menuitem"
          tabIndex={-1}
          onClick={onClose}
        >
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
        tabIndex={-1}
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
        tabIndex={-1}
        onClick={() => {
          onClose();
          bindLocaleOwner(null);
          void clerk.signOut({ redirectUrl: APP_PATHS.home });
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
  const { menuRef, triggerRef, onMenuKeyDown } = useRovingMenu(userMenuOpen, setUserMenuOpen);
  const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);
  const userMenuId = 'budgetplanner-user-menu';

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {clerkEnabled ? <ClerkTokenBridge /> : null}
      <HexSideBackground />
      <AsciiWaveBackground />
      <DalAppNav currentAppId={APP_ID} />
      <header className="no-print relative z-30 px-4 pt-4 pb-2 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link to={APP_PATHS.home} className="brand-lockup w-fit min-w-0">
              <img
                src={feathers}
                alt="Dark Avian Labs feather mark"
                className="brand-lockup__icon"
              />
              <span className="brand-lockup__title brand-lockup--fx truncate text-lg sm:text-xl">
                {APP_DISPLAY_NAME}
              </span>
            </Link>
            <span
              className="text-muted shrink-0 font-mono text-[10px] leading-none tracking-wide opacity-70"
              title={`Client ${APP_VERSION}`}
            >
              v{APP_VERSION}
            </span>
          </div>

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
                ref={triggerRef}
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
                  <div
                    id={userMenuId}
                    role="menu"
                    aria-orientation="vertical"
                    onKeyDown={onMenuKeyDown}
                  >
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
      <main id="main-content" className="relative z-0 flex-1 px-4 pb-24 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <ChunkErrorBoundary>
            <Suspense
              fallback={
                <p className="text-muted py-6 text-sm" role="status">
                  {t('app.loading')}
                </p>
              }
            >
              <Outlet />
            </Suspense>
          </ChunkErrorBoundary>
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
