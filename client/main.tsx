import './styles/input.css';
import '@/clerk/clerk-auth.css';
import './i18n';

import { ClerkProvider } from '@clerk/react';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './App';
import { CLERK_PUBLISHABLE_KEY } from './app/config';
import { ThemeProvider } from './context/ThemeContext';

function Providers({ children }: { children: ReactNode }) {
  if (CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        {children}
      </ClerkProvider>
    );
  }
  return children;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <Providers>
          <App />
        </Providers>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
