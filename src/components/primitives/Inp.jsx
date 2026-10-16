import { useId } from 'react';
import { C } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { fieldStyle, fieldFocusStyle, useFieldFocus } from './field.js';

export const Inp = ({ label, hint, error, style = {}, id, onFocus, onBlur, ...p }) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [focused, focusProps] = useFieldFocus({ onFocus, onBlur });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label htmlFor={inputId} style={TX.label}>{label}</label>}
      <input
        {...p}
        id={inputId}
        aria-invalid={error ? true : undefined}
        style={{
          ...fieldStyle, width: '100%', ...(error ? { border: `1px solid ${C.red}` } : null), ...style,
          ...(focused ? fieldFocusStyle : null),
        }}
        {...focusProps}
      />
      {hint && <div style={TX.caption}>{hint}</div>}
      {error && <div style={{ ...TX.caption, color: C.redText }}>{error}</div>}
    </div>
  );
};

// Multi-line counterpart of Inp.
export const TextArea = ({ label, hint, style = {}, id, onFocus, onBlur, ...p }) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [focused, focusProps] = useFieldFocus({ onFocus, onBlur });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label htmlFor={inputId} style={TX.label}>{label}</label>}
      <textarea
        {...p}
        id={inputId}
        style={{ ...fieldStyle, width: '100%', resize: 'vertical', ...style, ...(focused ? fieldFocusStyle : null) }}
        {...focusProps}
      />
      {hint && <div style={TX.caption}>{hint}</div>}
    </div>
  );
};
