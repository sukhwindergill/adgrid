// src/views/advertiser/createCampaign/Stepper.jsx
import { C, F, T } from '../../../design/tokens.js';
import { TX } from '../../../design/text.js';
import { useT } from '../../../i18n/useT.js';

export function Stepper({ step, labels, onCancel }) {
  const { t } = useT();
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={TX.helperMuted}>{t('create.stepper.stepOf', { step: step + 1, total: labels.length })}</div>
        <button onClick={onCancel} style={{ ...TX.helperMuted, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = C.text; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
        >{t('common.cancel')}</button>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${(step / (labels.length - 1)) * 100}%`, background: C.purple, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {labels.map((l, i) => (
          <div key={l} style={{ fontSize: T.xs, fontFamily: F.sans, color: i <= step ? C.purple : C.textMuted, fontWeight: i === step ? 600 : 400 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
