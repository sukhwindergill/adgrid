import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px 32px', margin: 24, borderRadius: 12,
          border: '1px solid #fca5a5', background: '#fef2f2',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', fontSize: 13,
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
