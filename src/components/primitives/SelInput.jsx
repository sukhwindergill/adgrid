import { C, F } from '../../design/tokens.js';

export const SelInput = ({ label, children, style = {}, ...p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    {label && <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans }}>{label}</label>}
    <select
      {...p}
      style={{
        padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
        fontSize: 13, fontFamily: F.sans, color: C.text, background: C.surface, outline: 'none', ...style,
      }}
      onFocus={e => e.target.style.borderColor = C.purple}
      onBlur={e => e.target.style.borderColor = C.border}
    >
      {children}
    </select>
  </div>
);
