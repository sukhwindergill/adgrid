import { C, F, T, SH, alpha } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

// Absolutely-positioned dropdown surface. Position it with `style`
// (top/left/right/width); everything else is the shared popover look.
export function MenuPanel({ children, style, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        position: 'absolute', background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, boxShadow: SH.pop, zIndex: 200, ...style,
      }}
    >
      {children}
    </div>
  );
}

// Full-width row inside a MenuPanel. tone="danger" for destructive rows.
export function MenuItem({ children, tone, style, ...rest }) {
  const danger = tone === 'danger';
  return (
    <Btn
      variant="unstyled"
      {...rest}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
        padding: '8px 16px', fontFamily: F.sans, fontSize: T.base,
        color: danger ? C.redText : C.text, transition: 'background 0.1s',
        ...style,
      }}
      hoverStyle={{ background: danger ? alpha(C.red, 0.06) : C.surfaceAlt }}
    >
      {children}
    </Btn>
  );
}

// Click-away layer behind an open menu.
export function MenuBackdrop({ onClose, zIndex = 190 }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex }} />;
}
