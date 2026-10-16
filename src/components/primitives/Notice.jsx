import { C, F, T } from '../../design/tokens.js';

// Inline status box (form errors, warnings, info callouts). Text colours are
// the AA-safe *Text tokens, not the fill colours.
export const NOTICE_TONES = {
  error:   { background: C.redSoft,    border: `1px solid ${C.redBorder}`,    color: C.redText },
  warning: { background: C.amberSoft,  border: `1px solid ${C.amberBorder}`,  color: C.amberText },
  alert:   { background: C.amberWash,  border: `1px solid ${C.amberStrong}`,  color: C.amberText },
  success: { background: C.greenSoft,  border: `1px solid ${C.greenBorder}`,  color: C.greenText },
  info:    { background: C.blueSoft,   border: `1px solid ${C.blueBorder}`,   color: C.blueText },
  brand:   { background: C.purpleSoft, border: `1px solid ${C.purpleBorder}`, color: C.text },
  neutral: { background: C.surfaceAlt, border: `1px solid ${C.border}`,       color: C.textSub },
};

export function Notice({ tone = 'error', children, style, role, ...rest }) {
  return (
    <div
      {...rest}
      role={role ?? (tone === 'error' ? 'alert' : undefined)}
      style={{
        padding: '10px 14px', borderRadius: 8, fontSize: T.sm, fontFamily: F.sans, lineHeight: 1.5,
        ...NOTICE_TONES[tone], ...style,
      }}
    >
      {children}
    </div>
  );
}
