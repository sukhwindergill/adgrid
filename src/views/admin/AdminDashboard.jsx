import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';

function HealthDot({ status }) {
  const map = {
    online:  C.green,
    idle:    C.amber,
    offline: C.red,
    unknown: C.textMuted,
  };
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: map[status] ?? map.unknown, flexShrink: 0,
    }} />
  );
}

function StatusChip({ status }) {
  const map = {
    unverified:     { label: 'Unverified',   color: C.textMuted, bg: C.surfaceAlt },
    pending_stripe: { label: 'Pending',      color: C.amber,    bg: C.amberSoft },
    pending_manual: { label: 'Needs review', color: C.blue,     bg: C.blueSoft },
    verified:       { label: 'Verified',     color: C.green,    bg: C.greenSoft },
    rejected:       { label: 'Rejected',     color: C.red,      bg: C.redSoft },
  };
  const s = map[status] ?? map.unverified;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color, fontFamily: F.sans, fontSize: 11, fontWeight: 600,
    }}>{s.label}</span>
  );
}

export function AdminDashboard({ onNavigate }) {
  const [loading, setLoading]       = useState(true);
  const [stats, setStats]           = useState(null);
  const [operators, setOperators]   = useState([]);
  const [advertisers, setAdvertisers] = useState([]);
  const [screens, setScreens]       = useState([]);
  const [campaigns, setCampaigns]   = useState([]);

  useEffect(() => {
    async function load() {
      const [opRes, advRes, screenRes, campaignRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email, verification_status, created_at').eq('role', 'operator').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name, email, created_at').eq('role', 'advertiser').order('created_at', { ascending: false }),
        supabase.from('screens').select('id, name, city, status, health_status, last_seen, operator_id').order('created_at', { ascending: false }),
        supabase.from('bookings').select('id, advertiser_name, screen_name, budget, status, created_at').order('created_at', { ascending: false }).limit(20),
      ]);

      const ops  = opRes.data  ?? [];
      const advs = advRes.data ?? [];
      const scrs = screenRes.data ?? [];
      const cams = campaignRes.data ?? [];

      const totalRevenue = cams.filter(c => ['active','scheduled','completed'].includes(c.status)).reduce((a, c) => a + (c.budget ?? 0), 0);
      const pendingReview = cams.filter(c => c.status === 'pending_review').length;
      const liveScreens   = scrs.filter(s => s.health_status === 'online').length;
      const offlineScreens = scrs.filter(s => s.health_status === 'offline').length;

      setStats({ totalRevenue, pendingReview, liveScreens, offlineScreens });
      setOperators(ops);
      setAdvertisers(advs);
      setScreens(scrs);
      setCampaigns(cams);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ fontFamily: F.sans, color: C.textMuted, padding: 40, textAlign: 'center' }}>Loading…</div>
  );

  const needsReview = operators.filter(op =>
    op.verification_status === 'pending_manual' || op.verification_status === 'pending_stripe'
  );

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        subtitle="Overview of the entire AdGrid network"
        action={
          <Btn onClick={() => onNavigate?.('op-verify-queue')}>Verification queue</Btn>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPI label="Operators"       value={operators.length} />
        <KPI label="Advertisers"     value={advertisers.length} />
        <KPI label="Screens"         value={screens.length} />
        <KPI label="Total Revenue"   value={`£${stats.totalRevenue.toLocaleString()}`} color={C.green} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        <KPI label="Live Screens"    value={stats.liveScreens}     color={C.green} />
        <KPI label="Offline Screens" value={stats.offlineScreens}  color={stats.offlineScreens > 0 ? C.red : C.textMuted} />
        <KPI label="Pending Review"  value={stats.pendingReview}   color={stats.pendingReview > 0 ? C.amber : C.textMuted} />
        <KPI label="Needs ID Review" value={needsReview.length}    color={needsReview.length > 0 ? C.amber : C.textMuted} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Operators table */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 13, color: C.text }}>
              Operators ({operators.length})
            </div>
            <Btn size="sm" onClick={() => onNavigate?.('op-verify-queue')}>Manage</Btn>
          </div>
          {operators.length === 0 ? (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '16px 0' }}>
              No operators yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {operators.slice(0, 8).map(op => (
                <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {op.name ?? op.email}
                    </div>
                    {op.name && (
                      <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>{op.email}</div>
                    )}
                  </div>
                  <StatusChip status={op.verification_status} />
                </div>
              ))}
              {operators.length > 8 && (
                <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, textAlign: 'center', paddingTop: 4 }}>
                  +{operators.length - 8} more
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Advertisers table */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>
            Advertisers ({advertisers.length})
          </div>
          {advertisers.length === 0 ? (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '16px 0' }}>
              No advertisers yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {advertisers.slice(0, 8).map(adv => (
                <div key={adv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {adv.name ?? adv.email}
                    </div>
                    {adv.name && (
                      <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>{adv.email}</div>
                    )}
                  </div>
                  <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>
                    {new Date(adv.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {advertisers.length > 8 && (
                <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, textAlign: 'center', paddingTop: 4 }}>
                  +{advertisers.length - 8} more
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Screen health */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>
            Screen Health ({screens.length})
          </div>
          {screens.length === 0 ? (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '16px 0' }}>
              No screens registered
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {screens.slice(0, 10).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <HealthDot status={s.health_status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </div>
                    <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>{s.city}</div>
                  </div>
                  <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, textAlign: 'right' }}>
                    {s.last_seen
                      ? `${Math.round((Date.now() - new Date(s.last_seen).getTime()) / 60000)}m ago`
                      : 'Never'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent campaigns */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>
            Recent Campaigns
          </div>
          {campaigns.length === 0 ? (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '16px 0' }}>
              No campaigns yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {campaigns.slice(0, 10).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.advertiser_name}
                    </div>
                    <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>{c.screen_name}</div>
                  </div>
                  <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.mono }}>
                    £{(c.budget ?? 0).toLocaleString()}
                  </div>
                  <span style={{
                    padding: '2px 7px', borderRadius: 20, fontFamily: F.sans, fontSize: 10, fontWeight: 600,
                    background: c.status === 'active' ? C.greenSoft : c.status === 'pending_review' ? C.amberSoft : C.surfaceAlt,
                    color: c.status === 'active' ? C.green : c.status === 'pending_review' ? C.amber : C.textMuted,
                  }}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
