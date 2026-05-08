import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';

export function Placeholder({ title, subtitle, icon = '🚧' }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28 }}>{subtitle}</div>
      <Card style={{ textAlign: 'center', padding: 64 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>Coming Soon</div>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>This feature is under development.</div>
      </Card>
    </div>
  );
}
