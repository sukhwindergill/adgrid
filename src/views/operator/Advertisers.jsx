import { C, F } from '../../design/tokens.js';
import { Table } from '../../components/primitives/Table.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';

export function Advertisers({ campaigns, setNav, setFilter }) {
  const advertisers = [...new Map(campaigns.map(c => [c.advertiser, c])).values()].map(c => {
    const ads = campaigns.filter(x => x.advertiser === c.advertiser);
    return {
      name: c.advertiser,
      category: c.category,
      activeCampaigns: ads.filter(x => x.status === 'active').length,
      totalSpend: ads.reduce((a, x) => a + x.budget, 0),
      totalScans: ads.reduce((a, x) => a + x.scans, 0),
      status: ads.some(x => x.status === 'active') ? 'active' : 'paused',
    };
  });

  const totalSpend = advertisers.reduce((a, x) => a + x.totalSpend, 0);
  const totalScans = advertisers.reduce((a, x) => a + x.totalScans, 0);

  return (
    <div>
      <PageHeader title="Advertisers" subtitle="Active advertisers on the ADGRID network" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Advertisers" value={advertisers.length} />
        <KPI label="Active Now"        value={advertisers.filter(a => a.activeCampaigns > 0).length} color={C.green} />
        <KPI label="Total Spend"       value={`$${totalSpend.toLocaleString()}`} color={C.purple} />
        <KPI label="Total Scans"       value={totalScans} color={C.green} icon="📲" />
      </div>

      <Table
        columns={[
          { key: 'name',            label: 'Advertiser',        render: v => <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{v}</div> },
          { key: 'category',        label: 'Category' },
          { key: 'activeCampaigns', label: 'Active Campaigns',  render: v => <span style={{ fontWeight: 600, color: v > 0 ? C.green : C.textMuted, fontFamily: F.mono }}>{v}</span> },
          { key: 'totalSpend',      label: 'Total Spend',       render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>${v.toLocaleString()}</span> },
          { key: 'totalScans',      label: 'Total Scans',       render: v => <span style={{ color: C.purple, fontWeight: 600, fontFamily: F.mono }}>{v}</span> },
          { key: 'status',          label: 'Status',            render: v => <Badge status={v} /> },
        ]}
        rows={advertisers}
        emptyTitle="No advertisers yet"
        emptyDescription="Advertisers will appear here once campaigns are created"
        onRowClick={row => { if (setNav) setNav('campaigns'); }}
      />
    </div>
  );
}
