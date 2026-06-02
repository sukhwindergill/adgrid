import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { SkeletonRow, SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';
import { ApproveBtn } from '../../lib/campaignActions.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { CATEGORIES, DAYS, HOURS } from '../../lib/data.js';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

function NewCampaignModal({ onClose, onSave, dbScreens = [] }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    advertiser: '', category: 'Food & Beverage', screenId: dbScreens[0]?.id ?? '',
    start: '', end: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    timeStart: '07:00', timeEnd: '20:00', slots: 10, duration: 10,
    budget: 500, headline: '', cta: 'Learn More →', color: '#7c3aed', destination: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const screen = dbScreens.find(s => s.id === form.screenId);
  const days = form.start && form.end ? Math.max(1, Math.round((new Date(form.end) - new Date(form.start)) / (1000 * 60 * 60 * 24))) : 30;
  const estImpr = screen ? Math.round((screen.impressions * (form.slots / 100) / 30) * days) : 0;

  const validate = () => {
    const e = {};
    if (!form.advertiser.trim()) e.advertiser = 'Required';
    if (!form.start) e.start = 'Required';
    if (!form.end)   e.end   = 'Required';
    if (!form.destination.includes('.')) e.destination = 'Enter a valid URL';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const { data: row, error } = await supabase.from('bookings').insert({
      advertiser_name: form.advertiser,
      screen_name:     screen?.name || '',
      start_date:      form.start,
      end_date:        form.end,
      schedule_days:   form.days,
      time_start:      form.timeStart,
      time_end:        form.timeEnd,
      budget:          form.budget,
      impressions:     estImpr,
      accent_color:    form.color,
      destination_url: form.destination,
      status:          'scheduled',
      category:        form.category,
      headline:        form.headline,
      cta:             form.cta,
      slots:           form.slots,
      duration:        form.duration,
    }).select().single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSave({ ...form, ...row, screen: screen?.name || '', city: screen?.city || '', spent: 0, scans: 0,
      advertiser: row.advertiser_name ?? form.advertiser,
      start: row.start_date ?? form.start, end: row.end_date ?? form.end,
      days: row.schedule_days ?? form.days, timeStart: row.time_start ?? form.timeStart,
      timeEnd: row.time_end ?? form.timeEnd, color: row.accent_color ?? form.color,
      destination: row.destination_url ?? form.destination,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: C.surface, borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: F.sans }}>New Campaign</div>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>Step {step} of 3 — {['Campaign Details', 'Schedule & Budget', 'Creative'][step - 1]}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', padding: '14px 24px', gap: 0, borderBottom: `1px solid ${C.border}` }}>
          {['Details', 'Schedule', 'Creative'].map((l, i) => {
            const n = i + 1, done = n < step, active = n === step;
            return (
              <div key={l} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, fontFamily: F.sans,
                    background: done ? C.green : active ? C.purple : C.surfaceAlt,
                    color: done || active ? '#fff' : C.textMuted,
                  }}>{done ? '✓' : n}</div>
                  <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? C.text : C.textMuted, fontFamily: F.sans }}>{l}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, background: done ? C.green : C.border, margin: '0 12px' }} />}
              </div>
            );
          })}
        </div>

        <div style={{ padding: 24 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Inp label="Advertiser / Brand Name" placeholder="e.g. Tim Hortons" value={form.advertiser} onChange={e => setForm(f => ({ ...f, advertiser: e.target.value }))} error={errors.advertiser} />
              <SelInput label="Ad Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </SelInput>
              <SelInput label="Screen" value={form.screenId} onChange={e => setForm(f => ({ ...f, screenId: e.target.value }))}>
                {dbScreens.filter(s => s.status === 'live').length === 0
                  ? <option value="">No screens registered yet</option>
                  : dbScreens.filter(s => s.status === 'live').map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.city} (£{(s.cpm ?? 4.20).toFixed(2)} CPM · {((s.impressions ?? 0) / 1000).toFixed(0)}K impr/mo)
                      </option>
                    ))
                }
              </SelInput>
              {screen && (
                <div style={{ padding: '12px 14px', background: C.purpleSoft, borderRadius: 8, border: `1px solid ${C.purpleBorder}`, fontFamily: F.sans }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, marginBottom: 4 }}>{screen.name}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>{screen.neighbourhood} · {screen.city} · £{screen.cpm?.toFixed(2)} CPM · {(screen.impressions / 1000).toFixed(0)}K impressions/month</div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Inp label="Start Date" type="date" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} error={errors.start} min={new Date().toISOString().split('T')[0]} />
                <Inp label="End Date" type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} error={errors.end} min={form.start || new Date().toISOString().split('T')[0]} />
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
              <Inp label="Campaign Budget (£)" type="number" min={100} value={form.budget} onChange={e => setForm(f => ({ ...f, budget: parseInt(e.target.value) || 0 }))} hint={`Est. ${estImpr.toLocaleString()} impressions over ${days} days`} />
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Inp label="Headline" placeholder="e.g. Start Your Morning Right" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} />
              <Inp label="Call to Action" placeholder="e.g. Order Now →" value={form.cta} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))} />
              <Inp label="QR Code Destination URL" placeholder="https://yoursite.com/offer" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} error={errors.destination} hint="Where people land after scanning the QR code" />
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, display: 'block', marginBottom: 6 }}>Accent Colour</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {['#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#0891b2', '#ffffff', '#0a0a0a'].map(col => (
                    <div key={col} onClick={() => setForm(f => ({ ...f, color: col }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: col, cursor: 'pointer', border: `3px solid ${form.color === col ? C.purple : 'transparent'}`, outline: `1px solid ${C.border}` }} />
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9', position: 'relative', background: 'linear-gradient(145deg,#050a10,#0a1520)' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.88),rgba(0,0,0,0.1))' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 5, fontFamily: F.sans }}>{form.category}</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: 8 }}>{form.headline || 'Your Headline'}</div>
                  <div style={{ display: 'inline-block', padding: '4px 12px', border: `1.5px solid ${form.color}`, color: form.color, fontSize: 9, borderRadius: 2, fontFamily: F.sans }}>{form.cta}</div>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: form.color }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderTop: `1px solid ${C.border}`, background: C.surfaceAlt }}>
          <Btn variant="secondary" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>{step === 1 ? 'Cancel' : '← Back'}</Btn>
          {step < 3
            ? <Btn onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.advertiser}>Next →</Btn>
            : <Btn onClick={handleSave} disabled={saving} style={{ boxShadow: '0 6px 20px rgba(124,58,237,0.4)' }}>{saving ? 'Saving…' : '🚀 Launch Campaign'}</Btn>
          }
        </div>
      </div>
    </div>
  );
}

