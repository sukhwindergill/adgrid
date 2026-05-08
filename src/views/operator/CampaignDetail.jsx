import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';

export function CampaignDetail({ campaign, onBack, onUpdate }) {
  const [tab, setTab] = useState('overview');
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const c = campaign;
  const pct      = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
  const daysLeft = Math.max(0, Math.round((new Date(c.end) - new Date()) / (1000 * 60 * 60 * 24)));
  const cpm      = c.impressions > 0 ? ((c.spent / c.impressions) * 1000).toFixed(2) : '4.20';
  const scanRate = c.impressions > 0 ? ((c.scans / c.impressions) * 100).toFixed(2) : '0.00';

  const hourly = Array.from({ length: 24 }, (_, h) => {
    const p = { 7: 78, 8: 92, 9: 80, 12: 84, 13: 82, 17: 86, 18: 90, 19: 72 };
    return { h, v: (p[h] ?? Math.max(8, 45 - Math.abs(h - 13) * 4)) * (c.impressions / 2400) || 0 };
  });
  const maxH = Math.max(...hourly.map(d => d.v), 1);

  const statusAction = (s) => {
    if (s === 'active') return <Btn variant="danger" size="sm" onClick={() => onUpdate({ ...c, status: 'paused' })}>⏸ Pause</Btn>;
    if (s === 'paused') return <Btn variant="success" size="sm" onClick={() => onUpdate({ ...c, status: 'active' })}>▶ Resume</Btn>;
    if (s === 'pending_review') return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {rejecting ? (
          <>
            <input
              autoFocus
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…"
              style={{
                padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
                fontFamily: F.sans, fontSize: 12, width: 220, outline: 'none',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && rejectReason.trim()) {
                  onUpdate({ ...c, status: 'rejected', rejectReason: rejectReason.trim() });
                }
                if (e.key === 'Escape') { setRejecting(false); setRejectReason(''); }
              }}
            />
            <Btn variant="danger" size="sm" onClick={() => {
              if (rejectReason.trim()) onUpdate({ ...c, status: 'rejected', rejectReason: rejectReason.trim() });
            }}>Confirm Reject</Btn>
            <Btn variant="secondary" size="sm" onClick={() => { setRejecting(false); setRejectReason(''); }}>Cancel</Btn>
          </>
        ) : (
          <>
            <Btn variant="success" size="sm" onClick={() => onUpdate({ ...c, status: 'scheduled' })}>✓ Approve</Btn>
            <Btn variant="danger" size="sm" onClick={() => setRejecting(true)}>✗ Reject</Btn>
          </>
        )}
      </div>
    );
    return null;
  };

  return (
    <div>
      <PageHeader
        title={c.advertiser}
        subtitle={`${c.screen} · ${c.city} · ${c.category}`}
        back="All Campaigns" onBack={onBack}
        actions={<>{statusAction(c.status)}<Btn variant="secondary" size="sm">✏ Edit</Btn></>}
      />

      {c.status === 'pending_review' && (
        <div style={{ background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.sans }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>Awaiting Review</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 1 }}>Review the creative and schedule below, then approve or reject.</div>
          </div>
        </div>
      )}
      {c.status === 'rejected' && c.rejectReason && (
        <div style={{ background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontFamily: F.sans }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 2 }}>Rejected</div>
          <div style={{ fontSize: 12, color: C.textSub }}>{c.rejectReason}</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Budget Spent"   value={`£${c.spent.toLocaleString()}`}        sub={`of £${c.budget.toLocaleString()} (${pct}%)`} color={pct > 90 ? C.red : pct > 70 ? C.amber : C.text} />
        <KPI label="Impressions"    value={`${(c.impressions / 1000).toFixed(1)}K`} sub="verified plays" />
        <KPI label="QR Scans"       value={c.scans}                                 sub="total scans" color={C.purple} />
        <KPI label="Scan Rate"      value={`${scanRate}%`}                          sub="scans per impression" />
        <KPI label="Days Remaining" value={daysLeft}                                sub={`ends ${c.end}`} color={daysLeft < 7 ? C.amber : C.text} />
      </div>

      <Card style={{ marginBottom: 20, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Budget Utilisation</div>
          <Badge status={c.status} />
        </div>
        <ProgressBar value={c.spent} max={c.budget} showLabel height={10} />
        <div style={{ display: 'flex', gap: 28, marginTop: 14 }}>
          {[['CPM', `£${cpm}`], ['Slot Share', c.slots + '%'], ['Ad Duration', c.duration + 's'], ['Schedule', `${c.timeStart}–${c.timeEnd}`], ['Days', (c.days || []).join(', ')]].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <Tabs tabs={[{ id: 'overview', label: 'Performance' }, { id: 'creative', label: 'Creative' }, { id: 'settings', label: 'Settings' }]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Impressions by Hour</div>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 80, marginBottom: 8 }}>
              {hourly.map(({ h, v }) => (
                <div key={h} title={`${String(h).padStart(2, '0')}:00`} style={{
                  flex: 1, borderRadius: '3px 3px 0 0',
                  background: h === new Date().getHours() ? C.purple : v / maxH > 0.7 ? C.purpleBorder : C.border,
                  height: `${Math.max(3, (v / maxH) * 80)}px`, transition: 'height 0.3s',
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textMuted, fontFamily: F.mono }}>
              {['00:00', '06:00', '12:00', '18:00', '23:00'].map(t => <span key={t}>{t}</span>)}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Campaign Summary</div>
            {[['Advertiser', c.advertiser], ['Screen', c.screen], ['City', c.city], ['Category', c.category], ['Campaign ID', c.id], ['Start Date', c.start], ['End Date', c.end], ['Destination', c.destination || '—']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: 12, color: C.textSub }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.text, maxWidth: 200, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'creative' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Ad Creative</div>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9', position: 'relative', background: 'linear-gradient(145deg,#1a0800,#3d1800,#7a3200)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.85),rgba(0,0,0,0.1))' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: 4 }}>{c.headline}</div>
                <div style={{ display: 'inline-block', padding: '3px 10px', border: `1px solid ${c.color || '#fff'}`, color: c.color || '#fff', fontSize: 8, borderRadius: 2 }}>Learn More →</div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: c.color || '#f59e0b' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Headline', c.headline], ['Category', c.category], ['Accent Colour', c.color || '—'], ['QR Destination', c.destination || '—']].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13, color: C.text, fontFamily: l === 'Accent Colour' ? F.mono : F.sans, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {l === 'Accent Colour' && <div style={{ width: 16, height: 16, borderRadius: 4, background: v, border: `1px solid ${C.border}`, flexShrink: 0 }} />}
                    {v}
                  </div>
                </div>
              ))}
              <Btn variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }}>✏ Edit Creative</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Schedule</div>
            {[['Days', (c.days || []).join(', ')], ['Time Window', `${c.timeStart} – ${c.timeEnd}`], ['Ad Duration', c.duration + 's per play'], ['Slot Share', c.slots + '% of airtime']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: 13, color: C.textSub }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Danger Zone</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn variant="danger" onClick={() => onUpdate({ ...c, status: c.status === 'paused' ? 'active' : 'paused' })}>
                {c.status === 'paused' ? '▶ Resume Campaign' : '⏸ Pause Campaign'}
              </Btn>
              <Btn variant="danger" onClick={() => onUpdate({ ...c, status: 'completed' })}>✕ Cancel Campaign</Btn>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: C.textMuted, fontFamily: F.sans, lineHeight: 1.6 }}>
              Cancelling stops the campaign immediately. Unused budget will be reviewed for refund per your agreement.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
