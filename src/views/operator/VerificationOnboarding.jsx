import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';

const STEPS = ['intro', 'stripe', 'done'];

function StatusBadge({ status }) {
  const map = {
    unverified:      { label: 'Not started',      bg: C.surfaceAlt, color: C.textMuted },
    pending_stripe:  { label: 'Pending review',   bg: C.amberSoft,  color: C.amber },
    pending_manual:  { label: 'Under review',     bg: C.blueSoft,   color: C.blue },
    verified:        { label: 'Verified',          bg: C.greenSoft,  color: C.green },
    rejected:        { label: 'Rejected',          bg: C.redSoft,    color: C.red },
  };
  const s = map[status] ?? map.unverified;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, fontFamily: F.sans, fontSize: 12, fontWeight: 600,
    }}>{s.label}</span>
  );
}

export function VerificationOnboarding({ profile, onVerified }) {
  const status = profile?.verification_status ?? 'unverified';
  const [step, setStep]   = useState(status === 'unverified' || status === 'rejected' ? 'intro' : 'status');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startStripeVerification = async () => {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-identity-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ returnUrl: window.location.origin }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? 'Failed to start verification. Please try again.');
      return;
    }
    // Redirect to Stripe Identity hosted flow
    window.location.href = json.url;
  };

  // Returning from Stripe Identity
  if (window.location.search.includes('identity=complete') && step !== 'done') {
    setStep('done');
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (step === 'done' || status === 'pending_stripe' || status === 'pending_manual') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 0' }}>
        <PageHeader title="Identity Verification" />
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 8 }}>
            Verification in progress
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, marginBottom: 24 }}>
            {status === 'pending_manual'
              ? 'Our team is reviewing your submission. You\'ll be notified within 1–2 business days.'
              : 'Stripe is processing your documents. This usually takes a few minutes.'}
          </div>
          <StatusBadge status={status} />
          <div style={{ marginTop: 24 }}>
            <Btn variant="ghost" onClick={onVerified}>Back to dashboard</Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 0' }}>
        <PageHeader title="Identity Verification" />
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 8 }}>
            Identity verified
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, marginBottom: 24 }}>
            Your identity has been confirmed. You can now add screens to the platform.
          </div>
          <Btn onClick={onVerified}>Go to dashboard</Btn>
        </Card>
      </div>
    );
  }

  // status === 'rejected'
  const rejectionReason = profile?.verification_rejection_reason;
  if (status === 'rejected') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 0' }}>
        <PageHeader title="Identity Verification" />
        <Card style={{ padding: 32 }}>
          <div style={{
            background: C.redSoft, border: `1px solid ${C.redBorder}`,
            borderRadius: 10, padding: '16px 20px', marginBottom: 24,
          }}>
            <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 14, color: C.red, marginBottom: 4 }}>
              Verification rejected
            </div>
            {rejectionReason && (
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>{rejectionReason}</div>
            )}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, marginBottom: 24 }}>
            Please try again with a clear photo of a valid government-issued ID.
          </div>
          {error && (
            <div style={{ color: C.red, fontFamily: F.sans, fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <Btn onClick={startStripeVerification} loading={loading}>
            Retry verification
          </Btn>
        </Card>
      </div>
    );
  }

  // step === 'intro' (unverified)
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 0' }}>
      <PageHeader title="Verify your identity" subtitle="Required before you can add screens to the platform" />

      <Card style={{ padding: 32, marginBottom: 16 }}>
        <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, marginBottom: 24 }}>
          To keep the platform trustworthy for advertisers, we verify the identity of every screen operator.
          The process takes about 2 minutes and is powered by Stripe Identity.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {[
            ['📄', "Government-issued photo ID", "Passport, driving licence, or national ID card"],
            ['🤳', "Quick selfie", "A live photo to match your ID"],
            ['🔒', "Secure & private", "Documents are handled by Stripe and never stored on our servers"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <div>
                <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.text }}>{title}</div>
                <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, fontFamily: F.sans, fontSize: 13, color: C.red,
          }}>{error}</div>
        )}

        <Btn onClick={startStripeVerification} loading={loading} style={{ width: '100%' }}>
          Start verification
        </Btn>
      </Card>

      <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
        By continuing, you agree to Stripe's{' '}
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer"
          style={{ color: C.purple }}>privacy policy</a>.
      </div>
    </div>
  );
}
