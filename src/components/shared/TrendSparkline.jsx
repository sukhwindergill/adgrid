import { C, F } from '../../design/tokens.js';

// A single-series 30-day trend line — area fill, faint horizontal grid,
// emphasized endpoint. One series needs no legend; the card title above it
// names the metric. Deliberately not a library chart: this is the only
// sparkline in the app, and the SVG is small enough to own directly.
export function TrendSparkline({ data, color = C.purple, formatValue = v => v.toLocaleString(), height = 64 }) {
  const width = 100; // viewBox units; scales to container via CSS width:100%
  const values = data.map(p => p.value);
  const max = Math.max(...values, 1);
  const min = 0; // spend/impressions/scans never go negative — baseline at zero

  const points = data.map((p, i) => ({
    x: (i / Math.max(1, data.length - 1)) * width,
    y: height - ((p.value - min) / (max - min || 1)) * (height - 8) - 4,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2) ?? 0} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  const gradId = `spark-fade-${color.replace('#', '')}`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img"
        aria-label={`Trend over the last ${data.length} days, ending at ${formatValue(values[values.length - 1] ?? 0)}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* faint horizontal grid — 3 lines, recessive */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke={C.border} strokeWidth="0.5" />
        ))}
        {data.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}
        {data.length > 1 && (
          <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
        {last && <circle cx={last.x} cy={last.y} r="2.2" fill={color} />}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: F.sans, fontSize: 10, color: C.textMuted }}>
        <span>{data[0]?.day}</span>
        <span style={{ fontFamily: F.mono, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
          {formatValue(values[values.length - 1] ?? 0)}
        </span>
      </div>
    </div>
  );
}
