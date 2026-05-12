import { C } from '../../design/tokens.js';

const keyframes = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}`;

if (typeof document !== 'undefined' && !document.getElementById('skeleton-style')) {
  const s = document.createElement('style');
  s.id = 'skeleton-style';
  s.textContent = keyframes;
  document.head.appendChild(s);
}

export function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: C.surfaceAlt,
      animation: 'skeleton-pulse 1.6s ease-in-out infinite',
      flexShrink: 0,
      ...style,
    }} />
  );
}

export function SkeletonRow({ cols = 4, gap = 14 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height={80} radius={10} />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3, style = {} }) {
  return (
    <div style={{
      padding: 20, borderRadius: 12,
      border: `1px solid ${C.border}`,
      background: C.surface,
      display: 'flex', flexDirection: 'column', gap: 10,
      ...style,
    }}>
      <Skeleton width="60%" height={14} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 2 ? '40%' : '100%'} height={12} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* header */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: '10px 16px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width="50%" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 12, padding: '14px 16px',
          background: r % 2 === 0 ? C.surface : C.bg,
          borderRadius: 6,
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={12} width={c === 0 ? '80%' : '60%'} />
          ))}
        </div>
      ))}
    </div>
  );
}
