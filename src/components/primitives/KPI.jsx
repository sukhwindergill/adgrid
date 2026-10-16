import { C, F, T } from '../../design/tokens.js';
import { Card } from './Card.jsx';

// `trend` is a whole-number percent from lib/periodDelta.js, or null when
// there is no baseline to compare against. Null renders nothing — never a
// placeholder number.
export const KPI = ({ label, value, sub, color = C.text, trend = null, trendLabel = 'vs prior period', icon }) => (
  <Card style={{ padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ fontSize: T.sm, fontWeight: 500, color: C.textSub, fontFamily: F.sans }}>{label}</span>
      {icon && (
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 8, background: C.purpleSoft, color: C.purple, flexShrink: 0,
        }}>{icon}</span>
      )}
    </div>
    <div style={{ fontSize: T.xxl, fontWeight: 700, color, lineHeight: 1, marginBottom: 4, fontFamily: F.mono }}>{value}</div>
    {sub && <div style={{ fontSize: T.sm, color: C.textMuted, fontFamily: F.sans }}>{sub}</div>}
    {Number.isFinite(trend) && (
      <div style={{ fontSize: T.sm, marginTop: 6, color: trend >= 0 ? C.greenText : C.redText, fontFamily: F.sans, fontWeight: 500 }}>
        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% {trendLabel}
      </div>
    )}
  </Card>
);
