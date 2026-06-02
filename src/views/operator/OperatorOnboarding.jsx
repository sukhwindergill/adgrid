import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

// ── Step definitions ───────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'profile',
    icon: '👤',
    title: 'Your details',
    desc: 'Tell us about you and your business. This appears on your operator profile.',
  },
  {
    id: 'identity',
    icon: '🪪',
    title: 'Verify your identity',
    desc: 'Stripe Identity checks your government-issued ID and takes a quick selfie. Required by regulators before you can receive payouts.',
  },
  {
    id: 'banking',
    icon: '🏦',
    title: 'Set up payouts',
    desc: 'Connect a bank account via Stripe Express. This is how you receive revenue from campaigns. Stripe also collects your business details here.',
  },
  {
    id: 'screen',
    icon: '📺',
    title: 'Register your first screen',
    desc: 'Add the first display to the network. You can register more screens any time from the Screens tab.',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function stepStatus(id, profile, screenCount) {
  switch (id) {
    case 'profile':
      return profile?.name && profile?.company_name ? 'done' : 'todo';
    case 'identity': {
      const s = profile?.verification_status;
      if (s === 'verified')                            return 'done';
      if (s === 'pending_stripe' || s === 'pending_manual') return 'pending';
      return 'todo';
    }
    case 'banking':
      return profile?.connect_status === 'active' ? 'done' : 'todo';
    case 'screen':
      return screenCount > 0 ? 'done' : 'todo';
    default:
      return 'todo';
  }
}

function allDone(profile, screenCount) {
  return STEPS.every(s => stepStatus(s.id, profile, screenCount) === 'done');
}

// Determine which step should be active (first non-done, non-pending)
function activeStep(profile, screenCount) {
  for (const s of STEPS) {
    const st = stepStatus(s.id, profile, screenCount);
    if (st === 'todo' || st === 'pending') return s.id;
  }
  return null;
}

// ── ProfileStep ────────────────────────────────────────────────────────────────

function ProfileStep({ profile, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name:            profile?.name ?? '',
    company_name:    profile?.company_name ?? '',
    company_website: profile?.company_website ?? '',
    timezone:        profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim() || !form.company_name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      name:            form.name.trim(),
      company_name:    form.company_name.trim(),
      company_website: form.company_website.trim() || null,
      timezone:        form.timezone,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Failed to save — please try again.'); return; }
    onSaved({ ...profile, ...form });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Inp
          label="Your name"
          placeholder="Jane Smith"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
        <Inp
          label="Company name"
          placeholder="Smith Media Ltd"
          value={form.company_name}
          onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
        />
      </div>
      <Inp
        label="Company website (optional)"
        placeholder="https://smithmedia.co.uk"
        value={form.company_website}
        onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))}
      />
      <Inp
        label="Timezone"
        placeholder="Europe/London"
        value={form.timezone}
        onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
        hint="Used for scheduling reports and campaign time windows"
      />
      <div>
        <Btn
          onClick={save}
          loading={saving}
          disabled={!form.name.trim() || !form.company_name.trim()}
        >
          Save & continue
        </Btn>
      </div>
    </div>
  );
}

// ── AddScreenInline ────────────────────────────────────────────────────────────

