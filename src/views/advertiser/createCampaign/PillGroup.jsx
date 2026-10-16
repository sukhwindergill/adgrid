// src/views/advertiser/createCampaign/PillGroup.jsx
import { C, F, T } from '../../../design/tokens.js';
import { Btn } from '../../../components/primitives/Btn.jsx';

export function PillGroup({ options, value, onChange, multi = false }) {
  const vals = multi ? (value || []) : null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = multi ? vals.includes(v) : value === v;
        return (
          <Btn variant="unstyled" key={v} type="button" onClick={() => {
            if (multi) {
              onChange(active ? vals.filter(x => x !== v) : [...vals, v]);
            } else {
              onChange(v);
            }
          }} style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${active ? C.purple : C.border}`, background: active ? C.purpleSoft : C.surface, color: active ? C.purple : C.textSub, fontSize: T.sm, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s' }} hoverStyle={!active ? { background: C.surfaceAlt } : undefined}>{l}</Btn>
        );
      })}
    </div>
  );
}
