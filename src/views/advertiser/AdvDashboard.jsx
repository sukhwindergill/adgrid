import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';

export function AdvDashboard({ user, campaigns, setAdvNav, advertiserId }) {
  const myCampaigns = campaigns.filter(c => c.advertiser_id === advertiserId);
  const totalSpend  = myCampaigns.reduce((a, c) => a + c.budget, 0);
  const totalSpent  = myCampaigns.reduce((a, c) => a + c.spent, 0);
  const totalImpr   = myCampaigns.reduce((a, c) => a + c.impressions, 0);
  const totalScans  = myCampaigns.reduce((a, c) => a + c.scans, 0);

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.name ? ', ' + user.name : ''}`}
        subtitle="Your campaign performance at a glance"
        actions={<Btn onClick={() => setAdvNav('adv-create')}>+ New Campaign</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Budget"  value={`£${totalSpend.toLocaleString()}`}        sub="across all campaigns" />
        <KPI label="Spent to Date" value={`£${totalSpent.toLocaleString()}`}         sub={`${totalSpend > 0 ? Math.round((totalSpent / totalSpend) * 100) : 0}% of budget`} color={C.blue} />
        <KPI label="Impressions"   value={`${(totalImpr / 1000).toFixed(1)}K`}       sub="verified plays" color={C.purple} />
        <KPI label="QR Scans"      value={totalScans}                                 sub="leads captured" color={C.green} icon="📲" />
      </div>

      {myCampaigns.length > 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Your Campaigns</h2>
            <Btn variant="ghost" size="sm" onClick={() => setAdvNav('adv-campaigns')}>View all →</Btn>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myCampaigns.map(c => (
              <Card key={c.id} style={{ padding: '16px 20px', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px 130px', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{c.screen}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category} · {c.start} → {c.end}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Spend</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.text, fontFamily: F.mono }}>£{c.spent.toLocaleString()} / £{c.budget.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={c.spent} max={c.budget} height={4} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{(c.impressions / 1000).toFixed(1)}K</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Badge status={c.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📺</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>No campaigns yet</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>Launch your first campaign on the ADGRID network in under 10 minutes.</div>
          <Btn onClick={() => setAdvNav('adv-create')}>Create your first campaign →</Btn>
        </Card>
      )}
    </div>
  );
}
