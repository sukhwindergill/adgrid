// src/views/advertiser/createCampaign/TemplatePicker.jsx
import { C, F } from '../../../design/tokens.js';

export const TEMPLATES = [
  { id: 'bottom_bar', label: 'Bottom Bar' },
  { id: 'full_bleed', label: 'Full Bleed' },
  { id: 'split_panel', label: 'Split Panel' },
];

function TemplateSwatch({ id, active, onClick }) {
  const inner = {
    bottom_bar: (
      <div style={{ position: 'absolute', bottom: 6, left: 6, right: 6 }}>
        <div style={{ height: 4, width: '70%', background: '#fff', borderRadius: 1, marginBottom: 3 }} />
        <div style={{ height: 3, width: '35%', background: C.purple, borderRadius: 1 }} />
      </div>
    ),
    full_bleed: (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ height: 4, width: '60%', background: '#fff', borderRadius: 1 }} />
        <div style={{ height: 6, width: '30%', background: C.purple, borderRadius: 3 }} />
      </div>
    ),
    split_panel: (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ width: '40%', background: C.purple, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: 4 }}>
          <div style={{ height: 3, width: '80%', background: '#fff', borderRadius: 1 }} />
          <div style={{ height: 3, width: '50%', background: '#fff', borderRadius: 1 }} />
        </div>
        <div style={{ flex: 1, background: C.surfaceAlt }} />
      </div>
    ),
  }[id];

  return (
    <button type="button" onClick={onClick} style={{
      position: 'relative', width: 60, height: 34, borderRadius: 6, overflow: 'hidden',
      background: '#0d1520', cursor: 'pointer', padding: 0,
      border: `2px solid ${active ? C.purple : C.border}`,
    }}>
      {inner}
    </button>
  );
}

export function TemplatePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {TEMPLATES.map(t => (
        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <TemplateSwatch id={t.id} active={value === t.id} onClick={() => onChange(t.id)} />
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}
