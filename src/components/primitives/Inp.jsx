import { useId, useState } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';

export const fieldStyle = {
  padding: '9px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: T.base, fontFamily: F.sans, color: C.text,
  background: C.surface, outline: 'none',
};

// Shared focus handling for Inp / SelInput / textareas: purple border while focused.
export function useFieldFocus({ onFocus, onBlur } = {}) {
  const [focused, setFocused] = useState(false);
  return [focused, {
    onFocus: e => { setFocused(true); onFocus?.(e); },
    onBlur: e => { setFocused(false); onBlur?.(e); },
  }];
}

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
          ...(focused ? { border: `1px solid ${C.purple}` } : null),
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
        style={{ ...fieldStyle, width: '100%', resize: 'vertical', ...style, ...(focused ? { border: `1px solid ${C.purple}` } : null) }}
        {...focusProps}
      />
      {hint && <div style={TX.caption}>{hint}</div>}
    </div>
  );
};
