import { C, F } from '../../design/tokens.js';

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{title}</h2>
        {subtitle && <p style={{ margin: '3px 0 0', fontSize: 13, color: C.textSub, fontFamily: F.sans }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
