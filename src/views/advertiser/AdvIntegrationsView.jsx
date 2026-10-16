import { useState, useEffect, useRef } from "react";
import { C, F, SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useBreakpoint } from "../../lib/useBreakpoint.js";
import { BrandIcon } from "../../components/shared/BrandIcon.jsx";
import { PageHeader } from "../../components/primitives/PageHeader.jsx";
import { Btn } from "../../components/primitives/Btn.jsx";
import { Inp } from "../../components/primitives/Inp.jsx";
import { CopyButton } from "../../components/primitives/CopyButton.jsx";
import { generatePostbackKey, hashPostbackKey } from "../../lib/postbackKey.js";
import { generateApiKey, hashApiKey, apiKeyPrefix } from "../../lib/apiKey.js";
import { useT } from "../../i18n/useT.js";

// ─── Platform definitions ───────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "meta",
    name: "Meta Conversions API",
    fields: [
      { key: "pixel_id", placeholder: "123456789012345", type: "text" },
      { key: "access_token", placeholder: "EAAx…", type: "password" },
    ],
    eventType: "ViewContent",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api",
  },
  {
    id: "google",
    name: "Google Ads",
    fields: [
      { key: "conversion_id", placeholder: "AW-000000000", type: "text" },
      { key: "conversion_label", placeholder: "abc123XYZ", type: "text" },
      { key: "customer_id", placeholder: "123-456-7890", type: "text" },
      { key: "developer_token", placeholder: "dTk…", type: "password" },
      { key: "refresh_token", placeholder: "1//0g…", type: "password" },
    ],
    eventType: "Conversion",
    docsUrl: "https://developers.google.com/google-ads/api/docs/conversions/upload-clicks",
  },
  {
    id: "shopify",
    name: "Shopify",
    fields: [
      { key: "webhook_url", placeholder: "https://yourstore.myshopify.com/webhooks/adgrid", type: "text" },
      { key: "secret", placeholder: "whsec_…", type: "password" },
    ],
    eventType: "scan.created",
    docsUrl: "https://shopify.dev/docs/apps/webhooks",
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ connected }) {
  const { t } = useT();
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: connected ? C.greenSoft : C.surfaceAlt,
      color: connected ? C.green : C.textSub,
      border: `1px solid ${connected ? C.greenBorder : C.border}`,
    }}>
      {connected ? t('integ.connected') : t('integ.notConnected')}
    </span>
  );
}

function EventStatusBadge({ status }) {
  const { t } = useT();
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: status === "sent" ? C.greenSoft : C.redSoft,
      color: status === "sent" ? C.green : C.red,
    }}>
      {status === "sent" ? t('integ.sent') : t('integ.failed')}
    </span>
  );
}

