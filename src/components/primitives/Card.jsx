import { useState } from 'react';
import { C, SH, glass as glassStyle } from '../../design/tokens.js';

// `lift` raises the card on hover (translate + SH.lift) for browsable
// grids/lists; clickable cards without it get the softer SH.hover.
export const Card = ({ children, style = {}, onClick, glass = false, lift = false, className, ...rest }) => {
  const [hovered, setHovered] = useState(false);
  const interactive = lift || Boolean(onClick);
  const baseStyle = glass
    ? { ...glassStyle, borderRadius: 12, padding: 24 }
    : { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 };
  const hoverStyle = lift ? { transform: 'translateY(-2px)', boxShadow: SH.lift } : { boxShadow: SH.hover };
  return (
    <div
      {...rest}
      className={className}
      onClick={onClick}
      style={{
        ...baseStyle,
        cursor: onClick ? 'pointer' : undefined, transition: 'box-shadow 0.15s, transform 0.15s',
        ...style,
        ...(interactive && hovered ? hoverStyle : null),
      }}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => setHovered(false) : undefined}
    >
      {children}
    </div>
  );
};
