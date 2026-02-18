import { Component } from 'react';
import ErrorFallback from './ErrorFallback';

/**
 * ErrorBoundary — ловит ошибки рендера в дочерних компонентах.
 * Props: module (название модуля), theme, children.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`LifeOS [${this.props.module || 'unknown'}]:`, error, errorInfo);
    // Persist to logger
    import('../lib/logger').then(({ logError }) => {
      logError(`RENDER_CRASH [${this.props.module || 'unknown'}]: ${error?.message}`, [
        error?.stack || '',
        'Component stack:',
        errorInfo?.componentStack || 'none',
      ].join('\n'));
    }).catch(() => {});
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          module={this.props.module}
          theme={this.props.theme}
        />
      );
    }
    return this.props.children;
  }
}
