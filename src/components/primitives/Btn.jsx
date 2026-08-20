import { C, F } from '../../design/tokens.js';
import { Spinner } from './Spinner.jsx';

export const Btn = ({ children, variant = 'primary', size = 'md', onClick, disabled, style = {}, icon, loading = false }) => {
  const sz = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '11px 20px', fontSize: 14 },
  }[size];
  const vr = {
    primary:   { background: C.grad,      color: '#fff',     border: 'none', boxShadow: '0 1px 8px rgba(0,194,255,0.2)' },
    secondary: { background: C.surface,   color: C.textMid,  border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
    ghost:     { background: 'transparent', color: C.textSub, border: 'none' },
    danger:    { background: C.redSoft,   color: C.red,      border: `1px solid ${C.redBorder}` },
    success:   { background: C.greenSoft, color: C.green,    border: `1px solid ${C.greenBorder}` },
    stripe:    { background: '#635bff',   color: '#fff',     border: 'none' },
  }[variant] || {};
  return (
    <button
      onClick={loading ? undefined : onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: F.sans, fontWeight: 500, borderRadius: 8,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
        opacity: (disabled || loading) ? 0.5 : 1,
        position: 'relative',
        ...sz, ...vr, ...style,
      }}
      onMouseEnter={e => {
        if (!disabled && !loading) {
          if (variant === 'primary') {
            e.currentTarget.style.background = C.purpleDark;
            e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,194,255,0.35)';
          }
          if (variant === 'secondary') e.currentTarget.style.background = C.surfaceAlt;
          if (variant === 'ghost') e.currentTarget.style.background = C.surfaceAlt;
          if (variant === 'danger') e.currentTarget.style.background = 'rgba(239,68,68,0.16)';
          if (variant === 'success') e.currentTarget.style.background = 'rgba(16,185,129,0.16)';
          if (variant === 'stripe') e.currentTarget.style.background = '#5147e6';
        }
      }}
      onMouseLeave={e => {
        if (variant === 'primary') {
          e.currentTarget.style.background = C.grad;
          e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,194,255,0.2)';
        }
        if (variant === 'secondary') e.currentTarget.style.background = C.surface;
        if (variant === 'ghost') e.currentTarget.style.background = 'transparent';
        if (variant === 'danger') e.currentTarget.style.background = C.redSoft;
        if (variant === 'success') e.currentTarget.style.background = C.greenSoft;
        if (variant === 'stripe') e.currentTarget.style.background = '#635bff';
      }}
    >
      <span style={{ opacity: loading ? 0 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        {children}
      </span>
      {loading && (
        <span
          data-testid="btn-spinner"
          role="status"
          aria-label="Loading"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Spinner />
        </span>
      )}
    </button>
  );
};
