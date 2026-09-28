import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { hasError: boolean };

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk .* failed/i.test(error.message) ||
    /Failed to fetch dynamically imported module/i.test(error.message) ||
    /ChunkLoadError/i.test(error.message)
  );
}

export class ChunkErrorBoundary extends Component<{ children: ReactNode }, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State | null {
    return isChunkLoadError(error) ? { hasError: true } : null;
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (!isChunkLoadError(error)) throw error;
    console.error('Chunk load failed', error, info);
  }

  public render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center"
        role="alert"
      >
        <p className="text-muted text-sm">This page failed to load. The app may have updated.</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
