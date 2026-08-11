import { SignIn } from '@clerk/react';
import { useTranslation } from 'react-i18next';

import { CLERK_PUBLISHABLE_KEY } from '../../app/config';
import { ClerkAuthShell, buildClerkAppearance } from '../../clerk';
import { useTheme } from '../../context/ThemeContext';

export function SignInPage() {
  const { t } = useTranslation();
  const { mode } = useTheme();

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="glass-surface mx-auto mt-10 max-w-md p-6 text-sm">
        {t('auth.clerkMissing')}
      </div>
    );
  }

  return (
    <ClerkAuthShell title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
