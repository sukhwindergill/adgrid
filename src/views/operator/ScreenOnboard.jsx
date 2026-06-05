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

function StepRegister({ onNext, onBack, onScreenCreated }) {
  return <div>Step 2 — coming in Task 2</div>;
}

function StepSetup({ screen, onNext, onBack, onSkip }) {
  return <div>Step 3 — coming in Task 3</div>;
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