function ConnectModal({ platform, existing, onClose, onSaved }) {
  const { t } = useT();
  const [fields, setFields] = useState(() => {
    const init = {};
    platform.fields.forEach(f => { init[f.key] = existing?.config?.[f.key] ?? ""; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  async function getUid() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const uid = await getUid();
    const { error: err } = await supabase.from("advertiser_integrations").upsert({
      advertiser_id: uid,
      platform: platform.id,
      config: fields,
      enabled: true,
    }, { onConflict: "advertiser_id,platform" });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
    onClose();
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/fire-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          scan_id: "00000000-0000-0000-0000-000000000000",
          advertiser_id: session?.user?.id,
          campaign_id: "test",
          email: null,
          consent: false,
          _test_platform: platform.id,
          _test_config: fields,
        }),
      });
      setTestResult(res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    }
    setTesting(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.surface, borderRadius: 16, padding: 32, width: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <BrandIcon id={platform.id} size={16} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: F.sans }}>
              {t('integ.connectTitle', { name: platform.name })}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>
              {t(`integ.platformDesc.${platform.id}`)}
            </div>
          </div>
        </div>

        {platform.fields.map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
              {t(`integ.fields.${f.key}`)}
            </label>
            <input
              type={f.type}
              value={fields[f.key]}
              onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={{
                width: "100%", boxSizing: "border-box", padding: "9px 12px",
                border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13,
                fontFamily: F.sans, color: C.text, outline: "none",
                background: C.surface, transition: "border-color 0.15s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
              onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
            />
          </div>
        ))}

        {error && (
          <div style={{ padding: "10px 14px", background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, color: C.red, fontFamily: F.sans, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {testResult && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: 13, fontFamily: F.sans, marginBottom: 16,
            background: testResult === "ok" ? C.greenSoft : C.redSoft,
            border: `1px solid ${testResult === "ok" ? C.greenBorder : C.redBorder}`,
            color: testResult === "ok" ? C.green : C.red,
          }}>
            {testResult === "ok" ? t('integ.testOk') : t('integ.testFail')}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={handleSave} loading={saving} style={{ flex: 1 }}>{t('integ.saveConnect')}</Btn>
          <Btn variant="secondary" onClick={handleTest} loading={testing}>{t('integ.test')}</Btn>
          <Btn variant="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        </div>

        <a href={platform.docsUrl} target="_blank" rel="noreferrer" style={{
          display: "block", textAlign: "center", marginTop: 14, fontSize: 12,
          color: C.purple, fontFamily: F.sans, textDecoration: "none",
        }}>
          {t('integ.viewDocs', { name: platform.name })}
        </a>
      </div>
    </div>
  );
}

function PlatformCard({ platform, integration, eventCount, onConnect, onDisconnect }) {
  const { t, tx } = useT();
  const connected = !!integration;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 24, display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BrandIcon id={platform.id} size={18} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.sans }}>
              {platform.name}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>
              {platform.eventType}
            </div>
          </div>
        </div>
        <StatusBadge connected={connected} />
      </div>

      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5 }}>
        {t(`integ.platformDesc.${platform.id}`)}
      </div>

      {connected && (
        <div style={{
          padding: "10px 14px", background: C.surfaceAlt, borderRadius: 8,
          fontSize: 13, fontFamily: F.sans, color: C.textMid,
        }}>
          {tx('integ.eventsFired', { count: eventCount, b: chunk => <span style={{ fontWeight: 600, color: C.text }}>{chunk}</span> })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <Btn variant={connected ? "secondary" : "primary"} onClick={onConnect} style={{ flex: 1 }}>
          {connected ? t('integ.edit') : t('integ.connect')}
        </Btn>
        {connected && (
          <Btn variant="danger" onClick={onDisconnect}>{t('integ.disconnect')}</Btn>
        )}
      </div>
    </div>
  );
}

// ─── Conversion Tracking tab ─────────────────────────────────────────────────
// Competitive Parity Program, Phase 6, G9 widen (docs/superpowers/specs/
// 2026-09-08-conversion-pixel-postback-design.md): "AdGrid conversion pixel
// + server postback ... promo-code and vanity-URL attribution for
// non-scanners." This is the inbound half -- reporting conversions back to
// AdGrid -- separate from the outbound PLATFORMS above (AdGrid -> Meta/
// Google/Shopify).

const PIXEL_URL = `${SUPABASE_FUNCTIONS_URL}/conversion-pixel`;
const POSTBACK_URL = `${SUPABASE_FUNCTIONS_URL}/conversion-postback`;

function PostbackKeyCard({ hasKey, onGenerated }) {
  const { t, tx } = useT();
  const [newKey, setNewKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setSaving(true);
    setError(null);
    const key = generatePostbackKey();
    const key_hash = await hashPostbackKey(key);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("advertiser_integrations").upsert({
      advertiser_id: user.id,
      platform: "adgrid_postback",
      config: { key_hash },
      enabled: true,
    }, { onConflict: "advertiser_id,platform" });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNewKey(key);
    onGenerated?.();
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{t('integ.postbackKey')}</div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>
        {tx('integ.postbackBody', { code: chunk => <code>{chunk}</code>, url: <code>{POSTBACK_URL}</code> })}
      </div>
      {newKey ? (
        <div style={{ padding: 12, background: C.surfaceAlt, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 6 }}>
            {tx('integ.copyNow', { code: chunk => <code>{chunk}</code> })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ fontSize: 12, fontFamily: F.mono, color: C.text, wordBreak: "break-all" }}>{newKey}</code>
            <CopyButton value={newKey} label={t('integ.copy')} copiedLabel={t('integ.copied')} variant="ghost" size="sm" />
          </div>
        </div>
      ) : hasKey ? (
        <StatusBadge connected />
      ) : (
        <StatusBadge connected={false} />
      )}
      {error && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 8 }}>{error}</div>}
      <Btn variant="secondary" size="sm" onClick={generate} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? t('integ.generating') : hasKey ? t('integ.regenerate') : t('integ.generate')}
      </Btn>
    </div>
  );
}

