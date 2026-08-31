import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle: string;
  fallbackHint: string;
  fallbackReloadLabel: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="glass-surface mx-auto mt-8 max-w-md p-6">
          <h1 className="text-lg font-semibold">{this.props.fallbackTitle}</h1>
          <p className="text-muted mt-2 text-sm">{this.props.fallbackHint}</p>
          <div className="modal-actions mt-4">
            <Button variant="accent" onClick={() => window.location.reload()}>
              {this.props.fallbackReloadLabel}
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
