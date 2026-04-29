import { C, F } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

export const PageHeader = ({ title, subtitle, actions, back, onBack }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
    <div>
      {back && (
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: C.textSub, cursor: 'pointer', fontSize: 13, fontFamily: F.sans, marginBottom: 8, padding: 0,
        }}>← {back}</button>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, fontFamily: F.sans }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: C.textSub, margin: '4px 0 0', fontFamily: F.sans }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
  </div>
);