function PixelSnippetCard() {
  const { t, tx } = useT();
  const snippet = `<img src="${PIXEL_URL}?adgrid_cid={{adgrid_cid}}&value=49.99" width="1" height="1" style="display:none" />`;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{t('integ.pixelTitle')}</div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>
        {tx('integ.pixelBody', { code: chunk => <code>{chunk}</code>, cid: <code>{"{{adgrid_cid}}"}</code> })}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, background: C.surfaceAlt, borderRadius: 8 }}>
        <code style={{ fontSize: 11, fontFamily: F.mono, color: C.text, wordBreak: "break-all", flex: 1 }}>{snippet}</code>
        <CopyButton value={snippet} label={t('integ.copy')} copiedLabel={t('integ.copied')} variant="ghost" size="sm" />
      </div>
    </div>
  );
}

// Product gap fix (2026-09-14): the pixel/postback/promo-code infra above
// (conversion-pixel-postback-design.md) is fully built and platform-agnostic
// -- but "here's a generic <img> tag, go figure out where your site puts it"
// is a real barrier for anyone not already comfortable editing site code.
// Every advertiser on this platform is running their storefront/site on one
// of a handful of common builders, each with its own specific place to paste
// a script and its own quirks (Squarespace gating code injection behind a
// paid plan, Shopify deprecating Additional Scripts for Plus stores, etc.).
// This doesn't add any new attribution mechanism -- same pixel URL, same
// promo-code path -- it just answers "where do I actually put this" for the
// platforms advertisers are most likely to already be running.
const SETUP_GUIDES = [
  {
    id: "shopify", name: "Shopify",
    snippet: (pixelUrl) => `<img src="${pixelUrl}?adgrid_cid={{ landing_site_ref }}&value={{ checkout.total_price | money_without_currency }}" width="1" height="1" style="display:none" />`,
  },
  {
    id: "woocommerce", name: "WooCommerce",
    snippet: (pixelUrl) => `add_action('woocommerce_thankyou', function ($order_id) {\n  $order = wc_get_order($order_id);\n  $cid = isset($_COOKIE['adgrid_cid']) ? esc_attr($_COOKIE['adgrid_cid']) : '';\n  if (!$cid) return;\n  echo '<img src="${pixelUrl}?adgrid_cid=' . $cid . '&value=' . esc_attr($order->get_total()) . '" width="1" height="1" style="display:none" />';\n});`,
  },
  {
    id: "bigcommerce", name: "BigCommerce",
    snippet: (pixelUrl) => `<img src="${pixelUrl}?adgrid_cid={{ADGRID_CID}}&value={{checkout.grand_total}}" width="1" height="1" style="display:none" />`,
  },
  {
    id: "squarespace", name: "Squarespace",
    snippet: (pixelUrl) => `<img src="${pixelUrl}?adgrid_cid={{ADGRID_CID}}&value={{ORDER_TOTAL}}" width="1" height="1" style="display:none" />`,
  },
  {
    id: "wordpress", name: "WordPress",
    snippet: (pixelUrl) => `<img src="${pixelUrl}?adgrid_cid={{ADGRID_CID}}" width="1" height="1" style="display:none" />`,
  },
  {
    id: "ga4", name: "Google Analytics",
    snippet: null,
  },
];

