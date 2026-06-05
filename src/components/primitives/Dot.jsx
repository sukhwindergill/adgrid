import { C } from '../../design/tokens.js';

export const Dot = ({ status }) => {
  const c = {
    live: C.green, active: C.green, pending: C.amber,
    scheduled: C.blue, paused: C.amber, partially_approved: C.amber, completed: C.textMuted, offline: C.red,
  }[status] || C.textMuted;
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />;
};
