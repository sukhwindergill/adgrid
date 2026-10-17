import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Inp } from '../primitives/Inp.jsx';
import { useT } from '../../i18n/useT.js';

// Hours form for screens.operating_hours_*; value shape and the save/validate
// helpers live in lib/operatingHours.js.

export function OperatingHoursFields({ value, onChange }) {
  const { t } = useT();
  const overnight = !value.allDay && value.start && value.end && value.end < value.start;
  return (
    <div>
      <div style={{ ...TX.label, marginBottom: 4 }}>
        {t('scr.hours.title')}
      </div>
      <div style={{ ...TX.caption, marginBottom: 10, lineHeight: 1.5 }}>
        {t('scr.hours.sub')}
      </div>
      <label style={{ ...TX.body, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value.allDay}
          onChange={e => onChange({ ...value, allDay: e.target.checked })}
        />
        {t('scr.hours.allDay')}
      </label>
      {!value.allDay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Inp label={t('scr.hours.opens')} type="time" value={value.start}
            onChange={e => onChange({ ...value, start: e.target.value })} />
          <Inp label={t('scr.hours.closes')} type="time" value={value.end}
            onChange={e => onChange({ ...value, end: e.target.value })} />
        </div>
      )}
      {overnight && (
        <div style={{ ...TX.caption, marginTop: 6 }}>
          {t('scr.hours.overnight', { time: value.end })}
        </div>
      )}
    </div>
  );
}
