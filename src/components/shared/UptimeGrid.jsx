import { C, F } from '../../design/tokens.js';

export function UptimeGrid({ hourly }) {
  // 168 hourly buckets (7 days), grouped into 7 rows of 24
  const days = [];
  for (let d = 0; d < 7; d++) days.push(hourly.slice(d * 24, d * 24 + 24));
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayLabels.push(d.toLocaleDateString('en', { weekday: 'short' }));
  }
  return (
    <div>
      {days.map((row, di) => (
        <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: F.sans, width: 26, flexShrink: 0 }}>{dayLabels[di]}</span>
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
        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, marginRight: 10 }}>Online</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: C.border, opacity: 0.4 }} />
        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>No data</span>
      </div>
    </div>
  );
}