function PlatformSetupGuide() {
  const { t, tList } = useT();
  const [platformId, setPlatformId] = useState(SETUP_GUIDES[0].id);
  const platform = SETUP_GUIDES.find(p => p.id === platformId);
  const snippet = platform.snippet ? platform.snippet(PIXEL_URL) : null;
  const note = t(`integ.guides.${platform.id}.note`);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{t('integ.whereTitle')}</div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 14, lineHeight: 1.5 }}>
        {t('integ.whereBody')}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {SETUP_GUIDES.map(p => (
          <button key={p.id} type="button" onClick={() => setPlatformId(p.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 20, cursor: "pointer",
              border: `1px solid ${platformId === p.id ? C.purple : C.border}`,
              background: platformId === p.id ? C.purpleSoft : C.surface,
              color: platformId === p.id ? C.purple : C.textSub,
              fontSize: 12, fontWeight: 500, fontFamily: F.sans,
            }}>
            <BrandIcon id={p.id === "ga4" ? "google" : p.id} size={12} />
            {p.name}
          </button>
        ))}
      </div>
      <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 1.9 }}>
        {tList(`integ.guides.${platform.id}.steps`).map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {snippet && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, background: C.surfaceAlt, borderRadius: 8, marginBottom: note ? 12 : 0 }}>
          <pre style={{ margin: 0, fontSize: 11, fontFamily: F.mono, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-all", flex: 1 }}>{snippet}</pre>
          <CopyButton value={snippet} label={t('integ.copy')} copiedLabel={t('integ.copied')} variant="ghost" size="sm" />
        </div>
      )}
      {note && (
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, lineHeight: 1.6 }}>{note}</div>
      )}
    </div>
  );
}

