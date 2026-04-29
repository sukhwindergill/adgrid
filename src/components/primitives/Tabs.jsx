import { C, F } from '../../design/tokens.js';

export const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
    {tabs.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        style={{
          padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: active === t.id ? 600 : 400,
          color: active === t.id ? C.text : C.textSub,
          borderBottom: active === t.id ? `2px solid ${C.purple}` : '2px solid transparent',
          fontFamily: F.sans, transition: 'all 0.15s', marginBottom: -1,
        }}
      >
        {t.label}
      </button>
    ))}
  </div>
);
