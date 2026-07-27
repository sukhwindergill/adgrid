import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { CreativePreview } from './CreativePreview.jsx';

const BLUR_BY_TIER = { close: 2, far: 7 };
const TIER_LABEL = { close: 'Up close', far: 'From a distance' };

function scoreColor(score) {
  if (score >= 80) return C.green;
  if (score >= 50) return C.amber;
  return C.red;
}

// Always renders when a score exists, unlike CreativeFitPanel (which only
// shows mismatches) -- the blurred preview is informational (what the ad
// will actually look like), not just a warning, so there's always something
// worth showing even at a perfect score.
export function ReadabilityPanel({ campaign, score, issues = [], tiers = [] }) {
  if (score === null || score === undefined) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: scoreColor(score), fontFamily: F.sans, marginBottom: 4 }}>
        Readability: {score}
      </div>
      {issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
          {issues.map(i => (
            <span key={i.type} style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
              ⚠ {i.message}
            </span>
          ))}
        </div>
      )}
      {tiers.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {tiers.map(tier => (
            <Card key={tier} style={{ padding: 12, width: 180 }}>
              <div style={{ width: '100%', marginBottom: 8 }}>
                <CreativePreview campaign={campaign} blurPx={BLUR_BY_TIER[tier]} />
              </div>
              <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>{TIER_LABEL[tier]}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
