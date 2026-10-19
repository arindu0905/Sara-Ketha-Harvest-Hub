import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props { children: React.ReactNode; resetKey?: string; compact?: boolean }
interface State { error: Error | null }

/**
 * Catches a crash in any page and shows a friendly message instead of a blank white screen.
 * The error clears itself when the user navigates to another page (resetKey changes).
 */
class Boundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={`flex items-center justify-center px-4 ${this.props.compact ? 'py-16' : 'min-h-screen bg-surface-50'}`}>
        <div className="card max-w-md w-full p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle size={26} className="text-amber-600" />
          </div>
          <h2 className="font-display text-xl font-bold text-surface-900">Something went wrong on this page</h2>
          <p className="mt-2 text-sm text-surface-500">Your data is safe. Reload the page, or go back and try again.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw size={16} /> Reload page
            </button>
            <button type="button" onClick={() => { window.location.href = '/'; }} className="btn-secondary inline-flex items-center gap-2">
              <Home size={16} /> Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Error boundary that resets when the route changes. Must be rendered inside the router. */
export const ErrorBoundary: React.FC<{ children: React.ReactNode; compact?: boolean }> = ({ children, compact }) => {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname} compact={compact}>{children}</Boundary>;
};
