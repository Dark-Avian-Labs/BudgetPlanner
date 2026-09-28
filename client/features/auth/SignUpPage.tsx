import { SignUp } from '@clerk/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { CLERK_PUBLISHABLE_KEY } from '../../app/config';
import { APP_PATHS } from '../../app/paths';
import { ClerkAuthShell, buildClerkAppearance } from '../../clerk';
import { useTheme } from '../../context/ThemeContext';
import { buildAuthPagePath, getAuthRedirectUrl } from './authRedirect';

export function SignUpPage() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const [searchParams] = useSearchParams();
  const redirectUrl = getAuthRedirectUrl(searchParams, APP_PATHS.home);

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="glass-surface mx-auto mt-10 max-w-md p-6 text-sm">
        {t('auth.clerkMissing')}
      </div>
    );
  }

  return (
    <ClerkAuthShell title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <SignUp
        routing="path"
        path={APP_PATHS.signUp}
        signInUrl={buildAuthPagePath(APP_PATHS.signIn, redirectUrl)}
        fallbackRedirectUrl={redirectUrl}
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
