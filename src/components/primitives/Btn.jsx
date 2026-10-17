import { useState } from 'react';
import { C, F, T, BRAND, SH, alpha } from '../../design/tokens.js';
import { Spinner } from './Spinner.jsx';
import { t } from '../../i18n/core.js';

const SIZES = {
  xs: { padding: '4px 8px', fontSize: T.sm },
  sm: { padding: '6px 12px', fontSize: T.sm },
  md: { padding: '8px 16px', fontSize: T.base },
  lg: { padding: '11px 20px', fontSize: T.md },
};

// `hover` is merged over the base style while the pointer is over an enabled
// button. Text colours here all clear WCAG AA against their background.
const VARIANTS = {
  primary:     { base: { background: C.gradAction, color: C.white, border: 'none', boxShadow: SH.brand },
                 hover: { background: C.purpleDark, boxShadow: SH.brandHover } },
  secondary:   { base: { background: C.surface, color: C.textMid, border: `1px solid ${C.border}`, boxShadow: SH.xs },
                 hover: { background: C.surfaceAlt } },
  ghost:       { base: { background: 'transparent', color: C.textSub, border: 'none' },
                 hover: { background: C.surfaceAlt } },
  danger:      { base: { background: C.redSoft, color: C.redText, border: `1px solid ${C.redBorder}` },
                 hover: { background: alpha(C.red, 0.16) } },
  // Filled destructive action (confirm dialogs). #dc2626 is the lightest red
  // that keeps white text above 4.5:1.
  dangerSolid: { base: { background: C.redStrong, color: C.white, border: 'none' },
                 hover: { background: C.redText } },
  // Purple outline (secondary call to action on tinted panels).
  outline:     { base: { background: 'transparent', color: C.purple, border: `1px solid ${C.purple}` },
                 hover: { background: C.purpleSoft } },
  success:     { base: { background: C.greenSoft, color: C.greenText, border: `1px solid ${C.greenBorder}` },
                 hover: { background: alpha(C.green, 0.16) } },
  stripe:      { base: { background: BRAND.stripe, color: C.white, border: 'none' },
                 hover: { background: BRAND.stripeHover } },
  // Inline text action ("Edit", "View all →"). No box, no padding.
  link:        { base: { background: 'none', color: C.purple, border: 'none', padding: 0 },
                 hover: { textDecoration: 'underline' } },
  // Quiet text action (Cancel, Skip, Back): muted until hovered.
  subtle:      { base: { background: 'none', color: C.textMuted, border: 'none', padding: 0, fontWeight: 400, transition: 'color 0.15s' },
                 hover: { color: C.text } },
  // Square icon-only button (close ×, kebab, chevrons). Pass aria-label.
  icon:        { base: { background: 'transparent', color: C.textSub, border: 'none', padding: 6, justifyContent: 'center' },
                 hover: { background: C.surfaceAlt, color: C.text } },
};

// Escape hatch for buttons whose whole look is bespoke (tiles, list rows,
// toggles): resets the native button chrome and adds nothing else, so the
// caller's `style` fully describes it. Still gets focus ring and disabled
// handling from Btn.
const UNSTYLED = { background: 'none', border: 'none', padding: 0 };

export const Btn = ({
  children, variant = 'primary', size = 'md', onClick, disabled, style = {}, icon, loading = false,
  hoverStyle, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp, onFocus, onBlur, ...rest
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const inert = disabled || loading;
  const live = !inert;
  const unstyled = variant === 'unstyled';
  const vr = VARIANTS[variant] || { base: {}, hover: {} };

  const base = unstyled
    ? { ...UNSTYLED, cursor: inert ? 'not-allowed' : 'pointer' }
    : {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: F.sans, fontWeight: 500, borderRadius: 8,
        cursor: inert ? 'not-allowed' : 'pointer',
        transition: 'transform 0.1s ease, background 0.15s, box-shadow 0.15s', whiteSpace: 'nowrap',
        opacity: inert ? 0.5 : 1,
        position: 'relative',
        ...SIZES[size], ...vr.base,
      };
  const restShadow = style.boxShadow ?? vr.base.boxShadow;
  const hoverLayer = hovered && live ? { ...vr.hover, ...hoverStyle } : null;
  const shadow = hoverLayer?.boxShadow ?? restShadow;
  const finalStyle = {
    ...base,
    ...style,
    ...hoverLayer,
    ...(pressed && live ? { transform: 'scale(0.98)' } : null),
    ...(focused && live ? { boxShadow: shadow ? `${shadow}, ${SH.focus}` : SH.focus } : null),
  };

  return (
    <button
      {...rest}
      onClick={loading ? undefined : onClick}
      disabled={inert}
      style={finalStyle}
      onMouseDown={e => { setPressed(true); onMouseDown?.(e); }}
      onMouseUp={e => { setPressed(false); onMouseUp?.(e); }}
      onFocus={e => { setFocused(true); onFocus?.(e); }}
      onBlur={e => { setFocused(false); onBlur?.(e); }}
      onMouseEnter={e => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={e => { setHovered(false); setPressed(false); onMouseLeave?.(e); }}
    >
      {unstyled && !loading ? children : (
        <span style={{ opacity: loading ? 0 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {icon && <span style={{ fontSize: T.md }}>{icon}</span>}
          {children}
        </span>
      )}
      {loading && (
        <span
          data-testid="btn-spinner"
          role="status"
          aria-label={t('ui.loading')}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Spinner />
        </span>
      )}
    </button>
  );
};
