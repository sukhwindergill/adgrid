import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { SkeletonTable, SkeletonRow } from '../../components/ui/Skeleton.jsx';

function useScans() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('scans')
      .select('id, scanned_at, device_type, city, email, consent, campaign_id')
      .order('scanned_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setScans(data.map(s => ({
          id:         s.id,
          ts:         s.scanned_at,
          advertiser: '—',
          screen:     '—',
          city:       s.city ?? '—',
          device:     s.device_type ?? '—',
          consent:    s.consent ?? false,
          email:      s.email ?? null,
          age:        null,
          gender:     null,
        })));
        setLoading(false);
      });
  }, []);

  return { scans, loading };
}

export function Audience() {
  const [tab, setTab] = useState('scans');
  const [exportDone, setExportDone] = useState(false);
  const { scans, loading } = useScans();

  const consented   = scans.filter(s => s.consent);
  const consentRate = scans.length > 0 ? Math.round((consented.length / scans.length) * 100) : 0;

  const doExport = () => {
    const csv = ['email,city,device,scanned_at', ...consented.filter(s => s.email).map(s => `${s.email},${s.city},${s.device},${s.ts}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'adgrid-remarketing.csv';
    a.click();
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  };

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <SkeletonTable rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audience & Scans" subtitle="QR scan events, consent data, and remarketing export"
        actions={<Btn onClick={doExport} variant={exportDone ? 'success' : 'primary'} icon="↓" disabled={consented.filter(s => s.email).length === 0}>{exportDone ? 'Exported!' : 'Export Remarketing CSV'}</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Scans"      value={scans.length}                                sub="QR code scans" icon="📲" />
        <KPI label="Consent Rate"     value={consentRate + '%'}                           sub="opted in" color={C.green} icon="✓" />
        <KPI label="Remarketing List" value={consented.filter(s => s.email).length + ' emails'} sub="ready to export" color={C.purple} icon="📧" />
        <KPI label="Unique Cities"    value={new Set(scans.map(s => s.city).filter(c => c !== '—')).size} sub="locations" icon="🌍" />
      </div>

      <Card style={{ marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>How it works:</strong> Every QR code scan is logged anonymously. If the user consents on the landing page, their email is captured for remarketing.
        </div>
      </Card>

      {scans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📲</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>No scans yet</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>QR code scans will appear here once a campaign is live</div>
        </div>
      )}

      {scans.length > 0 && (
        <>
          <Tabs tabs={[{ id: 'scans', label: 'Scan Feed' }, { id: 'remarketing', label: 'Remarketing Export' }]} active={tab} onChange={setTab} />

          {tab === 'scans' && (
            <Table
              columns={[
                { key: 'ts',      label: 'Time',    render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{new Date(v).toLocaleString('en-GB')}</span> },
                { key: 'city',    label: 'City' },
                { key: 'device',  label: 'Device' },
                { key: 'consent', label: 'Consent', render: v => <Badge status={v ? 'active' : 'paused'}>{v ? '✓ Given' : '✕ Declined'}</Badge> },
                { key: 'email',   label: 'Email',   render: v => v ? <span style={{ fontFamily: F.mono, fontSize: 11, color: C.purple }}>{v}</span> : <span style={{ color: C.textMuted, fontSize: 11 }}>Anonymous</span> },
              ]}
              rows={scans} />
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
                  { key: 'email',  label: 'Email',    render: v => <span style={{ fontFamily: F.mono, fontSize: 12, color: C.purple }}>{v}</span> },
                  { key: 'city',   label: 'City' },
                  { key: 'device', label: 'Device' },
                  { key: 'ts',     label: 'Scanned',  render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{new Date(v).toLocaleDateString('en-GB')}</span> },
                ]}
                rows={consented.filter(s => s.email)}
                emptyTitle="No consented scan data yet" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
