import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { supabase } from '../../lib/supabase.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
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
// This replacement is an honest placeholder for four still-unbuilt
// platforms, plus one real, working one: docs/superpowers/specs/2026-09-08-
// operator-webhook-integration-design.md picks Custom Webhook as the first
// operator-side integration actually worth building (lowest-common-
// denominator -- every named platform, plus Zapier/Make, can already
// consume it) and builds it for real, rather than guessing which named CRM
// an operator wants without one asking for it.

const PLANNED_PLATFORMS = [
  { id: 'salesforce', name: 'Salesforce', category: 'CRM' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM' },
  { id: 'klaviyo', name: 'Klaviyo', category: 'Email' },
  { id: 'tiktok', name: 'TikTok Events API', category: 'Advertising' },
];

function WebhookCard() {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('operator_webhooks')
        .select('webhook_url, secret, enabled')
        .eq('operator_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setUrl(data.webhook_url ?? '');
        setSecret(data.secret ?? '');
        setEnabled(data.enabled);
        setHasSaved(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setTestResult(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('operator_webhooks').upsert({
      operator_id: user.id,
      webhook_url: url,
      secret: secret || null,
      enabled,
    }, { onConflict: 'operator_id' });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setHasSaved(true);
  }

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('operator_webhooks').update({ enabled: next }).eq('operator_id', user.id);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/operator-webhook-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      const body = await res.json().catch(() => ({}));
      setTestResult(res.ok && body.ok ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    }
    setTesting(false);
  }

  if (loading) return null;

  return (
    <Card style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <BrandIcon id="webhook" size={16} />
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Custom Webhook</div>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>
        Receive a signed <code>POST</code> for events on your own screens/campaigns/payouts as they happen -- campaign submitted, screen offline or dropped SLA, delivery shortfall credited, payout failed, dispute resolved. Connect it to Zapier, Make, or your own backend.
      </div>
      <label style={{ display: 'block', fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 4 }}>Webhook URL</label>
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://example.com/adgrid-webhook"
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: F.sans, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 10, boxSizing: 'border-box' }}
      />
      <label style={{ display: 'block', fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 4 }}>Signing secret (optional)</label>
      <input
        type="text"
        value={secret}
        onChange={e => setSecret(e.target.value)}
        placeholder="Used to sign each delivery as X-AdGrid-Signature"
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: F.sans, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 12, boxSizing: 'border-box' }}
      />
      {error && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 8 }}>{error}</div>}
      {testResult === 'ok' && <div style={{ fontSize: 12, color: C.green, fontFamily: F.sans, marginBottom: 8 }}>Test event delivered successfully.</div>}
      {testResult === 'fail' && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 8 }}>Test event delivery failed -- check the URL and that your endpoint is reachable.</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn variant="secondary" size="sm" onClick={handleSave} disabled={saving || !url}>
          {saving ? 'Saving…' : hasSaved ? 'Save changes' : 'Save webhook'}
        </Btn>
        {hasSaved && (
          <>
            <Btn variant="ghost" size="sm" onClick={handleToggle}>
              {enabled ? 'Disable' : 'Enable'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={handleTest} disabled={testing || !enabled}>
              {testing ? 'Sending…' : 'Send test event'}
            </Btn>
          </>
        )}
      </div>
    </Card>
  );
}

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
              Custom Webhook below is real and working -- everything else on this page is a preview of what's planned. Advertisers can already connect Meta, Google Ads, and Shopify from their own Integrations page.
            </div>
          </div>
        </div>
      </Card>

      <WebhookCard />

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
