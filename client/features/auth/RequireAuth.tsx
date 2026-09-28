import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { CLERK_PUBLISHABLE_KEY } from '../../app/config';
import { APP_PATHS } from '../../app/paths';
import { useAuth } from './AuthContext';
import { buildAuthPagePath, safeAuthRedirectPath } from './authRedirect';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { auth, refresh } = useAuth();
  const location = useLocation();
  const returnTo =
    safeAuthRedirectPath(`${location.pathname}${location.search}${location.hash}`) ??
    APP_PATHS.home;

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="glass-surface p-6 text-sm">
        <p>{t('auth.clerkMissing')}</p>
      </div>
    );
  }

  if (auth.status === 'loading') {
    return <p className="text-muted py-6 text-sm">{t('auth.checkingSession')}</p>;
  }

  if (auth.status === 'error') {
    return (
      <div className="glass-panel mx-auto mt-8 max-w-md p-8 text-center" role="alert">
        <h1 className="text-lg font-semibold">{t('auth.sessionErrorTitle')}</h1>
        <p className="text-muted mt-2 text-sm">{t('auth.sessionErrorHint')}</p>
        <button type="button" className="btn btn-accent mt-4" onClick={() => void refresh()}>
          {t('app.retry')}
        </button>
      </div>
    );
  }

  if (auth.status !== 'authenticated') {
    return (
      <div className="glass-panel mx-auto w-full max-w-lg p-8 text-center">
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
        <p className="text-muted mb-6 text-sm leading-relaxed">{t('auth.signInSubtitle')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to={buildAuthPagePath(APP_PATHS.signUp, returnTo)}
            className="btn btn-accent w-full sm:w-auto"
          >
            {t('auth.signUpTitle')}
          </Link>
          <Link
            to={buildAuthPagePath(APP_PATHS.signIn, returnTo)}
            className="btn btn-secondary w-full sm:w-auto"
          >
            {t('app.signIn')}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
