import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: 'rgba(255, 51, 102, 0.15)',
          border: '1px solid #ff3366',
          borderRadius: '8px',
          color: '#ff3366',
          margin: '10px',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          overflow: 'auto',
          maxHeight: '300px',
          zIndex: 9999,
          position: 'relative'
        }}>
          <h3 style={{ fontWeight: 'bold' }}>Erro em: {this.props.fallbackTitle || 'Componente'}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px', color: '#ff88aa' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', opacity: 0.7, marginTop: '8px' }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
