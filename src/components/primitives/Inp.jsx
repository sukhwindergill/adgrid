import { C, F } from '../../design/tokens.js';

export const Inp = ({ label, hint, error, style = {}, ...p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    {label && <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans }}>{label}</label>}
    <input
      {...p}
      style={{
        padding: '9px 12px', border: `1px solid ${error ? C.red : C.border}`,
        borderRadius: 8, fontSize: 13, fontFamily: F.sans, color: C.text,
        background: C.surface, outline: 'none', width: '100%', ...style,
      }}
      onFocus={e => e.target.style.borderColor = C.purple}
      onBlur={e => e.target.style.borderColor = error ? C.red : C.border}
    />
    {hint && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{hint}</div>}
    {error && <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans }}>{error}</div>}
  </div>
);
