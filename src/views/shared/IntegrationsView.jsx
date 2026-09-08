import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { BrandIcon } from '../../components/shared/BrandIcon.jsx';
import { IconWarning } from '../../components/icons.jsx';

// Product-audit finding (not from a written spec): this page used to render
// a full "Integrations" console -- connection status badges, a KPI row, an
// Event Log tab -- all backed by a hardcoded INTEGRATIONS_LIST with no
// state, no persistence, and no backend calls at all; every status shown
// was simply "disconnected", forever. Worse, its "Tracking Pixel" tab
// handed operators a copy-paste snippet pointing at
// https://cdn.adgrid.io/pixel.js -- a file that has never existed anywhere
// in this codebase or been deployed -- so an operator who followed the
// platform guides and pasted it into their site would get a silent 404
// and nothing would ever fire. That's actively misleading, not just
// unfinished: it looked like a working feature and wasn't one.
//
// Advertiser-side integrations (Meta/Google/Shopify, real connect flow,
// real event log) already exist and work -- see AdvIntegrationsView.jsx.
// This replacement is an honest placeholder: it says what's real today
// and what's planned, and it does not hand anyone a script that goes
// nowhere.

const PLANNED_PLATFORMS = [
  { id: 'salesforce', name: 'Salesforce', category: 'CRM' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM' },
  { id: 'klaviyo', name: 'Klaviyo', category: 'Email' },
  { id: 'tiktok', name: 'TikTok Events API', category: 'Advertising' },
  { id: 'webhook', name: 'Custom Webhook', category: 'Custom' },
];

export function IntegrationsView() {
  return (
    <div>
      <PageHeader title="Integrations" subtitle="Connect ADGRID scan and impression data to your existing tools" />

      <Card style={{ padding: 20, marginBottom: 20, borderLeft: `3px solid ${C.amber}` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 2 }}><IconWarning size={16} /></span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
              Operator-side integrations aren't available yet
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6 }}>
              Nothing on this page is connected today, and there's no tracking pixel or webhook to install — this is a preview of what's planned, not a working console. Advertisers can already connect Meta, Google Ads, and Shopify from their own Integrations page.
            </div>
          </div>
        </div>
      </Card>

      <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Planned
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {PLANNED_PLATFORMS.map(p => (
          <Card key={p.id} style={{ padding: '14px 16px', opacity: 0.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BrandIcon id={p.id} size={16} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{p.name}</div>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>{p.category}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
