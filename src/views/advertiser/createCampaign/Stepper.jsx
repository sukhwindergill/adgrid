// src/views/advertiser/createCampaign/Stepper.jsx
import { C, F } from '../../../design/tokens.js';

export function Stepper({ step, labels, onCancel }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>Step {step + 1} of {labels.length}</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>Cancel</button>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${(step / (labels.length - 1)) * 100}%`, background: C.purple, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {labels.map((l, i) => (
          <div key={l} style={{ fontSize: 10, fontFamily: F.sans, color: i <= step ? C.purple : C.textMuted, fontWeight: i === step ? 600 : 400 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
