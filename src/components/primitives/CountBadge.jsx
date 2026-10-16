import { C, F, T } from '../../design/tokens.js';

// Pending-count bubble on nav items. Dark text on amber: white on this
// amber is only 2.1:1.
const SIZES = { sm: 14, md: 16, lg: 18 };

export function CountBadge({ count, size = 'md', style }) {
  if (!count) return null;
  const h = SIZES[size];
  return (
    <span style={{
      minWidth: h, height: h, borderRadius: h / 2, padding: size === 'lg' ? '0 5px' : size === 'md' ? '0 4px' : '0 3px',
      background: C.amber, color: C.text, fontSize: T.xs, fontWeight: 700, fontFamily: F.sans,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      ...style,
    }}>{count > 99 ? '99+' : count}</span>
  );
}
