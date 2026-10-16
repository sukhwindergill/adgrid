import { C, F, T } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

export const Tabs = ({ tabs, active, onChange }) => (
  <div role="tablist" style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
    {tabs.map(t => (
      <Btn
        variant="unstyled"
        key={t.id}
        role="tab"
        aria-selected={active === t.id}
        onClick={() => onChange(t.id)}
        style={{
          padding: '10px 16px',
          fontSize: T.base, fontWeight: active === t.id ? 600 : 400,
          color: active === t.id ? C.text : C.textSub,
          borderBottom: active === t.id ? `2px solid ${C.purple}` : '2px solid transparent',
          fontFamily: F.sans, transition: 'all 0.15s', marginBottom: -1,
        }}
      >
        {t.label}
      </Btn>
    ))}
  </div>
);
