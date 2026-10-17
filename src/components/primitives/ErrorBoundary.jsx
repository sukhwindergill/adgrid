import { Component } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';
import { t } from '../../i18n/core.js';

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
      if (this.props.fallback) return this.props.fallback(this.state.error);
      return (
        <div style={{
          padding: '40px 32px', margin: 24, borderRadius: 12,
          border: `1px solid ${C.redBorder}`, background: C.redSoft,
          fontFamily: F.sans,
        }}>
          <div style={{ fontSize: T.lg, fontWeight: 700, color: C.redText, marginBottom: 8 }}>
            {t('ui.somethingWrong')}
          </div>
          <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 16 }}>
            {this.state.error.message}
          </div>
          <Btn variant="dangerSolid" onClick={() => this.setState({ error: null })}>
            {t('ui.tryAgain')}
          </Btn>
        </div>
      );
    }
    return this.props.children;
  }
}
