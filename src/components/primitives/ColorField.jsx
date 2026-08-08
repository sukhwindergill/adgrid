import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { isValidHexColor } from '../../lib/qrColor.js';

// Swatch + hex input + eyedropper, shared by CreativeCard's Accent Colour
// and QR Dots/Background fields.
//
// Eyedropper has two independent paths, both optional:
//   - Native `window.EyeDropper` (Chrome/Edge only) samples any pixel on
//     screen, including outside the browser window. Button only renders
//     when the API exists -- Safari/Firefox get no dead button.
//   - `onPickFromCreative`, when passed, renders a second "From creative"
//     button. Callers (CreativeCard.jsx) wire this to a canvas-based sample
//     off the actual uploaded creative -- works in every browser, but only
//     the caller knows whether a creative is even uploaded yet, so a null
//     onPickFromCreative hides the button rather than rendering a dead one.
const EyedropperIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 22 1-4 9-9" />
    <path d="M14.5 5.5 18 2l4 4-3.5 3.5" />
    <path d="m10 13 4-4 4 4-4 4-4-4Z" />
  </svg>
);

export function ColorField({ label, value, onChange, onPickFromCreative }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  const hasNativeEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const commitDraft = () => {
    // Lowercased on commit so a manually-typed #ABCDEF matches the case
    // every other producer of this value already guarantees (the native
    // swatch input normalizes on its own, EyeDropper's sRGBHex is spec-
    // lowercase, and sampleMediaColor.js's rgbToHex() is explicit) -- keeps
    // "#rrggbb lowercase" a real invariant, not just true by convention.
    if (isValidHexColor(draft)) onChange(draft.toLowerCase());
    else setDraft(value); // reject: revert to the last valid value
  };

  const openNativeEyeDropper = async () => {
    try {
      const result = await new window.EyeDropper().open();
      setDraft(result.sRGBHex);
      onChange(result.sRGBHex);
    } catch {
      // user cancelled the native picker -- no-op
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* The visible swatch is this div's background, not the native input's
            own rendering. A controlled `value` on input[type="color"] would
            mirror the hex text field's exact string, and jsdom (like real
            browsers) normalizes color-input values to the same lowercase hex
            -- making the two fields indistinguishable to display-value-based
            queries/assistive tech. Keeping the native input uncontrolled
            (trigger + change source only) avoids that while the div stays
            perfectly in sync via plain CSS. Its DOM .value is instead synced
            imperatively in onClick, right before the OS picker opens, so the
            picker starts at the real current color without ever setting a
            React `value`/`defaultValue` prop. */}
        <div style={{ position: 'relative', width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', background: value }}>
          <input
            type="color"
            aria-label={`${label} swatch`}
            onClick={e => { e.currentTarget.value = value; }}
            onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 0, padding: 0, cursor: 'pointer' }}
          />
        </div>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitDraft}
          style={{ width: 80, fontSize: 12, color: C.textSub, fontFamily: F.mono, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px' }}
        />
        {hasNativeEyeDropper && (
          <button
            type="button" onClick={openNativeEyeDropper} title="Pick color from screen"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, cursor: 'pointer', color: C.textSub }}
          >
            <EyedropperIcon />
          </button>
        )}
        {onPickFromCreative && (
          <button
            type="button" onClick={onPickFromCreative} title="Pick color from your creative"
            style={{ padding: '0 10px', height: 32, border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, cursor: 'pointer', fontSize: 11, fontFamily: F.sans, color: C.textSub, whiteSpace: 'nowrap' }}
          >
            From creative
          </button>
        )}
      </div>
    </div>
  );
}
