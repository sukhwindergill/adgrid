import { C, F } from '../../design/tokens.js';

export const Btn = ({ children, variant = 'primary', size = 'md', onClick, disabled, style = {}, icon }) => {
  const sz = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '11px 20px', fontSize: 14 },
  }[size];
  const vr = {
    primary:   { background: C.purple,    color: '#fff',     border: 'none', boxShadow: '0 1px 2px rgba(124,58,237,0.2)' },
    secondary: { background: C.surface,   color: C.textMid,  border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
    ghost:     { background: 'transparent', color: C.textSub, border: 'none' },
    danger:    { background: C.redSoft,   color: C.red,      border: `1px solid ${C.redBorder}` },
    success:   { background: C.greenSoft, color: C.green,    border: `1px solid ${C.greenBorder}` },
    stripe:    { background: '#635bff',   color: '#fff',     border: 'none' },
  }[variant] || {};
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: F.sans, fontWeight: 500, borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        ...sz, ...vr, ...style,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          if (variant === 'primary') e.currentTarget.style.background = C.purpleDark;
          if (variant === 'secondary') e.currentTarget.style.background = C.surfaceAlt;
        }
      }}
      onMouseLeave={e => {
        if (variant === 'primary') e.currentTarget.style.background = C.purple;
        if (variant === 'secondary') e.currentTarget.style.background = C.surface;
      }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {children}
    </button>
  );
};
