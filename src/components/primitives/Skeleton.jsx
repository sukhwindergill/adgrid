import { C } from '../../design/tokens.js';

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style = {} }) {
  return <div className="skeleton-shimmer" style={{ width, height, borderRadius, ...style }} />;
}

export function SkeletonKPI() {
  return (
    <div style={{ padding: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <Skeleton height={12} width="55%" style={{ marginBottom: 12 }} />
      <Skeleton height={30} width="75%" style={{ marginBottom: 8 }} />
      <Skeleton height={10} width="45%" />
    </div>
  );
}
