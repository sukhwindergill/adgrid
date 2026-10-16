import { C, F, SH } from '../../design/tokens.js';

// Centered dialog over a dimmed backdrop. `onBackdropClick` is opt-in: some
// dialogs hold unsaved input and must not close on a stray click.
export function Modal({
  children, onBackdropClick, maxWidth = 480, padding = 28, zIndex = 200,
  panelStyle, labelledBy, label,
}) {
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
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        onClick={onBackdropClick ? e => e.stopPropagation() : undefined}
        style={{
          background: C.surface, borderRadius: 14, width: 'calc(100% - 32px)', maxWidth,
          maxHeight: '90vh', overflowY: 'auto', padding, boxShadow: SH.modal,
          fontFamily: F.sans,
          ...panelStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
