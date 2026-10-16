import { useState } from 'react';
import { C, SH, glass as glassStyle } from '../../design/tokens.js';

export const Card = ({ children, style = {}, onClick, glass = false, className, ...rest }) => {
  const [hovered, setHovered] = useState(false);
  const baseStyle = glass
    ? { ...glassStyle, borderRadius: 12, padding: 24 }
    : { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 };
  return (
    <div
      {...rest}
      className={className}
      onClick={onClick}
      style={{
        ...baseStyle, ...style,
        cursor: onClick ? 'pointer' : undefined, transition: 'box-shadow 0.15s, transform 0.15s',
        ...(onClick && hovered ? { boxShadow: SH.hover } : null),
      }}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
      {children}
    </div>
  );
};
