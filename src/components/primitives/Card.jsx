import { C, glass as glassStyle } from '../../design/tokens.js';

export const Card = ({ children, style = {}, onClick, glass = false }) => {
  const baseStyle = glass
    ? { ...glassStyle, borderRadius: 12, padding: 24 }
    : { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 };
  return (
    <div
      onClick={onClick}
      style={{ ...baseStyle, ...style, cursor: onClick ? 'pointer' : undefined, transition: 'box-shadow 0.15s, transform 0.15s' }}
      onMouseEnter={onClick ? e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' : undefined}
      onMouseLeave={onClick ? e => e.currentTarget.style.boxShadow = 'none' : undefined}
    >
      {children}
    </div>
  );
};
