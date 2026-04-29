import { C, F } from '../../design/tokens.js';
import { Card } from './Card.jsx';

export const KPI = ({ label, value, sub, color = C.text, trend, icon }) => (
  <Card style={{ padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: F.sans }}>{label}</span>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 4, fontFamily: F.mono }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ fontSize: 12, marginTop: 6, color: trend >= 0 ? C.green : C.red, fontFamily: F.sans, fontWeight: 500 }}>
        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
      </div>
    )}
  </Card>
);
