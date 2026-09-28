import './styles/input.css';
import '@/clerk/clerk-auth.css';
import './i18n';

import { ClerkProvider } from '@clerk/react';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { CLERK_PUBLISHABLE_KEY } from './app/config';
import { APP_PATHS } from './app/paths';
import { router } from './app/routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, DisabledAuthProvider } from './features/auth/AuthContext';

function Providers({ children }: { children: ReactNode }) {
  if (CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl={APP_PATHS.home}>
        <AuthProvider>{children}</AuthProvider>
      </ClerkProvider>
    );
  }
  return <DisabledAuthProvider>{children}</DisabledAuthProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ThemeProvider>
  </StrictMode>,
);
