import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from '../components/states';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/** Catches render errors and shows a calm recoverable fallback. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return this.props.fallback ? (
        this.props.fallback(error, this.reset)
      ) : (
        <div className="p-8">
          <ErrorState error={error} onRetry={this.reset} />
        </div>
      );
    }
    return this.props.children;
  }
}
