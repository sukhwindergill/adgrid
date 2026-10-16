import { useState } from 'react';
import { C, F, T } from '../../design/tokens.js';

// Base look of text inputs, selects and textareas. Spread onto native
// fields that can't use Inp/SelInput (e.g. inline table editors).
export const fieldStyle = {
  padding: '9px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: T.base, fontFamily: F.sans, color: C.text,
  background: C.surface, outline: 'none',
};

export const fieldFocusStyle = { border: `1px solid ${C.purple}` };

// Focus state for fields: returns [focused, { onFocus, onBlur }], chaining
// any handlers the caller passed.
export function useFieldFocus({ onFocus, onBlur } = {}) {
  const [focused, setFocused] = useState(false);
  return [focused, {
    onFocus: e => { setFocused(true); onFocus?.(e); },
    onBlur: e => { setFocused(false); onBlur?.(e); },
  }];
}

// Smaller field for inline row actions (reason boxes next to Approve/Reject).
export const compactField = { padding: '6px 10px', borderRadius: 6, fontSize: T.sm };
