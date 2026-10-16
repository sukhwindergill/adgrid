import { useState } from 'react';

// Element whose style changes on hover, driven by state instead of mutating
// e.currentTarget.style. `hoverStyle` is merged over `style` while hovered.
//   <Hover style={row} hoverStyle={{ background: C.bg }}>…</Hover>
//   <Hover as="tr" …>
export function Hover({ as = 'div', style, hoverStyle, disabled = false, onMouseEnter, onMouseLeave, children, ...rest }) {
  const [hovered, setHovered] = useState(false);
  const Tag = as;
  return (
    <Tag
      {...rest}
      style={hovered && !disabled ? { ...style, ...hoverStyle } : style}
      onMouseEnter={e => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={e => { setHovered(false); onMouseLeave?.(e); }}
    >
      {children}
    </Tag>
  );
}
