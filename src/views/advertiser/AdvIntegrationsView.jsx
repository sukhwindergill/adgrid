import { useState, useEffect, useRef } from "react";
import { C, F, SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";

// ─── Platform definitions ───────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "meta",
    name: "Meta Conversions API",
    logo: "📘",
    description: "Send scan events as ViewContent conversions to your Meta Pixel via server-side CAPI.",
    fields: [
      { key: "pixel_id", label: "Pixel ID", placeholder: "123456789012345", type: "text" },
      { key: "access_token", label: "System User Access Token", placeholder: "EAAx…", type: "password" },
    ],
    eventType: "ViewContent",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api",
  },
  {
    id: "google",
    name: "Google Ads",
    logo: "🔵",
    description: "Import scan conversions into Google Ads for attribution and ROAS measurement.",
    fields: [
      { key: "conversion_id", label: "Conversion ID", placeholder: "AW-000000000", type: "text" },
      { key: "conversion_label", label: "Conversion Label", placeholder: "abc123XYZ", type: "text" },
      { key: "customer_id", label: "Customer ID", placeholder: "123-456-7890", type: "text" },
      { key: "developer_token", label: "Developer Token", placeholder: "dTk…", type: "password" },
      { key: "refresh_token", label: "OAuth Refresh Token", placeholder: "1//0g…", type: "password" },
    ],
    eventType: "Conversion",
    docsUrl: "https://developers.google.com/google-ads/api/docs/conversions/upload-clicks",
  },
  {
    id: "shopify",
    name: "Shopify",
    logo: "🛍️",
    description: "POST scan events to your Shopify store via webhook for customer journey tracking.",
    fields: [
      { key: "webhook_url", label: "Webhook URL", placeholder: "https://yourstore.myshopify.com/webhooks/adgrid", type: "text" },
      { key: "secret", label: "Webhook Secret (optional)", placeholder: "whsec_…", type: "password" },
    ],
    eventType: "scan.created",
    docsUrl: "https://shopify.dev/docs/apps/webhooks",
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ connected }) {
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: connected ? C.greenSoft : C.surfaceAlt,
      color: connected ? C.green : C.textSub,
      border: `1px solid ${connected ? C.greenBorder : C.border}`,
    }}>
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function EventStatusBadge({ status }) {
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: status === "sent" ? C.greenSoft : C.redSoft,
      color: status === "sent" ? C.green : C.red,
    }}>
      {status === "sent" ? "Sent" : "Failed"}
    </span>
  );
}

function ConnectModal({ platform, existing, onClose, onSaved }) {
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
          <span style={{ fontSize: 28 }}>{platform.logo}</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: F.sans }}>
              Connect {platform.name}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>
              {platform.description}
            </div>
          </div>
        </div>

        {platform.fields.map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
              {f.label}
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
                background: C.surface,
              }}
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
            {testResult === "ok" ? "Test event sent successfully." : "Test failed — check your credentials."}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
            background: C.blue, color: "#fff", fontSize: 14, fontWeight: 600,
            fontFamily: F.sans, cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Saving…" : "Save & Connect"}
          </button>
          <button onClick={handleTest} disabled={testing} style={{
            padding: "10px 16px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.textMid, fontSize: 14, fontWeight: 500,
            fontFamily: F.sans, cursor: testing ? "not-allowed" : "pointer",
          }}>
            {testing ? "Testing…" : "Test"}
          </button>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.textMid, fontSize: 14, fontWeight: 500,
            fontFamily: F.sans, cursor: "pointer",
          }}>
            Cancel
          </button>
        </div>

        <a href={platform.docsUrl} target="_blank" rel="noreferrer" style={{
          display: "block", textAlign: "center", marginTop: 14, fontSize: 12,
          color: C.blue, fontFamily: F.sans, textDecoration: "none",
        }}>
          View {platform.name} docs →
        </a>
      </div>
    </div>
  );
}

function PlatformCard({ platform, integration, eventCount, onConnect, onDisconnect }) {
  const connected = !!integration;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 24, display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>{platform.logo}</span>
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
        {platform.description}
      </div>

      {connected && (
        <div style={{
          padding: "10px 14px", background: C.surfaceAlt, borderRadius: 8,
          fontSize: 13, fontFamily: F.sans, color: C.textMid,
        }}>
          <span style={{ fontWeight: 600, color: C.text }}>{eventCount}</span> events fired
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button onClick={onConnect} style={{
          flex: 1, padding: "9px 0", borderRadius: 8,
          border: connected ? `1px solid ${C.border}` : "none",
          background: connected ? C.surface : C.blue,
          color: connected ? C.textMid : "#fff",
          fontSize: 13, fontWeight: 600, fontFamily: F.sans, cursor: "pointer",
        }}>
          {connected ? "Edit" : "Connect"}
        </button>
        {connected && (
          <button onClick={onDisconnect} style={{
            padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.redBorder}`,
            background: C.redSoft, color: C.red, fontSize: 13,
            fontWeight: 600, fontFamily: F.sans, cursor: "pointer",
          }}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

export default function AdvIntegrationsView() {
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
  });

  if (loading) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading integrations…</div>
  );

  return (
    <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 960 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>Integrations</h2>
        <p style={{ fontSize: 14, color: C.textSub, margin: 0 }}>
          Connect ad platforms to receive scan events as server-side conversions.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "inline-flex", gap: 4, background: C.surfaceAlt,
        padding: 4, borderRadius: 10, marginBottom: 28,
      }}>
        <button style={TAB_STYLE(tab === "platforms")} onClick={() => setTab("platforms")}>
          Platforms
        </button>
        <button style={TAB_STYLE(tab === "events")} onClick={() => setTab("events")}>
          Event Log {events.length > 0 && <span style={{ marginLeft: 6, padding: "1px 7px", background: C.blueSoft, color: C.blue, borderRadius: 10, fontSize: 11 }}>{events.length}</span>}
        </button>
      </div>

      {/* Platforms tab */}
      {tab === "platforms" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
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
              No events yet. Connect a platform and trigger a scan to see events here.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
                  {["Platform", "Event", "Scan ID", "Status", "Time"].map(h => (
                    <th key={h} style={{
                      padding: "11px 16px", textAlign: "left", fontSize: 11,
                      fontWeight: 600, color: C.textSub, fontFamily: F.sans,
                      letterSpacing: "0.05em", textTransform: "uppercase",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id} style={{
                    borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : "none",
                  }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.text, fontFamily: F.sans, fontWeight: 500 }}>
                      {PLATFORMS.find(p => p.id === e.platform)?.logo ?? "•"} {PLATFORMS.find(p => p.id === e.platform)?.name ?? e.platform}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.textMid, fontFamily: F.sans }}>{e.event_type}</td>
                    <td style={{ padding: "12px 16px", fontSize: 11, color: C.textSub, fontFamily: F.mono }}>
                      {e.scan_id ? e.scan_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <EventStatusBadge status={e.status} />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans }}>
                      {new Date(e.fired_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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
