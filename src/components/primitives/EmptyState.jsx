import { C } from '../../design/tokens.js';
import { TX } from '../../design/text.js';

const TITLE = {
  md: { ...TX.title, marginBottom: 4 },
  lg: { ...TX.titleLg, marginBottom: 6 },
};

// Centered "nothing here yet" panel: optional icon, title, description,
// then any extra children (e.g. a call-to-action button).
export function EmptyState({ icon, title, description, children, size = 'md', padding = '48px 24px', style, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        textAlign: 'center', padding, background: C.surface,
        border: `1px solid ${C.border}`, borderRadius: 12, ...style,
      }}
    >
      {icon && (
        <div style={{ color: C.textMuted, marginBottom: size === 'lg' ? 12 : 8, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      )}
      {title && <div style={TITLE[size]}>{title}</div>}
      {description && <div style={TX.bodySub}>{description}</div>}
      {children}
    </div>
  );
}
