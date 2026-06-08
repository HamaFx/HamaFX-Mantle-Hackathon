'use client';

/**
 * React Error Boundary for HamaFX-Ai web app.
 *
 * Catches render-time errors in child components and shows a graceful
 * fallback UI instead of a blank white page. Wrap critical routes/panels
 * in <ErrorBoundary> to prevent single-component crashes from taking down
 * the entire page.
 */

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** Fallback text shown when an error is caught. */
  fallbackText?: string;
  /** Optional callback fired when the boundary catches an error. */
  onError?: (error: Error, errorInfo: string) => void;
  /** Children wrapped by this boundary. */
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] caught render error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo.componentStack ?? '');
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40svh] flex-col items-center justify-center gap-4 px-6 text-center">
          <span
            aria-hidden
            className="text-bear inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'oklch(68% 0.24 25 / 0.10)' }}
          >
            <AlertTriangle className="size-7" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-fg text-lg font-semibold">
              {this.props.fallbackText ?? 'Something went wrong'}
            </h2>
            <p className="text-fg-muted mt-1 text-sm">
              {this.state.error?.message ?? 'An unexpected error occurred in this component.'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="text-bull focus-ring inline-flex items-center gap-2 rounded-lg border border-divider px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}