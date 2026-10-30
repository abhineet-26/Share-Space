import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SHARESPACE ErrorBoundary caught exception]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-[var(--bg-app)] text-[var(--text-primary)]">
          <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--status-danger)]/40 rounded-[12px] p-6 space-y-4 shadow-xl text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Application Error Encountered
              </h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                An unexpected interface exception occurred. The platform has contained the fault to safeguard your session.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-[6px] bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] font-mono-tech text-[var(--text-muted)] text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[6px] bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] hover:bg-[var(--brand-hover)] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
