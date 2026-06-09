import { C, F } from '../../design/tokens.js';

export const ProgressBar = ({ value, max, color = C.purple, height = 6, showLabel = false }) => {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0);
  const barColor = pct > 90 ? C.red : pct > 70 ? C.amber : color;
  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: F.sans }}>
          <span style={{ fontSize: 11, color: C.textSub }}>{pct}% used</span>
          <span style={{ fontSize: 11, color: C.textSub }}>${value.toLocaleString()} / ${max.toLocaleString()}</span>
        </div>
      )}
      <div style={{ height, borderRadius: height / 2, background: C.surfaceAlt, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: height / 2, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
};
