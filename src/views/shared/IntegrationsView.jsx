import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';

const INTEGRATIONS_LIST = [
  { id: 'meta',      name: 'Meta Conversions API',  logo: '📘', color: '#1877f2', category: 'Advertising', status: 'connected',    detail: 'Pixel 9876543210 · 142 events today', events: ['Scan → ViewContent', 'Consent → Lead', 'Impression → Custom'] },
  { id: 'google',    name: 'Google Ads',            logo: '🔵', color: '#4285f4', category: 'Advertising', status: 'disconnected', detail: 'Not connected', events: ['Consent → Customer Match', 'Scan → Offline Conversion'] },
  { id: 'shopify',   name: 'Shopify',               logo: '🛍️', color: '#96bf48', category: 'E-commerce',  status: 'connected',    detail: 'timhortons.myshopify.com · 31 customers', events: ['Consent → Create Customer', 'Scan → Custom Event'] },
  { id: 'salesforce',name: 'Salesforce',            logo: '☁️', color: '#00a1e0', category: 'CRM',         status: 'disconnected', detail: 'Not connected', events: ['Consent → Create Lead', 'Scan → Campaign Activity'] },
  { id: 'hubspot',   name: 'HubSpot',               logo: '🟠', color: '#ff7a59', category: 'CRM',         status: 'disconnected', detail: 'Not connected', events: ['Consent → Create Contact', 'Scan → Custom Event'] },
  { id: 'klaviyo',   name: 'Klaviyo',               logo: '📧', color: '#00b2a9', category: 'Email',       status: 'disconnected', detail: 'Not connected', events: ['Consent → Add to List', 'Scan → Track Event'] },
  { id: 'tiktok',    name: 'TikTok Events API',     logo: '🎵', color: '#ff0050', category: 'Advertising', status: 'disconnected', detail: 'Not connected', events: ['Scan → ViewContent', 'Consent → SubmitForm'] },
  { id: 'webhook',   name: 'Custom Webhook',        logo: '🔗', color: '#7c3aed', category: 'Custom',      status: 'inactive',     detail: 'Not configured', events: ['All scan events', 'All impression events'] },
];


