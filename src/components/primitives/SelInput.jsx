import { useId } from 'react';
import { TX } from '../../design/text.js';
import { fieldStyle, fieldFocusStyle, useFieldFocus } from './field.js';

export const SelInput = ({ label, children, style = {}, wrapperStyle, id, onFocus, onBlur, ...p }) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  const [focused, focusProps] = useFieldFocus({ onFocus, onBlur });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...wrapperStyle }}>
      {label && <label htmlFor={selectId} style={TX.label}>{label}</label>}
      <select
        {...p}
        id={selectId}
        style={{ ...fieldStyle, ...style, ...(focused ? fieldFocusStyle : null) }}
        {...focusProps}
      >
        {children}
      </select>
    </div>
  );
};
