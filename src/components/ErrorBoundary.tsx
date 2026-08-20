import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 mb-6">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-2">
            An unexpected error occurred while rendering this page.
          </p>
          {this.state.error && (
            <p className="text-xs text-slate-500 font-mono bg-slate-900/80 rounded-lg px-4 py-2 max-w-lg mx-auto mb-6 overflow-hidden text-ellipsis">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-slate-950 font-semibold text-sm rounded-lg hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
