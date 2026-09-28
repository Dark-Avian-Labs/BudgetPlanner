import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { ErrorBoundary } from './components/ui/ErrorBoundary';

export function App() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary
      fallbackTitle={t('app.crashTitle')}
      fallbackHint={t('app.crashHint')}
      fallbackReloadLabel={t('app.crashReload')}
    >
      <Outlet />
    </ErrorBoundary>
  );
}
