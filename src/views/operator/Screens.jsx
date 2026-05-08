import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { SCREENS } from '../../lib/data.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

function uptime(s) {
  return s.status === 'live' ? '99.2%' : s.status === 'pending' ? '—' : '98.1%';
}

function ScreenCard({ screen, onClick }) {
  return (
    <Card style={{ padding: 20, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {screen.status === 'live' && (
            <span className="pulse" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.green, marginTop: 4, flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans, fontSize: 14, lineHeight: 1.3 }}>{screen.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{screen.neighbourhood} · {screen.city}</div>
          </div>
        </div>
        <Badge status={screen.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Impressions/mo</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono, marginTop: 2 }}>
            {screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K` : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>CPM</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono, marginTop: 2 }}>£{screen.cpm?.toFixed(2) || '4.20'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Uptime</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: screen.status === 'live' ? C.green : C.textMuted, fontFamily: F.mono, marginTop: 2 }}>{uptime(screen)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>
          {screen.campaigns} active campaign{screen.campaigns !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.green, fontFamily: F.mono }}>
          {screen.revenue > 0 ? `£${screen.revenue.toLocaleString()}/mo` : ''}
        </div>
      </div>
    </Card>
  );
}

function ScreenDetail({ screen, onBack }) {
  return (
    <div>
      <PageHeader title={screen.name} subtitle={`${screen.neighbourhood} · ${screen.city} · ${screen.owner}`}
        back="All Screens" onBack={onBack}
        actions={<><Badge status={screen.status} /><Btn variant="secondary" size="sm">✏ Edit</Btn></>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Monthly Revenue"  value={`£${screen.revenue.toLocaleString()}`} sub="owner earns 40%" color={C.green} />
        <KPI label="Impressions/mo"   value={`${(screen.impressions / 1000).toFixed(0)}K`} sub="estimated" />
        <KPI label="Live Campaigns"   value={screen.campaigns} sub="currently running" />
        <KPI label="CPM"              value={`£${screen.cpm?.toFixed(2) || '4.20'}`} sub="cost per 1,000" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Screen Details</div>
          {[['Screen ID', screen.id], ['Owner', screen.owner], ['City', screen.city], ['Neighbourhood', screen.neighbourhood], ['Max Ad Duration', screen.maxDuration + 's'], ['Uptime', uptime(screen)]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
              <span style={{ fontSize: 12, color: C.textSub }}>{l}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{v}</span>
            </div>
          ))}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Revenue Split</div>
            <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
              <div style={{ width: '12%', background: C.blue }} /><div style={{ width: '35%', background: C.green }} /><div style={{ flex: 1, background: C.surfaceAlt }} />
            </div>
            {[['Platform (12%)', `£${Math.round(screen.revenue * 0.12).toLocaleString()}`, C.blue], ['Owner (40%)', `£${Math.round(screen.revenue * 0.88 * 0.40).toLocaleString()}`, C.green], ['Network pool', `£${Math.round(screen.revenue * 0.88 * 0.60).toLocaleString()}`, C.textSub]].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: 12, color: C.textSub }}>{l}</span><span style={{ fontSize: 13, fontWeight: 600, color: c }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Payout Setup</div>
            <div style={{ padding: '10px 12px', background: C.greenSoft, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: 12, color: C.green, fontFamily: F.sans, marginBottom: 10 }}>
              ✓ Stripe Connect active — payouts enabled
            </div>
            <Btn variant="success" size="sm">Trigger Payout £{Math.round(screen.revenue * 0.88 * 0.40).toLocaleString()}</Btn>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ScreensView() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [newScreen, setNewScreen] = useState({ name: '', owner: '', type: 'Business', city: 'Toronto', location: '' });
  const { isMobile, isTablet } = useBreakpoint();

  if (selected) return <ScreenDetail screen={selected} onBack={() => setSelected(null)} />;

  const cities = ['All', ...new Set(SCREENS.map(s => s.city))];
  const shown = filter === 'All' ? SCREENS : SCREENS.filter(s => s.city === filter);
  const totalImpr = SCREENS.reduce((a, s) => a + s.impressions, 0);
  const activeCampaigns = SCREENS.reduce((a, s) => a + s.campaigns, 0);
  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <div>
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Register New Screen</div>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <Inp label="Screen Name" placeholder="e.g. Corner Brew — King St" value={newScreen.name} onChange={e => setNewScreen(s => ({ ...s, name: e.target.value }))} />
              <Inp label="Owner / Business Name" placeholder="e.g. Corner Brew Coffee" value={newScreen.owner} onChange={e => setNewScreen(s => ({ ...s, owner: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SelInput label="Owner Type" value={newScreen.type} onChange={e => setNewScreen(s => ({ ...s, type: e.target.value }))}>
                  <option>Business</option><option>Landlord</option>
                </SelInput>
                <SelInput label="City" value={newScreen.city} onChange={e => setNewScreen(s => ({ ...s, city: e.target.value }))}>
                  {['Toronto', 'London', 'Manchester', 'Birmingham'].map(c => <option key={c}>{c}</option>)}
                </SelInput>
              </div>
              <Inp label="Location / Address" placeholder="e.g. King St W & Bay St, Toronto" value={newScreen.location} onChange={e => setNewScreen(s => ({ ...s, location: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn onClick={() => setShowAdd(false)} disabled={!newScreen.name || !newScreen.owner}>Register Screen</Btn>
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Screens"
        subtitle={`${SCREENS.length} registered · ${SCREENS.filter(s => s.status === 'live').length} live · ${SCREENS.filter(s => s.status === 'pending').length} pending`}
        actions={<><Btn variant="secondary" size="sm">↓ Export</Btn><Btn onClick={() => setShowAdd(true)}>+ Register Screen</Btn></>} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Screens"     value={SCREENS.length} />
        <KPI label="Online"            value={SCREENS.filter(s => s.status === 'live').length} color={C.green} />
        <KPI label="Impressions/mo"    value={`${(totalImpr / 1000).toFixed(0)}K`} />
        <KPI label="Active Campaigns"  value={activeCampaigns} color={C.purple} />
      </div>

      {/* City filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {cities.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${filter === c ? C.purple : C.border}`,
            background: filter === c ? C.purpleSoft : C.surface,
            color: filter === c ? C.purple : C.textSub,
            fontSize: 12, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
        {shown.map(s => <ScreenCard key={s.id} screen={s} onClick={() => setSelected(s)} />)}
      </div>
    </div>
  );
}
