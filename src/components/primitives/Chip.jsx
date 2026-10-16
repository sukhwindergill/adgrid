import { C, F, T } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

// Selectable pill (multi-select filters, format pickers, category toggles).
export function Chip({ selected, children, style, ...rest }) {
  return (
    <Btn
      variant="unstyled"
      type="button"
      aria-pressed={selected}
      {...rest}
      style={{
        padding: '6px 12px', borderRadius: 16,
        border: `1px solid ${selected ? C.purple : C.border}`,
        background: selected ? C.purpleSoft : C.surface,
        color: selected ? C.purple : C.textSub,
        fontSize: T.sm, fontFamily: F.sans,
        ...style,
      }}
    >
      {children}
    </Btn>
  );
}
