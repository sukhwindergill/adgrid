import { useId } from 'react';
import { C } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { fieldStyle, useFieldFocus } from './Inp.jsx';

export const SelInput = ({ label, children, style = {}, id, onFocus, onBlur, ...p }) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  const [focused, focusProps] = useFieldFocus({ onFocus, onBlur });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label htmlFor={selectId} style={TX.label}>{label}</label>}
      <select
        {...p}
        id={selectId}
        style={{ ...fieldStyle, ...style, ...(focused ? { border: `1px solid ${C.purple}` } : null) }}
        {...focusProps}
      >
        {children}
      </select>
    </div>
  );
};