export function Campaigns({ campaigns, dbScreens = [], setCampaigns, setDetail, loadError, loading = false }) {
  const [filter, setFilter] = useState('all');
  const [city, setCity]     = useState('All');
  const [showNew, setShowNew] = useState(false);
  const { isMobile } = useBreakpoint();

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => <SkeletonCard key={i} lines={3} style={{ padding: '16px 20px' }} />)}
        </div>
      </div>
    );
  }

  function exportCSV(rows) {
    const headers = ['ID', 'Advertiser', 'Screen', 'City', 'Status', 'Budget', 'Start', 'End', 'Impressions', 'Scans'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map(c => [
      c.id, c.advertiser, c.screen, c.city, c.status,
      c.budget, c.start, c.end, c.impressions ?? 0, c.scans ?? 0,
    ].map(escape).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `adgrid-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const cities = ['All', ...new Set(campaigns.map(c => c.city))];
  const shown  = campaigns
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => city === 'All' || c.city === city);

  return (
    <div>
      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onSave={c => { setCampaigns(prev => [...prev, c]); setShowNew(false); }} dbScreens={dbScreens} />}

      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 14 }}>
          ⚠ {loadError}
        </div>
      )}

      <PageHeader title="Campaigns"
        subtitle={`${campaigns.filter(c => c.status === 'active').length} active · ${campaigns.filter(c => c.status === 'scheduled').length} scheduled · ${campaigns.filter(c => c.status === 'pending_review').length} pending review · ${campaigns.filter(c => c.status === 'paused').length} paused`}
        actions={<><Btn variant="secondary" size="sm" onClick={() => exportCSV(shown)}>↓ Export CSV</Btn><Btn onClick={() => setShowNew(true)}>+ New Campaign</Btn></>} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Campaigns" value={campaigns.length} />
        <KPI label="Active Now"      value={campaigns.filter(c => c.status === 'active').length} color={C.green} />
        <KPI label="Total Booked"    value={`£${campaigns.reduce((a, c) => a + c.budget, 0).toLocaleString()}`} />
        <KPI label="Total Scans"     value={campaigns.reduce((a, c) => a + c.scans, 0)} color={C.purple} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'All'], ['active', 'Active'], ['scheduled', 'Scheduled'], ['pending_review', 'Pending Review'], ['paused', 'Paused'], ['completed', 'Completed']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: '6px 14px', borderRadius: 20,
              border: `1px solid ${filter === v ? C.purple : C.border}`,
              background: filter === v ? C.purpleSoft : C.surface,
              color: filter === v ? C.purple : C.textSub,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: F.sans, transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <select value={city} onChange={e => setCity(e.target.value)} style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: F.sans, color: C.textMid, background: C.surface, outline: 'none' }}>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          {campaigns.length === 0 ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>
                No campaigns yet
              </div>
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, maxWidth: 320, margin: '0 auto 20px' }}>
                Create your first campaign to start reaching customers on your screens.
              </div>
              <Btn onClick={() => setShowNew(true)}>
                + Create your first campaign
              </Btn>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>
                No campaigns match these filters
              </div>
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>
                Try adjusting the status filter or city selector.
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(c => {
            const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
            const isPending = c.status === 'pending_review';
            return (
              <div key={c.id}
                onClick={e => { if (!e.defaultPrevented) setDetail(c); }}
                style={{
                  background: isPending ? C.amberSoft : C.surface,
                  border: `1px solid ${isPending ? C.amberBorder : C.border}`,
                  borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = isPending ? C.amber : C.purpleBorder; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isPending ? C.amberBorder : C.border; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 180px 120px 80px 110px 110px', gap: 16, alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.advertiser}</div>
                      {isPending && <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '1px 6px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>REVIEW</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.category} · {c.screen} · {c.city}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.mono }}>£{c.spent.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.mono }}>£{c.budget.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={c.spent} max={c.budget} height={4} />
                    <div style={{ fontSize: 10, color: pct > 90 ? C.red : pct > 70 ? C.amber : C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{pct}% used</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: C.text }}>{(c.impressions / 1000).toFixed(1)}K</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: C.purple }}>{c.scans}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub, whiteSpace: 'nowrap' }}>{c.start} →<br />{c.end}</div>
                  {isPending ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.preventDefault()}>
                      <ApproveBtn campaign={c} setCampaigns={setCampaigns} />
                      <Btn variant="danger"  size="sm" onClick={e => { e.preventDefault(); e.stopPropagation(); setDetail(c); }}>✗ Reject…</Btn>
                    </div>
                  ) : (
                    <Badge status={c.status} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
