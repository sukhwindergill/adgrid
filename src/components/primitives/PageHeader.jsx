import { C, F, T } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

export const PageHeader = ({ title, subtitle, actions, back, onBack }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
    <div>
      {back && (
        <Btn variant="unstyled" onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          color: C.textSub, fontSize: T.base, fontFamily: F.sans, marginBottom: 8,
        }}>← {back}</Btn>
      )}
      <h1 style={{ fontSize: T.xxl, fontWeight: 700, color: C.text, margin: 0, fontFamily: F.display }}>{title}</h1>
      {subtitle && <p style={{ fontSize: T.base, color: C.textSub, margin: '4px 0 0', fontFamily: F.sans }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
  </div>
);
