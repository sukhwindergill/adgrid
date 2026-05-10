import { C, F } from '../../design/tokens.js';

const FONT = `'Inter',-apple-system,BlinkMacSystemFont,sans-serif`;

function Nav({ onOperator, onAdvertiser, onLogin }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(5,10,16,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(20px, 5vw, 80px)', height: 64,
    }}>
      <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '3px', color: '#fff', fontFamily: FONT }}>
        ADGRID
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onOperator} style={{ padding: '8px 16px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
          For Operators
        </button>
        <button onClick={onAdvertiser} style={{ padding: '8px 16px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
          For Advertisers
        </button>
        <button onClick={onLogin} style={{ padding: '8px 20px', background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
          Sign In
        </button>
      </div>
    </nav>
  );
}

function Hero({ onOperator, onAdvertiser }) {
  return (
    <section style={{
      minHeight: '100vh', background: 'linear-gradient(160deg, #050a10 0%, #0d1a2e 60%, #1a0a3e 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(80px, 10vw, 140px) clamp(20px, 5vw, 80px) 80px',
      position: 'relative', overflow: 'hidden', textAlign: 'center',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '40%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ fontSize: 12, letterSpacing: '4px', color: 'rgba(124,58,237,0.8)', fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', marginBottom: 24 }}>
        Digital Out-of-Home Advertising
      </div>
      <h1 style={{ fontSize: 'clamp(36px, 6vw, 80px)', fontWeight: 900, color: '#fff', lineHeight: 1.05, maxWidth: 900, marginBottom: 24, fontFamily: 'Georgia, serif' }}>
        Advertising that you can actually <span style={{ color: '#7c3aed' }}>verify</span>
      </h1>
      <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.55)', maxWidth: 600, lineHeight: 1.7, marginBottom: 48, fontFamily: FONT }}>
        Adgrid connects physical screens with advertisers using computer vision to deliver verified impression counts — real eyeballs, not estimates.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onOperator} style={{
          padding: '16px 36px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        >
          I have screens →
        </button>
        <button onClick={onAdvertiser} style={{
          padding: '16px 36px', background: '#7c3aed', border: 'none',
          borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
          boxShadow: '0 8px 32px rgba(124,58,237,0.4)', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(124,58,237,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,58,237,0.4)'; }}
        >
          I want to advertise →
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 'clamp(32px, 5vw, 80px)', marginTop: 80, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[['Verified', 'Impressions', '#7c3aed'], ['Real-time', 'Demographics', '#10b981'], ['30 min', 'Setup time', '#3b82f6']].map(([val, label, col]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: col, fontFamily: FONT }}>{val}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: FONT, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Register your screen', body: 'Add your display in minutes. Get a unique screen token and a one-command Docker setup.', icon: '🖥' },
    { n: '02', title: 'Connect a camera', body: 'A USB camera + Raspberry Pi 5 (or any mini PC) runs our local CV agent. No images ever leave the device.', icon: '📷' },
    { n: '03', title: 'Accept campaigns', body: 'Advertisers submit campaigns. You review, approve, and get paid automatically via Stripe.', icon: '✓' },
    { n: '04', title: 'Earn verified revenue', body: 'Real impression data means premium CPM. You know exactly what your screen delivers.', icon: '💷' },
  ];

  return (
    <section style={{ padding: 'clamp(60px, 8vw, 120px) clamp(20px, 5vw, 80px)', background: '#0a0f18' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, letterSpacing: '4px', color: 'rgba(124,58,237,0.8)', fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>How it works</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif' }}>Live in under 30 minutes</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
          {steps.map(({ n, title, body, icon }) => (
            <div key={n} style={{ padding: '28px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{icon}</div>
              <div style={{ fontSize: 11, color: '#7c3aed', fontFamily: FONT, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>{n}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: FONT, marginBottom: 10 }}>{title}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', fontFamily: FONT, lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Differentiator() {
  return (
    <section style={{ padding: 'clamp(60px, 8vw, 120px) clamp(20px, 5vw, 80px)', background: 'linear-gradient(160deg, #0d1a2e 0%, #1a0a3e 100%)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '4px', color: 'rgba(124,58,237,0.8)', fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>The Adgrid difference</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: '#fff', lineHeight: 1.1, fontFamily: 'Georgia, serif', marginBottom: 24 }}>
            Every impression is <span style={{ color: '#7c3aed' }}>counted by a camera</span>, not a spreadsheet
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, fontFamily: FONT, marginBottom: 32 }}>
            Traditional DOOH advertising sells estimated CPM based on foot traffic surveys. Adgrid's computer vision runs locally on your hardware and delivers verified people counts, dwell time, and demographic breakdowns — in real time.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              ['👁 Verified impressions', 'Actual face counts, not traffic estimates'],
              ['⏱ Dwell time tracking', 'Know how long people actually watched'],
              ['📊 Live demographics', 'Age bracket + gender, processed locally'],
              ['🔒 Privacy-first', 'No images leave the device, ever'],
            ].map(([title, sub]) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 22 }}>{title.split(' ')[0]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: FONT }}>{title.slice(3)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: FONT, marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mock impression card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32 }}>
          <div style={{ fontSize: 12, color: '#10b981', fontFamily: FONT, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
            LIVE DATA — King St Screen
          </div>
          {[
            ['People in view', '12', '#fff'],
            ['Avg dwell time', '4.2s', '#7c3aed'],
            ['Attention score', '78%', '#10b981'],
            ['Age 25–34', '41%', '#3b82f6'],
            ['Female', '54%', '#ec4899'],
          ].map(([label, val, col]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: FONT }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: col }}>{val}</span>
            </div>
          ))}
          <div style={{ marginTop: 20, padding: '10px 16px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, fontSize: 12, color: '#7c3aed', fontFamily: FONT }}>
            ✓ Verified impression certificate generated
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing({ onSignup }) {
  const tiers = [
    {
      name: 'Starter', price: '£49', period: '/month', screens: 'Up to 3 screens',
      features: ['Screen registration + token', 'Display player URL', 'Basic analytics dashboard', 'Campaign approval flow', 'Stripe Connect payouts'],
      cta: 'Start free for 6 months', highlight: false,
    },
    {
      name: 'Growth', price: '£149', period: '/month', screens: 'Up to 15 screens',
      features: ['Everything in Starter', 'CV impression tracking', 'Demographic analytics', 'Screen Agent Docker package', 'Priority support'],
      cta: 'Start free for 6 months', highlight: true,
    },
    {
      name: 'Enterprise', price: 'Custom', period: '', screens: 'Unlimited screens',
      features: ['Everything in Growth', 'White-label option', 'SLA guarantee', 'Dedicated account manager', 'Custom integrations'],
      cta: 'Contact us', highlight: false,
    },
  ];

  return (
    <section style={{ padding: 'clamp(60px, 8vw, 120px) clamp(20px, 5vw, 80px)', background: '#050a10' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, letterSpacing: '4px', color: 'rgba(124,58,237,0.8)', fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', marginBottom: 12 }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', fontFamily: FONT }}>First 6 months free for early operator partners</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {tiers.map(({ name, price, period, screens, features, cta, highlight }) => (
            <div key={name} style={{
              padding: 32, borderRadius: 20,
              background: highlight ? 'linear-gradient(160deg, #1a0a3e, #2d1060)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${highlight ? '#7c3aed' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: highlight ? '0 0 60px rgba(124,58,237,0.2)' : 'none',
              position: 'relative',
            }}>
              {highlight && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20, fontFamily: FONT, letterSpacing: 1 }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: FONT, marginBottom: 8 }}>{name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: FONT, marginBottom: 20 }}>{screens}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 28 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: '#fff', fontFamily: FONT }}>{price}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: FONT }}>{period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', fontSize: 14, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: FONT }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={onSignup} style={{
                width: '100%', padding: '12px 0',
                background: highlight ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                border: highlight ? 'none' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                boxShadow: highlight ? '0 6px 24px rgba(124,58,237,0.35)' : 'none',
              }}>
                {cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ onLogin }) {
  return (
    <footer style={{ background: '#030608', padding: 'clamp(40px, 5vw, 80px) clamp(20px, 5vw, 80px)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '3px', color: 'rgba(255,255,255,0.3)', fontFamily: FONT }}>ADGRID</div>
        <div style={{ display: 'flex', gap: 32 }}>
          {['Privacy', 'Terms', 'Contact'].map(l => (
            <span key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontFamily: FONT, cursor: 'pointer' }}>{l}</span>
          ))}
          <span onClick={onLogin} style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontFamily: FONT, cursor: 'pointer' }}>Sign In</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', fontFamily: FONT }}>© 2026 Adgrid</div>
      </div>
    </footer>
  );
}

export function MarketingHome({ onSignup, onLogin }) {
  return (
    <div style={{ background: '#050a10', minHeight: '100vh', fontFamily: FONT }}>
      <Nav onOperator={onSignup} onAdvertiser={onSignup} onLogin={onLogin} />
      <Hero onOperator={onSignup} onAdvertiser={onSignup} />
      <HowItWorks />
      <Differentiator />
      <Pricing onSignup={onSignup} />
      <Footer onLogin={onLogin} />
    </div>
  );
}
