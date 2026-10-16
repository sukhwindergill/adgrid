import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { CreativePreview } from './CreativePreview.jsx';
import { REASON_LABEL } from '../../lib/creativeFit.js';

// Shows only what needs attention: screens the creative does NOT fit.
// Screens that fit, or whose spec is unknown, are never listed here — this
// panel exists to make a problem visible, not to confirm the absence of one.
export function CreativeFitPanel({ campaign, mismatches = [] }) {
  if (!mismatches || mismatches.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: T.base, fontWeight: 600, color: C.amberText, fontFamily: F.sans, marginBottom: 4 }}>
        This creative may not fit {mismatches.length} screen{mismatches.length === 1 ? '' : 's'}
      </div>
      <div style={{ ...TX.helperMuted, marginBottom: 14 }}>
        You can still submit — but the preview below is how it will actually look on each screen.
        Upload a different file for these screens in the per-screen overrides below.
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {mismatches.map(m => (
          <Card key={m.screenId} style={{ padding: 12, width: 180 }}>
            <div style={{ width: '100%', marginBottom: 8 }}>
              <CreativePreview campaign={campaign} aspectRatio={`${m.resolution_w}/${m.resolution_h}`} />
            </div>
            <div style={{ fontSize: T.sm, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
              {m.screenName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {m.reasons.map(r => (
                <span key={r} style={{ fontSize: T.xs, color: C.amberText, fontFamily: F.sans }}>
                  ⚠ {REASON_LABEL[r] ?? r}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
