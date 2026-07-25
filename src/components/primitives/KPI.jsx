import { C, F } from '../../design/tokens.js';
import { Card } from './Card.jsx';

// `trend` is a whole-number percent from lib/periodDelta.js, or null when
// there is no baseline to compare against. Null renders nothing — never a
// placeholder number.
export const KPI = ({ label, value, sub, color = C.text, trend = null, trendLabel = 'vs prior period', icon }) => (
  <Card style={{ padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: F.sans }}>{label}</span>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 4, fontFamily: F.mono }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>{sub}</div>}
    {Number.isFinite(trend) && (
      <div style={{ fontSize: 12, marginTop: 6, color: trend >= 0 ? C.green : C.red, fontFamily: F.sans, fontWeight: 500 }}>
        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% {trendLabel}
      </div>
    )}
  </Card>
);
