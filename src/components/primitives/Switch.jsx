import { C, SH } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

const SIZES = {
  sm: { w: 30, h: 17, knob: 13, pad: 2 },
  md: { w: 44, h: 24, knob: 18, pad: 3 },
};

// Visual track + knob only. Use inside a button/row that owns the click,
// or use <Toggle> for a standalone switch.
export function SwitchTrack({ on, size = 'md' }) {
  const s = SIZES[size];
  return (
    <span aria-hidden="true" style={{
      display: 'inline-block', position: 'relative', flexShrink: 0,
      width: s.w, height: s.h, borderRadius: 999,
      background: on ? C.purple : C.borderDark, transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: s.pad, left: on ? s.w - s.knob - s.pad : s.pad,
        width: s.knob, height: s.knob, borderRadius: '50%', background: C.white,
        transition: 'left 0.2s', boxShadow: SH.knob,
      }} />
    </span>
  );
}

// Accessible toggle switch — real button with role="switch", reachable and
// operable from the keyboard.
export function Toggle({ checked, onChange, size = 'md', ...rest }) {
  return (
    <Btn
      variant="unstyled"
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      {...rest}
      style={{ display: 'inline-flex', flexShrink: 0, borderRadius: 999 }}
    >
      <SwitchTrack on={checked} size={size} />
    </Btn>
  );
}
