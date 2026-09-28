import { lazy } from 'react';
import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';

import { App } from '../App';
import { Layout } from '../components/Layout/Layout';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
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

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<App />}>
      <Route element={<Layout />}>
        <Route path={APP_PATHS.home} element={<HomePage />} />
        <Route path={APP_PATHS.plan} element={<PlanPage />} />
        <Route path={APP_PATHS.invite} element={<InvitePage />} />
        <Route path={APP_PATHS.legal} element={<LegalPage />} />
        <Route path={`${APP_PATHS.signIn}/*`} element={<SignInPage />} />
        <Route path={`${APP_PATHS.signUp}/*`} element={<SignUpPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>,
  ),
);
