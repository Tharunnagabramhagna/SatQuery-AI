import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // In production, log to error reporting service (Sentry, etc.)
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[400px] flex items-center justify-center p-6"
        >
          <div className="w-full max-w-md p-6 rounded-2xl border border-rose-500/20 bg-white/80 dark:bg-[#0b1120]/90 backdrop-blur-md shadow-xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>

            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              {this.props.fallbackMessage ||
                'An unexpected rendering error occurred in this workspace component. No data was lost. You can reset the view or reload the page.'}
            </p>

            <div className="flex items-center justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Try Again
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={this.handleReload}
                icon={<Home className="w-3.5 h-3.5" />}
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
