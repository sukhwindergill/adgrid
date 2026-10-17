import { C, F, T } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';
import { t } from '../../i18n/core.js';

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div role="alert" style={{
      padding: '12px 16px', background: C.redSoft, border: `1px solid ${C.redBorder}`,
      borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16, fontSize: T.base, color: C.redText, fontFamily: F.sans,
    }}>
      <span>{message}</span>
      <Btn variant="unstyled" aria-label={t('ui.dismiss')} onClick={onDismiss} style={{ color: C.redText, fontSize: T.lg, lineHeight: 1 }}>×</Btn>
    </div>
  );
}
