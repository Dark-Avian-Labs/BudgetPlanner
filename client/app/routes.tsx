import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router';

import { Layout } from '../components/Layout/Layout';
import { APP_PATHS } from './paths';

const HomePage = lazy(() =>
  import('../features/home/HomePage').then((mod) => ({ default: mod.HomePage })),
);
const PlanPage = lazy(() =>
  import('../features/plan/PlanPage').then((mod) => ({ default: mod.PlanPage })),
);
const InvitePage = lazy(() =>
  import('../features/invite/InvitePage').then((mod) => ({ default: mod.InvitePage })),
);
const SignInPage = lazy(() =>
  import('../features/auth/SignInPage').then((mod) => ({ default: mod.SignInPage })),
);
const SignUpPage = lazy(() =>
  import('../features/auth/SignUpPage').then((mod) => ({ default: mod.SignUpPage })),
);
const LegalPage = lazy(() =>
  import('../features/legal/LegalPage').then((mod) => ({ default: mod.LegalPage })),
);

function RouteFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted text-sm">{t('app.loading')}</p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={APP_PATHS.signIn} element={<SignInPage />} />
        <Route path={APP_PATHS.signUp} element={<SignUpPage />} />
        <Route element={<Layout />}>
          <Route path={APP_PATHS.home} element={<HomePage />} />
          <Route path="/plan/:planId" element={<PlanPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path={APP_PATHS.legal} element={<LegalPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
