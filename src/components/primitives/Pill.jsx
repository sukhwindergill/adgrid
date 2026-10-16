import { C, F, T } from '../../design/tokens.js';

// Small rounded status/role chip without the Badge dot.
//   <Pill tone="green">Connected</Pill>   or   <Pill bg={…} color={…}>…</Pill>
const PILL_TONES = {
  neutral: { bg: C.surfaceAlt, color: C.textSub,   border: C.border },
  purple:  { bg: C.purpleSoft, color: C.purple,    border: C.purpleBorder },
  green:   { bg: C.greenSoft,  color: C.greenText, border: C.greenBorder },
  amber:   { bg: C.amberSoft,  color: C.amberText, border: C.amberBorder },
  red:     { bg: C.redSoft,    color: C.redText,   border: C.redBorder },
  blue:    { bg: C.blueSoft,   color: C.blueText,  border: C.blueBorder },
};

export function Pill({ tone = 'neutral', bg, color, border, bordered = false, children, style, ...rest }) {
  const t = PILL_TONES[tone] || PILL_TONES.neutral;
  const b = border ?? (bordered ? t.border : null);
  return (
    <span
      {...rest}
      style={{
        display: 'inline-block', padding: '2px 9px', borderRadius: 12,
        fontSize: T.xs, fontWeight: 600, fontFamily: F.sans, whiteSpace: 'nowrap',
        background: bg ?? t.bg, color: color ?? t.color,
        ...(b ? { border: `1px solid ${b}` } : null),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
