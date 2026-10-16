import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.display }}>{title}</h2>
        {subtitle && <p style={{ ...TX.bodySub, margin: '3px 0 0' }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
