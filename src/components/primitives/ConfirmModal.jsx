import { useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

/**
 * Drop-in replacement for window.confirm().
 *
 * Props:
 *   title       string   — modal heading
 *   message     string   — body text
 *   confirmLabel string  — confirm button label (default "Confirm")
 *   cancelLabel  string  — cancel button label (default "Cancel")
 *   danger       bool    — use red confirm button instead of primary (default false)
 *   onConfirm   () => void
 *   onCancel    () => void
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        style={{
          background: C.surface, borderRadius: 16,
          padding: '28px 32px', width: 400, maxWidth: 'calc(100vw - 48px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div id="confirm-modal-title" style={{ fontFamily: F.sans, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, lineHeight: 1.6, marginBottom: 24, whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" onClick={onCancel}>{cancelLabel}</Btn>
          <Btn
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
