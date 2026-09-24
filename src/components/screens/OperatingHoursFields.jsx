import { C, F } from '../../design/tokens.js';
import { Inp } from '../primitives/Inp.jsx';

// Hours form for screens.operating_hours_*; value shape and the save/validate
// helpers live in lib/operatingHours.js.

export function OperatingHoursFields({ value, onChange }) {
  const overnight = !value.allDay && value.start && value.end && value.end < value.start;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
        Operating hours
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 10, lineHeight: 1.5 }}>
        Ads only play between these times, in the screen's local timezone.
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, fontFamily: F.sans, marginBottom: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value.allDay}
          onChange={e => onChange({ ...value, allDay: e.target.checked })}
        />
        Open 24 hours
      </label>
      {!value.allDay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Inp label="Opens" type="time" value={value.start}
            onChange={e => onChange({ ...value, start: e.target.value })} />
          <Inp label="Closes" type="time" value={value.end}
            onChange={e => onChange({ ...value, end: e.target.value })} />
        </div>
      )}
      {overnight && (
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 6 }}>
          Runs overnight — closes at {value.end} the next day.
        </div>
      )}
    </div>
  );
}
