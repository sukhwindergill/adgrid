import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { ErrorBanner } from '../../components/primitives/ErrorBanner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function WizardProgress({ step, total, onCancel }) {
  const pct = ((step - 1) / (total - 1)) * 100;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
          Step {step} of {total}
        </div>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}
        >
          Cancel
        </button>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: C.purple, borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {['Welcome', 'Register', 'Setup', 'Connect'].map((label, i) => (
          <div key={label} style={{
            fontSize: 11, fontFamily: F.sans,
            color: i + 1 <= step ? C.purple : C.textMuted,
            fontWeight: i + 1 === step ? 600 : 400,
          }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>📺</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, fontFamily: F.sans, marginBottom: 12, margin: '0 0 12px' }}>
          Let's get your screen on the network
        </h1>
        <p style={{ fontSize: 15, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6, margin: '0 0 32px' }}>
          ADGRID connects your display to advertisers who pay to reach your audience. Setup takes about 5 minutes.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
          {[
            { icon: '📺', text: 'Works on any display — TV, monitor, or commercial screen' },
            { icon: '⚡', text: '5 minutes to set up' },
            { icon: '💰', text: 'Start earning from day one' },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              padding: '16px 12px', background: C.surfaceAlt, borderRadius: 10,
              fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
              {text}
            </div>
          ))}
        </div>

        <Btn onClick={onNext} style={{ width: '100%', fontSize: 16, padding: '14px 24px' }}>
          Get Started →
        </Btn>
      </Card>
    </div>
  );
}

// ─── Placeholders for remaining steps (added in later tasks) ──────────────────

const CITIES = ['Toronto', 'London', 'Manchester', 'Birmingham', 'Vancouver', 'Edinburgh'];

function StepRegister({ onBack, onScreenCreated }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', location: '', city: 'Toronto', display_size: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const valid = form.name.trim() && form.location.trim() && form.city && form.display_size.trim();

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    const { data, error } = await supabase.from('screens').insert({
      name:           form.name.trim(),
      location:       form.location.trim(),
      city:           form.city,
      display_size:   form.display_size.trim(),
      status:         'pending',
      operator_id:    user.id,
      max_ad_duration: 30,
      monthly_revenue: 0,
      campaigns:      0,
    }).select('id, name, screen_token').single();

    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false);
    onScreenCreated({ id: data.id, name: data.name, screen_token: data.screen_token });
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4, margin: '0 0 4px' }}>
          Tell us about your screen
        </h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28, margin: '0 0 28px' }}>
          These details help advertisers find and book your screen.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <Inp
            label="Screen Name"
            placeholder="e.g. Corner Brew — King St"
            value={form.name}
            onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
          />
          <Inp
            label="Location / Address"
            placeholder="e.g. King St W & Bay St, Toronto"
            value={form.location}
            onChange={e => setForm(s => ({ ...s, location: e.target.value }))}
          />
          <SelInput
            label="City"
            value={form.city}
            onChange={e => setForm(s => ({ ...s, city: e.target.value }))}
          >
            {CITIES.map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <Inp
            label="Display Size"
            placeholder="e.g. 55 inch 4K, 72 inch LED"
            value={form.display_size}
            onChange={e => setForm(s => ({ ...s, display_size: e.target.value }))}
          />
        </div>

        <ErrorBanner message={err} onDismiss={() => setErr(null)} />

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack} style={{ flex: 1 }}>← Back</Btn>
          <Btn onClick={handleSubmit} disabled={!valid || saving} style={{ flex: 2 }}>
            {saving ? 'Registering…' : 'Next →'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

const HARDWARE_OPTIONS = ['Browser Kiosk', 'Raspberry Pi 5', 'Mini PC', 'Android TV'];

function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 12,
          color: C.text, wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {value}
        </div>
        <Btn variant="secondary" size="sm" onClick={copy} style={{ flexShrink: 0, minWidth: 64 }}>
          {copied ? '✓ Copied' : 'Copy'}
        </Btn>
      </div>
    </div>
  );
}

function CodeBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#0a0a0a', borderRadius: 8, padding: '14px 16px',
          fontFamily: F.mono, fontSize: 11, color: '#a3e635',
          whiteSpace: 'pre', overflowX: 'auto', margin: 0,
        }}>{value}</pre>
        <button onClick={copy} style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 4, color: '#fff', fontSize: 11, padding: '3px 10px',
          cursor: 'pointer', fontFamily: F.sans,
        }}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function HardwareInstructions({ hardware, screen }) {
  const playerUrl = `${window.location.origin}/display/${screen.screen_token}`;
  const composeSnippet = `version: "3"
services:
  display:
    image: adgrid/screen-agent:latest
    environment:
      SCREEN_TOKEN: "${screen.screen_token}"
      SUPABASE_URL: "${import.meta.env.VITE_SUPABASE_URL || ''}"
      SUPABASE_ANON_KEY: "${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}"
    devices:
      - /dev/video0:/dev/video0
    restart: unless-stopped`;

  if (hardware === 'Browser Kiosk') return (
    <div>
      <CopyBox label="Player URL" value={playerUrl} />
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7 }}>
        Open this URL fullscreen on your display.<br />
        On Chrome: press <kbd style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 }}>F11</kbd> for fullscreen.<br />
        The screen will automatically show ads when campaigns are running.
      </div>
    </div>
  );

  if (hardware === 'Raspberry Pi 5' || hardware === 'Mini PC') return (
    <div>
      <CodeBox label="docker-compose.yml" value={composeSnippet} />
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.8 }}>
        1. Install Docker on your device.<br />
        2. Save the above as <code style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 }}>docker-compose.yml</code>.<br />
        3. Run: <code style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 }}>docker-compose up -d</code><br />
        4. Connect a USB camera to /dev/video0 for CV impression tracking.
      </div>
    </div>
  );

  // Android TV
  return (
    <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.8 }}>
      1. Enable Developer Options on your Android TV.<br />
      2. Install the ADGRID APK via sideloading.<br />
      3. Enter your screen token when prompted.
      <div style={{ marginTop: 12 }}>
        <CopyBox label="Screen Token" value={screen.screen_token} />
      </div>
    </div>
  );
}

function StepSetup({ screen, onNext, onBack, onSkip }) {
  const [hardware, setHardware] = useState('Browser Kiosk');

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>
          Set up your display
        </h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>
          Choose your hardware and follow the instructions below.
        </p>

        {/* Hardware selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {HARDWARE_OPTIONS.map(hw => (
            <button key={hw} onClick={() => setHardware(hw)} style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${hardware === hw ? C.purple : C.border}`,
              background: hardware === hw ? C.purpleSoft : C.surface,
              color: hardware === hw ? C.purple : C.textSub,
              fontSize: 12, fontWeight: 500, fontFamily: F.sans,
              transition: 'all 0.15s',
            }}>{hw}</button>
          ))}
        </div>

        {/* Token (always visible) */}
        <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
          <CopyBox label="Your Screen Token" value={screen.screen_token} />
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>
            Keep this private — it authenticates your display.
          </div>
        </div>

        {/* Hardware-specific instructions */}
        <div style={{ marginBottom: 28 }}>
          <HardwareInstructions hardware={hardware} screen={screen} />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Btn variant="secondary" onClick={onBack} style={{ flexShrink: 0 }}>← Back</Btn>
          <Btn onClick={onNext} style={{ flex: 1 }}>I've completed setup →</Btn>
          <button onClick={onSkip} style={{
            background: 'none', border: 'none', fontSize: 12, color: C.textMuted,
            cursor: 'pointer', fontFamily: F.sans, flexShrink: 0,
          }}>Do this later →</button>
        </div>
      </Card>
    </div>
  );
}

function StepConnect({ screen, onDone, onSkip }) {
  return <div>Step 4 — coming in Task 4</div>;
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function ScreenOnboardView({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [newScreen, setNewScreen] = useState(null); // set after Step 2 insert

  const handleScreenCreated = (screen) => {
    setNewScreen(screen);
    setStep(3);
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <WizardProgress step={step} total={4} onCancel={onCancel} />

      {step === 1 && (
        <StepWelcome onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <StepRegister
          onBack={() => setStep(1)}
          onScreenCreated={handleScreenCreated}
        />
      )}
      {step === 3 && newScreen && (
        <StepSetup
          screen={newScreen}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
          onSkip={() => onComplete(newScreen)}
        />
      )}
      {step === 4 && newScreen && (
        <StepConnect
          screen={newScreen}
          onDone={() => onComplete(newScreen)}
          onSkip={() => onComplete(newScreen)}
        />
      )}
    </div>
  );
}
