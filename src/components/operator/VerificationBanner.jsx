import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';

export function VerificationBanner({ status, onStartVerification }) {
  if (!status || status === 'verified') return null;

  const configs = {
    unverified: {
      bg: C.amberSoft, border: C.amberBorder, color: C.amber,
      icon: '⚠️',
      message: 'Your identity hasn\'t been verified yet. You need to complete verification before adding screens.',
      action: 'Verify now',
    },
    pending_stripe: {
      bg: C.blueSoft, border: C.blueBorder, color: C.blue,
      icon: '⏳',
      message: 'Your identity verification is being processed by Stripe. This usually takes a few minutes.',
      action: null,
    },
    pending_manual: {
      bg: C.blueSoft, border: C.blueBorder, color: C.blue,
      icon: '🔍',
      message: 'Your submission is under manual review. You\'ll hear back within 1–2 business days.',
      action: null,
    },
    rejected: {
      bg: C.redSoft, border: C.redBorder, color: C.red,
      icon: '❌',
      message: 'Your identity verification was rejected. Please retry with a valid government-issued ID.',
      action: 'Retry verification',
    },
  };

  const cfg = configs[status];
  if (!cfg) return null;

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10,
      padding: '12px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 12, fontFamily: F.sans,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: cfg.color }}>{cfg.message}</span>
      {cfg.action && (
        <Btn size="sm" onClick={onStartVerification} style={{ flexShrink: 0 }}>
          {cfg.action}
        </Btn>
      )}
    </div>
  );
}
