import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { SCAN_DATA } from '../../lib/data.js';

export function ScansData() {
  const [exportDone, setExportDone] = useState(false);

  const doExport = () => {
    const headers = ['timestamp', 'advertiser', 'screen', 'city', 'device', 'age', 'gender', 'consent', 'email'];
    const rows = SCAN_DATA.map(s => [s.ts, s.advertiser, s.screen, s.city, s.device, s.age || '', s.gender || '', s.consent, s.consent && s.email ? s.email : ''].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'adgrid-scans.csv';
    a.click();
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  };

  const consented = SCAN_DATA.filter(s => s.consent);

  return (
    <div>
      <PageHeader title="Scans & Data" subtitle="QR scan events and first-party audience data"
        actions={<Btn onClick={doExport} variant={exportDone ? 'success' : 'primary'} icon="↓">{exportDone ? 'Exported!' : 'Export CSV'}</Btn>} />

      <Card style={{ marginBottom: 20, padding: '14px 18px', background: C.purpleSoft, border: `1px solid ${C.purpleBorder}` }}>
        <div style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>
          <strong>🔒 Privacy first:</strong> All QR scans below are <strong>consented first-party data</strong>. Users opt-in on your landing page — you own this audience and can export it for remarketing at any time.
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Scans"     value={SCAN_DATA.length}                     sub="QR code scans" icon="📲" />
        <KPI label="Consented"       value={consented.length}                     sub="opted in" color={C.green} icon="✓" />
        <KPI label="Consent Rate"    value={`${Math.round((consented.length / SCAN_DATA.length) * 100)}%`} sub="of total scans" color={C.green} />
        <KPI label="Emails Captured" value={consented.filter(s => s.email).length} sub="ready to export" color={C.purple} icon="📧" />
      </div>

      <Table
        columns={[
          { key: 'ts',        label: 'Timestamp',  render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span> },
          { key: 'screen',    label: 'Screen',     render: (v, r) => <div><div style={{ fontWeight: 500, fontFamily: F.sans }}>{v}</div><div style={{ fontSize: 11, color: C.textMuted }}>{r.city}</div></div> },
          { key: 'device',    label: 'Device',     render: v => <span style={{ fontFamily: F.sans, fontSize: 12 }}>{v}</span> },
          { key: 'age',       label: 'Age',        render: v => v || <span style={{ color: C.textMuted }}>—</span> },
          { key: 'gender',    label: 'Gender',     render: v => v || <span style={{ color: C.textMuted }}>—</span> },
          { key: 'consent',   label: 'Consent',    render: v => <Badge status={v ? 'active' : 'paused'}>{v ? '✓ Given' : '✕ Declined'}</Badge> },
          { key: 'email',     label: 'Email',      render: (v, r) => r.consent && v ? <span style={{ fontFamily: F.mono, fontSize: 11, color: C.purple }}>{v}</span> : <span style={{ fontSize: 11, color: C.textMuted }}>••••••••</span> },
        ]}
        rows={[...SCAN_DATA].reverse()}
        emptyTitle="No scan data yet"
        emptyDescription="QR scans will appear here once your campaigns go live"
      />
    </div>
  );
}
