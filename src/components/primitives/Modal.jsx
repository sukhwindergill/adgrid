import { useId } from 'react';
import { C, F, T, SH } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from './Btn.jsx';
import { t } from '../../i18n/core.js';

// The × used to dismiss modals, drawers and panels.
export function CloseButton({ onClick, label = t('ui.close'), style }) {
  return (
    <Btn
      variant="unstyled"
      aria-label={label}
      onClick={onClick}
      style={{ fontSize: T.xl, lineHeight: 1, color: C.textMuted, ...style }}
      hoverStyle={{ color: C.text }}
    >×</Btn>
  );
}

// Centered dialog over a dimmed backdrop. Pass `title` (and `onClose` for a
// × button) to get the standard header. `onBackdropClick` is opt-in: some
// dialogs hold unsaved input and must not close on a stray click.
export function Modal({
  children, title, onClose, onBackdropClick, maxWidth = 480, padding = 28, zIndex = 200,
  panelStyle, headerStyle, label,
}) {
  const titleId = useId();
  return (
    <div
      onClick={onBackdropClick}
      style={{
        position: 'fixed', inset: 0, background: C.overlay, zIndex,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        onClick={onBackdropClick ? e => e.stopPropagation() : undefined}
        style={{
          background: C.surface, borderRadius: 14, width: 'calc(100% - 32px)', maxWidth,
          maxHeight: '90vh', overflowY: 'auto', padding, boxShadow: SH.modal,
          fontFamily: F.sans,
          ...panelStyle,
        }}
      >
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, ...headerStyle }}>
            <div id={titleId} style={TX.heading}>{title}</div>
            {onClose && <CloseButton onClick={onClose} />}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
