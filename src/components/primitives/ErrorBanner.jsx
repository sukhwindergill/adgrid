import { C, F } from '../../design/tokens.js';

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      padding: '12px 16px', background: C.redSoft, border: `1px solid ${C.redBorder}`,
      borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16, fontSize: 13, color: C.red, fontFamily: F.sans,
    }}>
      <span>{message}</span>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 18, lineHeight: 1,
      }}>×</button>
    </div>
  );
}