function PromoCodesCard({ campaigns, promoCodes, onCreated }) {
  const { t, tx, formatDate } = useT();
  const [campaignId, setCampaignId] = useState("");
  const [code, setCode] = useState("");
  const [vanitySlug, setVanitySlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function create() {
    if (!campaignId || !code.trim()) return;
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("campaign_promo_codes").insert({
      campaign_id: campaignId,
      advertiser_id: user.id,
      code: code.trim(),
      vanity_path: vanitySlug.trim() ? `/go/${vanitySlug.trim()}` : null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setCode(""); setVanitySlug("");
    onCreated?.();
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{t('integ.promoTitle')}</div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>
        {tx('integ.promoBody', { code: chunk => <code>{chunk}</code> })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans }}>{t('integ.campaign')}</label>
          <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
            style={{ padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: F.sans, color: C.text, background: C.surface }}>
            <option value="">{t('integ.select')}</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.campaign_name || c.id}</option>)}
          </select>
        </div>
        <Inp label={t('integ.promoCode')} placeholder="SEEONSCREEN10" value={code} onChange={e => setCode(e.target.value)} />
        <Inp label={t('integ.vanityPath')} placeholder={t('integ.vanityPlaceholder')} value={vanitySlug} onChange={e => setVanitySlug(e.target.value)} />
        <Btn onClick={create} disabled={saving || !campaignId || !code.trim()}>{saving ? t('integ.adding') : t('integ.add')}</Btn>
      </div>
      {error && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 12 }}>{error}</div>}
      {promoCodes.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>{t('integ.noPromo')}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {promoCodes.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: C.surfaceAlt, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.mono }}>{p.code}</div>
                {p.vanity_path && <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>{p.vanity_path}</div>}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{formatDate(p.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversionTrackingTab() {
  const { t } = useT();
  const [hasKey, setHasKey] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [postbackRes, campaignsRes, promoRes] = await Promise.all([
      supabase.from("advertiser_integrations").select("id").eq("advertiser_id", user.id).eq("platform", "adgrid_postback").eq("enabled", true).maybeSingle(),
      supabase.from("bookings").select("id, campaign_name").eq("advertiser_id", user.id).order("created_at", { ascending: false }),
      supabase.from("campaign_promo_codes").select("*").eq("advertiser_id", user.id).order("created_at", { ascending: false }),
    ]);
    setHasKey(Boolean(postbackRes.data));
    setCampaigns(campaignsRes.data ?? []);
    setPromoCodes(promoRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 20, fontFamily: F.sans, color: C.textSub }}>{t('common.loading')}</div>;

  return (
    <div>
      <PostbackKeyCard hasKey={hasKey} onGenerated={load} />
      <PixelSnippetCard />
      <PlatformSetupGuide />
      <PromoCodesCard campaigns={campaigns} promoCodes={promoCodes} onCreated={load} />
    </div>
  );
}

// ─── API Keys tab ─────────────────────────────────────────────────────────────
// Competitive Parity Program, Phase 6, G21 REST API half (docs/superpowers/
// specs/2026-09-08-rest-campaign-api-design.md): "REST campaign API with
// scoped keys." Generate/list/revoke keys scoped to this advertiser's own
// account; the API itself lives at supabase/functions/api-campaigns.

const API_BASE_URL = `${SUPABASE_FUNCTIONS_URL}/api-campaigns/v1`;

function ApiKeysTab() {
  const { t, tx, formatDate } = useT();
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("api_keys").select("id, name, key_prefix, last_used_at, revoked_at, created_at").eq("advertiser_id", user.id).order("created_at", { ascending: false });
    setKeys(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function generate() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const key = generateApiKey();
    const key_hash = await hashApiKey(key);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("api_keys").insert({
      advertiser_id: user.id,
      name: name.trim(),
      key_prefix: apiKeyPrefix(key),
      key_hash,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNewKey(key);
    setName("");
    load();
  }

  async function revoke(id) {
    await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  if (loading) return <div style={{ padding: 20, fontFamily: F.sans, color: C.textSub }}>{t('common.loading')}</div>;

  return (
    <div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{t('integ.apiTitle')}</div>
        <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>
          {tx('integ.apiBody', { url: <code>{API_BASE_URL}</code> })}
        </div>
        {newKey ? (
          <div style={{ padding: 12, background: C.surfaceAlt, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 6 }}>
              {tx('integ.copyNow', { code: chunk => <code>{chunk}</code> })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ fontSize: 12, fontFamily: F.mono, color: C.text, wordBreak: "break-all" }}>{newKey}</code>
              <CopyButton value={newKey} label={t('integ.copy')} copiedLabel={t('integ.copied')} variant="ghost" size="sm" />
            </div>
          </div>
        ) : null}
        {error && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
          <Inp label={t('integ.keyName')} placeholder={t('integ.keyNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
          <Btn variant="secondary" size="sm" onClick={generate} disabled={saving || !name.trim()}>{saving ? t('integ.generating') : t('integ.generateKey')}</Btn>
        </div>
      </div>

      {keys.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>{t('integ.noKeys')}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {keys.map(k => (
            <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.surfaceAlt, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
                  {k.name} {k.revoked_at && <span style={{ color: C.red, fontWeight: 400 }}>{t('integ.revoked')}</span>}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.mono, marginTop: 2 }}>{k.key_prefix}…</div>
                <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>
                  {t('integ.created', { date: formatDate(k.created_at) })}{k.last_used_at ? t('integ.lastUsed', { date: formatDate(k.last_used_at) }) : ""}
                </div>
              </div>
              {!k.revoked_at && (
                <Btn variant="ghost" size="sm" onClick={() => revoke(k.id)} style={{ color: C.red }}>{t('integ.revoke')}</Btn>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

export default function AdvIntegrationsView() {
  const { isMobile } = useBreakpoint();
  const { t, formatDateTime } = useT();
  const [tab, setTab] = useState("platforms");
  const [integrations, setIntegrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPlatform, setModalPlatform] = useState(null);
  const channelRef = useRef(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [intgRes, evtRes] = await Promise.all([
      supabase.from("advertiser_integrations").select("*").eq("advertiser_id", user.id),
      supabase.from("integration_events").select("*").eq("advertiser_id", user.id)
        .order("fired_at", { ascending: false }).limit(100),
    ]);

    setIntegrations(intgRes.data ?? []);
    setEvents(evtRes.data ?? []);
    setLoading(false);

    // Realtime: new events
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel(`integration_events_${user.id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "integration_events",
          filter: `advertiser_id=eq.${user.id}`,
        }, payload => {
          setEvents(prev => [payload.new, ...prev].slice(0, 100));
        })
        .subscribe();
    }
  }

  useEffect(() => {
    load();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  async function handleDisconnect(platformId) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("advertiser_integrations")
      .delete()
      .eq("advertiser_id", user.id)
      .eq("platform", platformId);
    setIntegrations(prev => prev.filter(i => i.platform !== platformId));
  }

  const integrationMap = Object.fromEntries(integrations.map(i => [i.platform, i]));
  const eventCountMap = {};
  events.forEach(e => { eventCountMap[e.platform] = (eventCountMap[e.platform] ?? 0) + 1; });

  const TAB_STYLE = (active) => ({
    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
    fontFamily: F.sans, fontSize: 13, fontWeight: 600,
    background: active ? C.surface : "transparent",
    color: active ? C.text : C.textSub,
    boxShadow: active ? `0 1px 4px rgba(0,0,0,0.08)` : "none",
    transition: "background 0.15s",
  });

  if (loading) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>{t('integ.loading')}</div>
  );

  return (
    <div style={{ maxWidth: 960 }}>
      <PageHeader title={t('integ.title')} subtitle={t('integ.subtitle')} />

      {/* Tabs */}
      <div style={{
        display: "inline-flex", gap: 4, background: C.surfaceAlt,
        padding: 4, borderRadius: 10, marginBottom: 28,
      }}>
        <button style={TAB_STYLE(tab === "platforms")} onClick={() => setTab("platforms")}
          onMouseEnter={e => { if (tab !== "platforms") e.currentTarget.style.background = C.surface; }}
          onMouseLeave={e => { if (tab !== "platforms") e.currentTarget.style.background = "transparent"; }}
        >
          {t('integ.tabPlatforms')}
        </button>
        <button style={TAB_STYLE(tab === "events")} onClick={() => setTab("events")}
          onMouseEnter={e => { if (tab !== "events") e.currentTarget.style.background = C.surface; }}
          onMouseLeave={e => { if (tab !== "events") e.currentTarget.style.background = "transparent"; }}
        >
          {t('integ.tabEvents')} {events.length > 0 && <span style={{ marginLeft: 6, padding: "1px 7px", background: C.purpleSoft, color: C.purple, borderRadius: 10, fontSize: 11 }}>{events.length}</span>}
        </button>
        <button style={TAB_STYLE(tab === "conversions")} onClick={() => setTab("conversions")}
          onMouseEnter={e => { if (tab !== "conversions") e.currentTarget.style.background = C.surface; }}
          onMouseLeave={e => { if (tab !== "conversions") e.currentTarget.style.background = "transparent"; }}
        >
          {t('integ.tabConversions')}
        </button>
        <button style={TAB_STYLE(tab === "api-keys")} onClick={() => setTab("api-keys")}
          onMouseEnter={e => { if (tab !== "api-keys") e.currentTarget.style.background = C.surface; }}
          onMouseLeave={e => { if (tab !== "api-keys") e.currentTarget.style.background = "transparent"; }}
        >
          {t('integ.tabApi')}
        </button>
      </div>

      {/* Platforms tab */}
      {tab === "platforms" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
          {PLATFORMS.map(p => (
            <PlatformCard
              key={p.id}
              platform={p}
              integration={integrationMap[p.id]}
              eventCount={eventCountMap[p.id] ?? 0}
              onConnect={() => setModalPlatform(p)}
              onDisconnect={() => handleDisconnect(p.id)}
            />
          ))}
        </div>
      )}

      {/* Event Log tab */}
      {tab === "events" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          {events.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: C.textSub, fontSize: 14 }}>
              {t('integ.noEvents')}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
                  {["platform", "event", "scanId", "status", "time"].map(h => (
                    <th key={h} style={{
                      padding: "11px 16px", textAlign: "left", fontSize: 11,
                      fontWeight: 600, color: C.textSub, fontFamily: F.sans,
                      letterSpacing: "0.05em", textTransform: "uppercase",
                    }}>{t(`integ.col.${h}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id} style={{
                    borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : "none",
                  }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.text, fontFamily: F.sans, fontWeight: 500 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <BrandIcon id={e.platform} size={12} />
                        {PLATFORMS.find(p => p.id === e.platform)?.name ?? e.platform}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.textMid, fontFamily: F.sans }}>{e.event_type}</td>
                    <td style={{ padding: "12px 16px", fontSize: 11, color: C.textSub, fontFamily: F.mono }}>
                      {e.scan_id ? e.scan_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <EventStatusBadge status={e.status} />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans }}>
                      {formatDateTime(e.fired_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Conversion Tracking tab */}
      {tab === "conversions" && <ConversionTrackingTab />}

      {/* API Keys tab */}
      {tab === "api-keys" && <ApiKeysTab />}

      {/* Connect modal */}
      {modalPlatform && (
        <ConnectModal
          platform={modalPlatform}
          existing={integrationMap[modalPlatform.id]}
          onClose={() => setModalPlatform(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
