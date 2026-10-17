import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { useT } from '../../i18n/useT.js';

export function UptimeGrid({ hourly }) {
  const { t, formatDate } = useT();
  // 168 hourly buckets (7 days), grouped into 7 rows of 24
  const days = [];
  for (let d = 0; d < 7; d++) days.push(hourly.slice(d * 24, d * 24 + 24));
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayLabels.push(formatDate(d, { weekday: 'short' }));
  }
  return (
    <div>
      {days.map((row, di) => (
        <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ ...TX.caption, width: 26, flexShrink: 0 }}>{dayLabels[di]}</span>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            {row.map((v, hi) => (
              <div key={hi} title={`${String(hi).padStart(2,'0')}:00`} style={{
                flex: 1, height: 12, borderRadius: 2,
                background: v === 1 ? C.green : v === -1 ? C.surfaceAlt : C.border,
                opacity: v === 1 ? 0.85 : 0.4,
              }} />
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: C.green, opacity: 0.85 }} />
        <span style={{ ...TX.caption, marginRight: 10 }}>{t('cards.uptime.online')}</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: C.border, opacity: 0.4 }} />
        <span style={TX.caption}>{t('cards.uptime.noData')}</span>
      </div>
    </div>
  );
}
