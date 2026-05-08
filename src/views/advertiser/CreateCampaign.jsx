import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { SCREENS, CATEGORIES, DAYS, HOURS } from '../../lib/data.js';

const STEP_LABELS = ['Location & Screens', 'Schedule & Creative', 'Budget & Launch'];

// Deterministic mock distances per screen
const mockDist = (s) => Math.abs(parseInt(s.id.replace('SCR-', '')) * 7 % 20) / 2 + 1;

const SCREEN_POSITIONS = {
  'SCR-001': [30, 55], 'SCR-002': [60, 30], 'SCR-003': [75, 65],
  'SCR-004': [45, 40], 'SCR-006': [55, 70], 'SCR-008': [25, 35], 'SCR-009': [40, 75],
};

const DEVICE_PRESETS = {
  portrait:  { w: 160, h: 284, label: 'Portrait 9:16' },
  landscape: { w: 284, h: 160, label: 'Landscape 16:9' },
  '4k':      { w: 320, h: 180, label: '4K 16:9' },
};

function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, maxWidth: 600 }}>
      {STEP_LABELS.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: F.mono, fontSize: 13, fontWeight: 600,
              background: i < step ? C.green : i === step ? C.purple : C.border,
              color: i <= step ? '#fff' : C.textMuted,
            }}>{i < step ? '✓' : i + 1}</div>
            <span style={{ fontSize: 11, fontFamily: F.sans, color: i === step ? C.text : C.textMuted, fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div style={{ flex: 1, height: 1, background: i < step ? C.green : C.border, margin: '0 8px', marginBottom: 20, minWidth: 30 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function CreateCampaign({ onSave, onCancel }) {
  const [step, setStep]     = useState(0);
  const [radius, setRadius] = useState(8);
  const [selected, setSelected] = useState([]);
  const [device, setDevice] = useState('landscape');
  const [form, setForm] = useState({
    advertiser: '', category: 'Food & Beverage',
    start: '', end: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    timeStart: '07:00', timeEnd: '20:00', slots: 10, duration: 10,
    budget: 500, headline: '', cta: 'Learn More →', color: '#7c3aed', destination: '',
  });
  const [errors, setErrors] = useState({});

  const liveScreens  = SCREENS.filter(s => s.status === 'live');
  const visibleScreens = liveScreens.filter(s => mockDist(s) <= radius);
  const selScreenObjs  = liveScreens.filter(s => selected.includes(s.id));
  const primaryScreen  = selScreenObjs[0] || liveScreens[0];

  const days = form.start && form.end ? Math.max(1, Math.round((new Date(form.end) - new Date(form.start)) / (1000 * 60 * 60 * 24))) : 30;
  const estImpr = primaryScreen ? Math.round((primaryScreen.impressions * (form.slots / 100) / 30) * days * Math.max(1, selected.length)) : 0;

  const validate = () => {
    const e = {};
    if (!form.advertiser.trim()) e.advertiser = 'Required';
    if (!form.start) e.start = 'Required';
    if (!form.end)   e.end   = 'Required';
    if (!form.destination.includes('.')) e.destination = 'Enter a valid URL';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLaunch = () => {
    if (!validate()) return;
    const screenId = selected[0] || liveScreens[0]?.id;
    const screen   = SCREENS.find(s => s.id === screenId);
    onSave({
      id: `BK-${String(Date.now()).slice(-4)}`,
      ...form, screenId,
      screen: screen?.name || '',
      city: screen?.city || '',
      spent: 0, impressions: 0, scans: 0, status: 'scheduled',
    });
  };

  const toggleScreen = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const dev = DEVICE_PRESETS[device];

  return (
    <div>
      <PageHeader title="New Campaign" back="Overview" onBack={onCancel} />
      <Stepper step={step} />

      {/* Step 0: Location & Screen Selection */}
      {step === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Select Screens by Area</div>

            {/* Mock map */}
            <div style={{
              position: 'relative', height: 280, borderRadius: 12, overflow: 'hidden',
              background: 'linear-gradient(135deg, #e8eaf0, #dde1ee)',
              border: `1px solid ${C.border}`, marginBottom: 16,
            }}>
              {/* Grid lines */}
              {[20, 40, 60, 80].map(p => (
                <div key={`h${p}`} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.5)' }} />
              ))}
              {[20, 40, 60, 80].map(p => (
                <div key={`v${p}`} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.5)' }} />
              ))}
              {/* Radius circle */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                width: radius * 12, height: radius * 12,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%', background: 'rgba(124,58,237,0.08)',
                border: `2px dashed ${C.purple}`,
              }} />
              {/* Center pin */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', background: C.purple, boxShadow: `0 0 0 4px ${C.purpleSoft}` }} />
              {/* Screen pins */}
              {liveScreens.map(s => {
                const [x, y] = SCREEN_POSITIONS[s.id] || [50, 50];
                const inRadius = mockDist(s) <= radius;
                const isSel = selected.includes(s.id);
                return (
                  <div key={s.id} onClick={() => inRadius && toggleScreen(s.id)} title={s.name} style={{
                    position: 'absolute', left: `${x}%`, top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 14, height: 14, borderRadius: '50%',
                    background: isSel ? C.purple : inRadius ? C.green : C.textMuted,
                    border: `2px solid #fff`,
                    cursor: inRadius ? 'pointer' : 'default',
                    boxShadow: isSel ? `0 0 0 3px ${C.purpleSoft}` : 'none',
                    transition: 'all 0.15s',
                  }} />
                );
              })}
              <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 10, fontFamily: F.sans, color: C.textSub, background: 'rgba(255,255,255,0.8)', padding: '3px 7px', borderRadius: 4 }}>
                {visibleScreens.length} screens in radius
              </div>
            </div>

            {/* Radius slider */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans }}>Search Radius</label>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.purple, fontFamily: F.mono }}>{radius} km</span>
              </div>
              <input type="range" min={1} max={25} value={radius} onChange={e => setRadius(parseInt(e.target.value))} style={{ width: '100%', accentColor: C.purple }} />
            </div>

            {/* Screen list */}
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 10 }}>
              Available Screens ({visibleScreens.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleScreens.map(s => (
                <div key={s.id} onClick={() => toggleScreen(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 10, border: `1px solid ${selected.includes(s.id) ? C.purple : C.border}`,
                  background: selected.includes(s.id) ? C.purpleSoft : C.surface,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected.includes(s.id) ? C.purple : C.border}`,
                    background: selected.includes(s.id) ? C.purple : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {selected.includes(s.id) && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{s.city} · {(s.impressions / 1000).toFixed(0)}K impr/mo · £{s.cpm} CPM</div>
                  </div>
                  <span style={{ fontSize: 11, color: C.textMuted, fontFamily: F.mono }}>{mockDist(s).toFixed(1)} km</span>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Selection Summary</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.purple, fontFamily: F.mono, marginBottom: 4 }}>{selected.length}</div>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 16 }}>screens selected</div>
            {selected.length === 0 && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 16 }}>Select at least 1 screen to continue</div>}
            {selScreenObjs.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: 12, color: C.text }}>{s.name}</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>{s.city}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Step 1: Schedule & Creative */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Campaign Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Inp label="Brand / Advertiser Name" placeholder="e.g. Tim Hortons" value={form.advertiser} onChange={e => setForm(f => ({ ...f, advertiser: e.target.value }))} error={errors.advertiser} />
                <SelInput label="Ad Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </SelInput>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Inp label="Start Date" type="date" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} error={errors.start} min={new Date().toISOString().split('T')[0]} />
                  <Inp label="End Date" type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} error={errors.end} min={form.start} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, display: 'block', marginBottom: 6 }}>Days of Week</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DAYS.map(d => {
                      const on = (form.days || []).includes(d);
                      return (
                        <button key={d} onClick={() => setForm(f => ({ ...f, days: on ? f.days.filter(x => x !== d) : [...f.days, d] }))}
                          style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${on ? C.purple : C.border}`, background: on ? C.purpleSoft : C.surface, color: on ? C.purple : C.textSub, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: F.sans }}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <SelInput label="Start Time" value={form.timeStart} onChange={e => setForm(f => ({ ...f, timeStart: e.target.value }))}>
                    {HOURS.map(h => <option key={h}>{h}</option>)}
                  </SelInput>
                  <SelInput label="End Time" value={form.timeEnd} onChange={e => setForm(f => ({ ...f, timeEnd: e.target.value }))}>
                    {HOURS.map(h => <option key={h}>{h}</option>)}
                  </SelInput>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Creative</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Inp label="Ad Headline" placeholder="e.g. Start Your Morning Right" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} />
                <Inp label="Call to Action" placeholder="e.g. Order Now →" value={form.cta} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))} />
                <Inp label="QR Code Destination URL" placeholder="https://yoursite.com/promo" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} error={errors.destination} hint="Where people go after scanning your QR code" />
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, display: 'block', marginBottom: 6 }}>Accent Colour</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#0a0a0a'].map(col => (
                      <div key={col} onClick={() => setForm(f => ({ ...f, color: col }))}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: col, cursor: 'pointer', border: `3px solid ${form.color === col ? C.purple : 'transparent'}`, outline: `1px solid ${C.border}` }} />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Device preview */}
          <Card style={{ position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Preview</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {Object.entries(DEVICE_PRESETS).map(([k, v]) => (
                <button key={k} onClick={() => setDevice(k)} style={{
                  flex: 1, padding: '5px', borderRadius: 6, fontSize: 10, fontFamily: F.sans, cursor: 'pointer',
                  border: `1px solid ${device === k ? C.purple : C.border}`,
                  background: device === k ? C.purpleSoft : C.surface,
                  color: device === k ? C.purple : C.textSub,
                }}>{v.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: dev.w, height: dev.h, borderRadius: 8, overflow: 'hidden', position: 'relative', background: 'linear-gradient(145deg,#050a10,#0a1520)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.88),rgba(0,0,0,0.1))' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
                  <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 4, fontFamily: F.sans }}>{form.category}</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: dev.h > 200 ? 14 : 10, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>{form.headline || 'Your Headline'}</div>
                  <div style={{ display: 'inline-block', padding: '3px 8px', border: `1px solid ${form.color}`, color: form.color, fontSize: 7, borderRadius: 2, fontFamily: F.sans }}>{form.cta}</div>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: form.color }} />
                {/* QR overlay */}
                <div style={{ position: 'absolute', bottom: 6, right: 6, width: 20, height: 20, background: '#fff', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>⬛</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Budget & Launch */}
      {step === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 20 }}>Campaign Budget</div>
            <Inp label="Total Campaign Budget (£)" type="number" min={100} value={form.budget}
              onChange={e => setForm(f => ({ ...f, budget: parseInt(e.target.value) || 0 }))}
              hint={`~${estImpr.toLocaleString()} impressions over ${days} days`} />
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              {[['Total Impressions', estImpr.toLocaleString()], ['Expected Scans', Math.floor(estImpr * 0.003).toLocaleString()], ['Estimated ROI', `${estImpr > 0 ? ((Math.floor(estImpr * 0.003) * 12) / form.budget * 100).toFixed(0) : 0}%`], ['Cost per Scan', `£${estImpr > 0 ? (form.budget / Math.max(1, estImpr * 0.003)).toFixed(2) : '—'}`]].map(([l, v]) => (
                <div key={l} style={{ padding: 16, background: C.purpleSoft, borderRadius: 10, border: `1px solid ${C.purpleBorder}` }}>
                  <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Campaign Summary</div>
            {[['Brand', form.advertiser || '—'], ['Screens', selected.length > 0 ? `${selected.length} selected` : liveScreens[0]?.name || '—'], ['Duration', `${days} days`], ['Impressions', `~${estImpr.toLocaleString()}`], ['Expected Scans', Math.floor(estImpr * 0.003).toLocaleString()]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: 12, color: C.textSub }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: 14, background: C.purpleSoft, borderRadius: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: F.mono }}>£{form.budget.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, marginBottom: 8 }}>total campaign budget</div>
              {[['Platform (12%)', `£${Math.round(form.budget * 0.12)}`], ['Screen Owner (40%)', `£${Math.round(form.budget * 0.88 * 0.40)}`], ['Network', `£${Math.round(form.budget * 0.88 * 0.60)}`]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textSub, fontFamily: F.sans, marginBottom: 3 }}>
                  <span>{l}</span><span style={{ fontWeight: 500, color: C.textMid }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
        <Btn variant="secondary" onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
          {step === 0 ? 'Cancel' : '← Back'}
        </Btn>
        {step < 2 ? (
          <Btn onClick={() => setStep(s => s + 1)} disabled={step === 0 && selected.length === 0}>
            Next →
          </Btn>
        ) : (
          <Btn
            onClick={handleLaunch}
            style={{ boxShadow: '0 6px 20px rgba(124,58,237,0.4)', minWidth: 180, justifyContent: 'center' }}
          >
            🚀 Launch Campaign
          </Btn>
        )}
      </div>
    </div>
  );
}
