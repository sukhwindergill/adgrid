import { C, F } from '../../design/tokens.js';
import { Dot } from './Dot.jsx';

export const Badge = ({ status, children }) => {
  const m = {
    active:           { bg: C.greenSoft,  c: C.green,    b: C.greenBorder },
    live:             { bg: C.greenSoft,  c: C.green,    b: C.greenBorder },
    scheduled:        { bg: C.blueSoft,   c: C.blue,     b: C.blueBorder },
    pending:          { bg: C.amberSoft,  c: C.amber,    b: C.amberBorder },
    pending_review:   { bg: C.amberSoft,  c: C.amber,    b: C.amberBorder },
    paused:           { bg: C.amberSoft,  c: C.amber,    b: C.amberBorder },
    partially_approved: { bg: C.amberSoft,  c: C.amber,    b: C.amberBorder },
    completed:        { bg: C.surfaceAlt, c: C.textSub,  b: C.border },
    rejected:         { bg: C.redSoft,    c: C.red,      b: C.redBorder },
    failed:           { bg: C.redSoft,    c: C.red,      b: C.redBorder },
  };
  const s = m[status] || m.completed;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
      fontFamily: F.sans, background: s.bg, color: s.c, border: `1px solid ${s.b}`,
    }}>
      <Dot status={status} />
      {children || (status === 'pending_review' ? 'Pending Review' : status === 'partially_approved' ? 'Partially Approved' : status.charAt(0).toUpperCase() + status.slice(1))}
    </span>
  );
};