function AddScreenInline({ onAdded }) {
  const [form, setForm] = useState({ name: '', city: 'London', location: '', cpm_floor: '3.00' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('screens').insert({
      name:        form.name.trim(),
      location:    form.location.trim() || form.city,
      city:        form.city,
      status:      'pending',
      operator_id: user.id,
      cpm_floor:   parseFloat(form.cpm_floor) || 3.00,
      cpm:         parseFloat(form.cpm_floor) || 3.00,
      max_ad_duration: 30,
      monthly_revenue: 0,
      campaigns: 0,
    }).select('id, name, screen_token').single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onAdded(data);
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Inp
          label="Screen name"
          placeholder="e.g. Corner Brew — King St"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>City</label>
            <select
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              style={sel}
            >
              {['London','Manchester','Birmingham','Toronto','Vancouver','Edinburgh'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <Inp
            label="CPM floor (£)"
            type="number"
            step="0.50"
            placeholder="3.00"
            value={form.cpm_floor}
            onChange={e => setForm(f => ({ ...f, cpm_floor: e.target.value }))}
          />
        </div>
        <Inp
          label="Location / address"
          placeholder="King St W & Bay St"
          value={form.location}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
        />
        {err && <div style={{ color: C.red, fontFamily: F.sans, fontSize: 12 }}>{err}</div>}
        <div>
          <Btn onClick={save} loading={saving} disabled={!form.name.trim()}>
            Register screen
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Main Onboarding Wizard ────────────────────────────────────────────────────

export function OperatorOnboarding({ profile, screenCount, onComplete, onProfileUpdate, onScreenAdded, onNavigate }) {
  const [localProfile, setLocalProfile] = useState(profile);
  const [localScreenCount, setLocalScreenCount] = useState(screenCount);
  const [connecting, setConnecting] = useState(false);
  const [screenRegistered, setScreenRegistered] = useState(null);

  useEffect(() => { setLocalProfile(profile); }, [profile]);
  useEffect(() => { setLocalScreenCount(screenCount); }, [screenCount]);

  const done = allDone(localProfile, localScreenCount);
  const currentStep = activeStep(localProfile, localScreenCount);

  const startStripeConnect = async () => {
    setConnecting(true);
    const state = crypto.randomUUID();
    sessionStorage.setItem('stripe_connect_state', state);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ returnUrl: window.location.origin, state }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      sessionStorage.removeItem('stripe_connect_state');
      setConnecting(false);
    }
  };

  const startIdentityVerification = async () => {
    onNavigate('op-verify');
  };

  const handleProfileSaved = (updated) => {
    setLocalProfile(updated);
    onProfileUpdate?.(updated);
  };

  const handleScreenAdded = (screen) => {
    setScreenRegistered(screen);
    setLocalScreenCount(c => c + 1);
    onScreenAdded?.(screen);
  };

  const completedCount = STEPS.filter(s => stepStatus(s.id, localProfile, localScreenCount) === 'done').length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  if (done) {
    return (
      <Card style={{ padding: 40, textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 22, color: C.text, marginBottom: 8 }}>
          You're all set!
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, marginBottom: 28 }}>
          Your account is verified, your bank is connected, and your first screen is registered.
          Advertisers can now book campaigns on your screens.
        </div>
        <Btn onClick={() => onComplete?.()}>Go to dashboard →</Btn>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 22, color: C.text, marginBottom: 6 }}>
          Set up your operator account
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, marginBottom: 16 }}>
          Complete these steps to start earning revenue from your screens.
        </div>
        {/* Progress bar */}
        <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: C.purple, borderRadius: 3,
            width: `${pct}%`, transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 6 }}>
          {completedCount} of {STEPS.length} steps complete
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((step, i) => {
          const status = stepStatus(step.id, localProfile, localScreenCount);
          const isActive = step.id === currentStep;
          const isLocked = !isActive && status === 'todo' && STEPS.slice(0, i).some(
            prev => stepStatus(prev.id, localProfile, localScreenCount) === 'todo'
          );

          return (
            <Card
              key={step.id}
              style={{
                padding: '18px 20px',
                border: `1px solid ${isActive ? C.purple : status === 'done' ? C.greenBorder : C.border}`,
                background: status === 'done' ? C.greenLight : isActive ? C.purpleLight : C.surface,
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Status indicator */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  background: status === 'done' ? C.green : isActive ? C.purple : C.border,
                  color: status === 'done' || isActive ? '#fff' : C.textMuted,
                  fontFamily: F.mono, fontWeight: 700,
                }}>
                  {status === 'done' ? '✓' : step.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                    <div style={{
                      fontFamily: F.sans, fontWeight: 600, fontSize: 14,
                      color: status === 'done' ? C.green : C.text,
                    }}>
                      {step.title}
                    </div>
                    {status === 'done' && (
                      <span style={{
                        background: C.greenSoft, color: C.green,
                        fontFamily: F.sans, fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 20,
                      }}>Done</span>
                    )}
                    {status === 'pending' && (
                      <span style={{
                        background: C.amberSoft, color: C.amber,
                        fontFamily: F.sans, fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 20,
                      }}>In progress</span>
                    )}
                  </div>
                  <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>
                    {step.desc}
                  </div>

                  {/* Inline content for active step */}
                  {isActive && (
                    <>
                      {step.id === 'profile' && (
                        <ProfileStep profile={localProfile} onSaved={handleProfileSaved} />
                      )}

                      {step.id === 'identity' && status !== 'pending' && (
                        <div style={{ marginTop: 14 }}>
                          <Btn onClick={startIdentityVerification}>
                            Start verification →
                          </Btn>
                        </div>
                      )}

                      {step.id === 'identity' && status === 'pending' && (
                        <div style={{
                          marginTop: 14, padding: '10px 14px',
                          background: C.amberSoft, border: `1px solid ${C.amberBorder}`,
                          borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.amber,
                        }}>
                          Verification is processing — this usually takes a few minutes.
                          We'll email you when it's done. You can continue setting up your account meanwhile.
                        </div>
                      )}

                      {step.id === 'banking' && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{
                            background: C.blueSoft, border: `1px solid ${C.blueBorder}`,
                            borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                            fontFamily: F.sans, fontSize: 12, color: C.blue,
                          }}>
                            Stripe Express collects your bank account details, confirms your business info,
                            and handles tax forms (if required). Takes about 5 minutes.
                          </div>
                          <Btn onClick={startStripeConnect} loading={connecting}>
                            Connect bank account via Stripe →
                          </Btn>
                        </div>
                      )}

                      {step.id === 'screen' && !screenRegistered && (
                        <AddScreenInline onAdded={handleScreenAdded} />
                      )}

                      {step.id === 'screen' && screenRegistered && (
                        <div style={{
                          marginTop: 14, padding: '12px 16px',
                          background: C.greenSoft, border: `1px solid ${C.greenBorder}`,
                          borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.green,
                        }}>
                          ✓ <strong>{screenRegistered.name}</strong> registered. Get your setup token in the Screens tab.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Step number badge */}
                <div style={{
                  fontFamily: F.sans, fontSize: 11, color: C.textMuted,
                  fontWeight: 600, flexShrink: 0, marginTop: 2,
                }}>
                  {i + 1}/{STEPS.length}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Skip link */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button
          onClick={() => onComplete?.()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: F.sans, fontSize: 12, color: C.textMuted,
            textDecoration: 'underline',
          }}
        >
          I'll finish this later
        </button>
      </div>
    </div>
  );
}

const lbl = {
  display: 'block', fontFamily: F.sans, fontSize: 12,
  fontWeight: 500, color: C.textMid, marginBottom: 6,
};

const sel = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: C.surface,
  fontFamily: F.sans, fontSize: 13, color: C.text, outline: 'none',
};
