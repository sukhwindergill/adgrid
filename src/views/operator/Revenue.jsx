import { C, F } from '../../design/tokens.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { SkeletonRow, SkeletonTable } from '../../components/ui/Skeleton.jsx';

export function Revenue({ campaigns, loading = false }) {
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }
  const total    = campaigns.reduce((a, c) => a + c.budget, 0);
  const platform = Math.round(total * 0.12);
  const owners   = Math.round(total * 0.88 * 0.40);
  const network  = total - platform - owners;
  const cities   = [...new Set(campaigns.map(c => c.city))];
  const maxRev   = Math.max(...cities.map(city => campaigns.filter(c => c.city === city).reduce((a, c) => a + c.budget, 0)), 1);

  return (
    <div>
      <PageHeader title="Revenue" subtitle="Platform earnings, owner payouts, and network splits"
        actions={<Btn variant="secondary" size="sm">↓ Export Report</Btn>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Ad Spend"   value={`£${total.toLocaleString()}`}    sub="from advertisers" trend={14} icon="💰" />
        <KPI label="Platform Revenue" value={`£${platform.toLocaleString()}`} sub="12% fee" color={C.blue} icon="$" />
        <KPI label="Owner Payouts"    value={`£${owners.toLocaleString()}`}   sub="40% of net" color={C.green} icon="🏦" />
        <KPI label="Network Pool"     value={`£${network.toLocaleString()}`}  sub="reinvestment" icon="♻" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Revenue Split</div>
          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
            <div style={{ width: '12%', background: C.blue }} /><div style={{ width: '35%', background: C.green }} /><div style={{ flex: 1, background: C.surfaceAlt }} />
          </div>
          {[['Platform Fee (12%)', `£${platform.toLocaleString()}`, C.blue], ['Screen Owners (40%)', `£${owners.toLocaleString()}`, C.green], ['Network Pool (48%)', `£${network.toLocaleString()}`, C.textSub]].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
              <span style={{ fontSize: 13, color: C.textMid }}>{l}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>By City</div>
          {cities.map(city => {
            const rev = campaigns.filter(c => c.city === city).reduce((a, c) => a + c.budget, 0);
            return (
              <div key={city} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontFamily: F.sans }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{city}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>£{rev.toLocaleString()}</span>
                </div>
                <ProgressBar value={rev} max={maxRev} height={5} />
              </div>
            );
          })}
        </Card>
      </div>
      <Table
        columns={[
          { key: 'advertiser', label: 'Campaign', render: (v, r) => <div><div style={{ fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</div><div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{r.city}</div></div> },
          { key: 'screen',   label: 'Screen' },
          { key: 'budget',   label: 'Gross',        render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>£{v.toLocaleString()}</span> },
          { key: 'budget',   label: 'Platform (12%)', render: v => <span style={{ color: C.blue, fontFamily: F.mono }}>£{Math.round(v * 0.12).toLocaleString()}</span> },
          { key: 'budget',   label: 'Owner (40%)',  render: v => <span style={{ color: C.green, fontFamily: F.mono }}>£{Math.round(v * 0.88 * 0.40).toLocaleString()}</span> },
          { key: 'budget',   label: 'Network',      render: v => <span style={{ fontFamily: F.mono }}>£{Math.round(v * 0.88 * 0.60).toLocaleString()}</span> },
          { key: 'status',   label: 'Status',       render: v => <Badge status={v} /> },
        ]}
        rows={campaigns} />
    </div>
  );
}
