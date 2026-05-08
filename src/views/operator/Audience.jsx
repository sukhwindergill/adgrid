import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { SCAN_DATA } from '../../lib/data.js';

export function Audience() {
  const [tab, setTab] = useState('scans');
  const [exportDone, setExportDone] = useState(false);
  const consented = SCAN_DATA.filter(s => s.consent);
  const scanRate  = '0.18';
  const consentRate = Math.round((consented.length / SCAN_DATA.length) * 100);

  const doExport = () => {
    const csv = ['email,advertiser,screen,city,age,gender,scanned_at', ...consented.filter(s => s.email).map(s => `${s.email},${s.advertiser},"${s.screen}",${s.city},${s.age || ''},${s.gender || ''},${s.ts}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'adgrid-remarketing.csv';
    a.click();
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  };

  return (
    <div>
      <PageHeader title="Audience & Scans" subtitle="QR scan events, consent data, and remarketing export"
        actions={<Btn onClick={doExport} variant={exportDone ? 'success' : 'primary'} icon="↓">{exportDone ? 'Exported!' : 'Export Remarketing CSV'}</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Scans"      value={SCAN_DATA.length}                           sub="QR code scans" icon="📲" />
        <KPI label="Scan Rate"        value={scanRate + '%'}                              sub="per 1,000 impressions" icon="📊" />
        <KPI label="Consent Rate"     value={consentRate + '%'}                          sub="opted in" color={C.green} icon="✓" />
        <KPI label="Remarketing List" value={consented.filter(s => s.email).length + ' emails'} sub="ready to export" color={C.purple} icon="📧" />
      </div>

      <Card style={{ marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>How it works:</strong> Every QR code scan is logged anonymously. If the user consents on the landing page, their email and demographics are captured for remarketing.
        </div>
      </Card>

      <Tabs tabs={[{ id: 'scans', label: 'Scan Feed' }, { id: 'remarketing', label: 'Remarketing Export' }, { id: 'demographics', label: 'Demographics' }]} active={tab} onChange={setTab} />

      {tab === 'scans' && (
        <Table
          columns={[
            { key: 'ts',        label: 'Time',    render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{new Date(v).toLocaleTimeString('en-GB')}</span> },
            { key: 'advertiser',label: 'Ad',      render: (v, r) => <div><div style={{ fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</div><div style={{ fontSize: 11, color: C.textMuted }}>{r.screen}</div></div> },
            { key: 'city',      label: 'City' },
            { key: 'device',    label: 'Device' },
            { key: 'age',       label: 'Age',     render: v => v || <span style={{ color: C.textMuted }}>—</span> },
            { key: 'gender',    label: 'Gender',  render: v => v || <span style={{ color: C.textMuted }}>—</span> },
            { key: 'consent',   label: 'Consent', render: v => <Badge status={v ? 'active' : 'paused'}>{v ? '✓ Given' : '✕ Declined'}</Badge> },
            { key: 'email',     label: 'Email',   render: v => v ? <span style={{ fontFamily: F.mono, fontSize: 11, color: C.purple }}>{v}</span> : <span style={{ color: C.textMuted, fontSize: 11 }}>Anonymous</span> },
          ]}
          rows={[...SCAN_DATA].reverse()} />
      )}

      {tab === 'remarketing' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Card style={{ padding: '14px 18px', background: C.blueSoft, border: `1px solid ${C.blueBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.blue, fontFamily: F.sans, marginBottom: 4 }}>Google Ads Customer Match</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6 }}>Upload the CSV to Google Ads → Audience Manager → Customer Match.</div>
            </Card>
            <Card style={{ padding: '14px 18px', background: C.purpleSoft, border: `1px solid ${C.purpleBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, fontFamily: F.sans, marginBottom: 4 }}>Meta Custom Audiences</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6 }}>Upload to Meta Business Manager → Custom Audience → Customer List.</div>
            </Card>
          </div>
          <Table
            columns={[
              { key: 'email',     label: 'Email',   render: v => <span style={{ fontFamily: F.mono, fontSize: 12, color: C.purple }}>{v}</span> },
              { key: 'advertiser',label: 'Ad Seen' },
              { key: 'screen',    label: 'Screen' },
              { key: 'city',      label: 'City' },
              { key: 'age',       label: 'Age' },
              { key: 'gender',    label: 'Gender' },
              { key: 'ts',        label: 'Scanned', render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{new Date(v).toLocaleDateString('en-GB')}</span> },
            ]}
            rows={consented.filter(s => s.email)}
            emptyTitle="No consented scan data yet" />
        </div>
      )}

      {tab === 'demographics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Age Breakdown</div>
            {['18-24', '25-34', '35-44', '45-54'].map(age => {
              const count = consented.filter(s => s.age === age).length;
              return (
                <div key={age} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: F.sans }}>
                    <span style={{ fontSize: 13, color: C.textMid }}>{age}</span>
                    <span style={{ fontSize: 12, color: C.textSub }}>{count} scans</span>
                  </div>
                  <ProgressBar value={count} max={consented.length || 1} height={5} />
                </div>
              );
            })}
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Top Devices</div>
            {['iPhone 15', 'iPhone 14', 'Samsung Galaxy S24', 'Pixel 8', 'iPad Pro'].map(device => {
              const count = SCAN_DATA.filter(s => s.device.includes(device.split(' ')[0]) && s.device.includes(device.split(' ').pop())).length || 1;
              return (
                <div key={device} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: F.sans }}>
                    <span style={{ fontSize: 13, color: C.textMid }}>{device}</span>
                    <span style={{ fontSize: 12, color: C.textSub }}>{count}</span>
                  </div>
                  <ProgressBar value={count} max={SCAN_DATA.length || 1} height={5} />
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}