export function IntegrationsView() {
  const { user } = useAuth();
  const pixelId = user ? `AG-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'AG-XXXXXXXX';
  const [selected, setSelected] = useState(null);
  const [saved, setSaved]       = useState('');
  const [tab, setTab]           = useState('integrations');

  const save = (id) => { setSaved(id); setTimeout(() => setSaved(''), 2000); };

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Connect ADGRID scan and impression data to your existing tools" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <KPI label="Connected"  value={INTEGRATIONS_LIST.filter(i => i.status === 'connected').length + ''} sub="integrations" color={C.green} icon="✓" />
        <KPI label="Errors"     value={INTEGRATIONS_LIST.filter(i => i.status === 'error').length + ''}     sub="need attention" color={C.red} icon="⚠" />
        <KPI label="Available"  value={INTEGRATIONS_LIST.length + ''}                                       sub="platforms" />
      </div>

      <Tabs tabs={[{ id: 'integrations', label: 'Integrations' }, { id: 'pixel', label: 'Tracking Pixel' }, { id: 'logs', label: 'Event Log' }]} active={tab} onChange={setTab} />

      {tab === 'integrations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {INTEGRATIONS_LIST.map(intg => (
              <Card key={intg.id} onClick={() => setSelected(intg)} style={{ cursor: 'pointer', border: selected?.id === intg.id ? `1px solid ${C.purple}` : undefined, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{intg.logo}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{intg.name}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>{intg.category}</div>
                    </div>
                  </div>
                  <Badge status={intg.status === 'connected' ? 'active' : intg.status === 'error' ? 'failed' : 'paused'}>{intg.status === 'connected' ? 'Connected' : intg.status === 'error' ? 'Error' : 'Off'}</Badge>
                </div>
                <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>{intg.detail}</div>
              </Card>
            ))}
          </div>

          {selected ? (
            <Card style={{ position: 'sticky', top: 80 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>{selected.logo}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{selected.name}</div>
                  <Badge status={selected.status === 'connected' ? 'active' : selected.status === 'error' ? 'failed' : 'paused'}>{selected.status}</Badge>
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7, marginBottom: 12 }}>Events sent by ADGRID:</div>
              {selected.events.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.textMid, fontFamily: F.sans }}>{e}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 14 }}>
                {(['meta', 'shopify', 'webhook'].includes(selected.id)) && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 10 }}>Configuration</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      <Inp label={selected.id === 'meta' ? 'Pixel ID' : selected.id === 'shopify' ? 'Shop Domain' : 'Webhook URL'} placeholder="••••" />
                      <Inp label={selected.id === 'meta' ? 'Access Token' : selected.id === 'shopify' ? 'Admin API Key' : 'Signing Secret'} type="password" placeholder="••••••••••••" />
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn style={{ flex: 1, justifyContent: 'center' }} onClick={() => save(selected.id)}>
                    {saved === selected.id ? '✓ Saved' : selected.status === 'connected' ? 'Update Config' : 'Connect'}
                  </Btn>
                  {selected.status === 'connected' && <Btn variant="danger" size="sm">Disconnect</Btn>}
                </div>
              </div>
            </Card>
          ) : (
            <Card style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontFamily: F.sans }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⇌</div>Select an integration to configure it
            </Card>
          )}
        </div>
      )}

      {tab === 'pixel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Your Pixel ID</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, fontFamily: F.mono, marginBottom: 12 }}>{pixelId}</div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7, marginBottom: 14 }}>Paste this into the &lt;head&gt; of your website. It tracks QR scan arrivals and attributes conversions back to campaigns.</div>
            <div style={{ position: 'relative' }}>
              {(() => {
                const snippet = `<!-- ADGRID Tracking Pixel -->\n<script src="https://cdn.adgrid.io/pixel.js"></script>\n<script>\n  adgrid('init', '${pixelId}');\n  adgrid('track', 'PageView');\n</script>`;
                return (
                  <>
                    <pre style={{ background: C.surfaceAlt, borderRadius: 8, padding: '12px 14px', fontSize: 11, color: C.textMid, lineHeight: 1.8, overflow: 'auto', border: `1px solid ${C.border}`, whiteSpace: 'pre-wrap', fontFamily: F.mono }}>{snippet}</pre>
                    <button onClick={() => navigator.clipboard?.writeText(snippet)} style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', fontSize: 11, background: C.surface, color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: F.sans }}>Copy</button>
                  </>
                );
              })()}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Platform Guides</div>
            {[['🛍️ Shopify', 'Paste in Online Store → Themes → Edit Code → theme.liquid before </head>'], ['⚙️ WordPress', 'Use Insert Headers and Footers plugin → Scripts in Header'], ['◼️ Squarespace', 'Settings → Advanced → Code Injection → Header'], ['⚛️ Next.js', 'Add to _app.js or layout.tsx using next/script']].map(([p, d]) => (
              <div key={p} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{p}</div>
                <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'logs' && (
        <Table
          columns={[
            { key: 'ts',    label: 'Time',       render: () => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{new Date().toLocaleTimeString('en-GB')}</span> },
            { key: 'intg',  label: 'Integration', render: (_, r) => <span>{r.intg}</span> },
            { key: 'event', label: 'Event' },
            { key: 'detail',label: 'Detail' },
            { key: 'status',label: 'Status',     render: v => <Badge status={v === 'sent' ? 'active' : 'failed'}>{v}</Badge> },
          ]}
          rows={[
            { intg: 'Meta Conversions API', event: 'ViewContent',   detail: 'BK-001 scan → pixel 9876543210',  status: 'sent' },
            { intg: 'Shopify',              event: 'CreateCustomer', detail: 'alice@example.com → #4821',       status: 'sent' },
            { intg: 'Meta Conversions API', event: 'Lead',           detail: 'Consent → fb_lead_id abc123',     status: 'sent' },
            { intg: 'Custom Webhook',       event: 'scan.created',   detail: 'Connection timeout after 30s',    status: 'failed' },
          ]} />
      )}
    </div>
  );
}
