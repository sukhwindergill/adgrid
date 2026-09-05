import { useState, useEffect } from "react";
import { C, F } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { downloadCsv } from "../../lib/csv.js";
import { PageHeader } from "../../components/primitives/PageHeader.jsx";
import { Card } from "../../components/primitives/Card.jsx";
import { KPI } from "../../components/primitives/KPI.jsx";
import { Btn } from "../../components/primitives/Btn.jsx";

const SCAN_EXPORT_COLUMNS = [
  { key: "timestamp", label: "Timestamp" },
  { key: "campaign",  label: "Campaign" },
  { key: "screen",    label: "Screen" },
  { key: "device",    label: "Device" },
  { key: "country",   label: "Country" },
  { key: "email",     label: "Email" },
  { key: "consent",   label: "Consent" },
  // Disclose why a scan was excluded from reported counts. An export that
  // hides the filtering invites "your numbers don't match" support tickets.
  { key: "filtered_bot",       label: "Filtered as bot" },
  { key: "filtered_duplicate", label: "Filtered as duplicate" },
];

function exportCSV(rows) {
  // toCsv reads flat keys, and these rows carry joined relations.
  const flat = rows.map((r) => ({
    timestamp: r.scanned_at ? new Date(r.scanned_at).toISOString() : "",
    campaign:  r.bookings?.advertiser_name ?? "",
    screen:    r.screens?.name ?? "",
    device:    r.device_type ?? "",
    country:   r.country ?? "",
    email:     r.email ?? "",
    consent:   r.consent ? "yes" : "no",
    filtered_bot:       r.is_bot ? "yes" : "no",
    filtered_duplicate: r.is_duplicate ? "yes" : "no",
  }));
  downloadCsv("adgrid-scans.csv", SCAN_EXPORT_COLUMNS, flat);
}

export default function ScansView({ impersonatingId }) {
  const { user } = useAuth();
  const effectiveId = impersonatingId ?? user?.id;
  const [scans, setScans] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!effectiveId) return;
    Promise.all([
      supabase
        .from("scans")
        .select("*, bookings(advertiser_name), screens(name)")
        .eq("advertiser_id", effectiveId)
        .order("scanned_at", { ascending: false })
        .limit(500),
      supabase
        .from("bookings")
        .select("id, advertiser_name")
        .eq("advertiser_id", effectiveId),
    ]).then(([scansRes, campRes]) => {
      // A failed fetch previously left scans empty just like a genuine
      // zero-scans account, rendering "No scans yet" as if the QR codes
      // simply hadn't been scanned -- misleading when the query never ran.
      setLoadError(Boolean(scansRes.error || campRes.error));
      setScans(scansRes.data ?? []);
      setCampaigns(campRes.data ?? []);
      setLoading(false);
    });
  }, [effectiveId]);

  const filtered = scans.filter((s) => {
    if (filterCampaign !== "all" && s.campaign_id !== filterCampaign) return false;
    if (dateFrom && new Date(s.scanned_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(s.scanned_at) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const thisMonth = scans.filter((s) => {
    const d = new Date(s.scanned_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const uniqueScreens = new Set(scans.map((s) => s.screen_id).filter(Boolean)).size;

  const topCampaign = (() => {
    const counts = {};
    scans.forEach((s) => {
      if (s.campaign_id) counts[s.campaign_id] = (counts[s.campaign_id] ?? 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return "—";
    const camp = campaigns.find((c) => c.id === top[0]);
    return camp?.advertiser_name ?? "—";
  })();

  const emailCaptures = filtered.filter((s) => s.email);

  const chartData = (() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString("en", { month: "short", day: "numeric" }), count: 0 });
    }
    scans.forEach((s) => {
      const key = new Date(s.scanned_at).toISOString().slice(0, 10);
      const d = days.find((x) => x.key === key);
      if (d) d.count++;
    });
    return days;
  })();

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  if (loading) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading scans…</div>
  );

  if (loadError) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.red }}>Couldn't load scans — check your connection and try again.</div>
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHeader title="Scans & Data" subtitle="QR scan events, consent, and remarketing export" />

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <KPI label="Total Scans" value={scans.length.toLocaleString()} />
        <KPI label="This Month" value={thisMonth.length.toLocaleString()} />
        <KPI label="Unique Screens" value={uniqueScreens} />
        <KPI label="Top Campaign" value={topCampaign} />
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16, fontFamily: F.sans }}>
          Scans — last 30 days
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {chartData.map((d) => (
            <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: "100%", borderRadius: 3,
                height: `${Math.max(3, (d.count / maxCount) * 70)}px`,
                background: d.count > 0 ? C.purple : C.border,
                transition: "height 0.2s",
              }} title={`${d.label}: ${d.count}`} />
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          style={{
            border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px",
            fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface,
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.advertiser_name}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: F.sans, fontSize: 13, color: C.text, outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        />
        <span style={{ color: C.textSub, fontSize: 13 }}>to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: F.sans, fontSize: 13, color: C.text, outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        />
        <div style={{ marginLeft: "auto" }}>
          <Btn onClick={() => exportCSV(filtered)}>Export CSV</Btn>
        </div>
      </div>

      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        overflow: "hidden", marginBottom: 24,
      }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }}>
          Scan Log ({filtered.length})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Timestamp", "Campaign", "Screen", "Device", "Country", "UTM Source"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", color: C.text, fontFamily: F.mono, fontSize: 12 }}>
                    {new Date(s.scanned_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.bookings?.advertiser_name ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.screens?.name ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub }}>{s.device_type ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub }}>{s.country ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub }}>{s.utm_source ?? "adgrid"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", color: C.textMuted }}>
                    No scans yet. QR codes on screens will log here once scanned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {emailCaptures.length > 0 && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          overflow: "hidden",
        }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }}>
            Email Captures ({emailCaptures.length})
          </div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 400 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Email", "Consent", "Campaign", "Date"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emailCaptures.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.email}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: s.consent ? C.greenLight : C.redLight,
                      color: s.consent ? C.green : C.red,
                    }}>{s.consent ? "Yes" : "No"}</span>
                  </td>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.bookings?.advertiser_name ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub, fontSize: 12 }}>
                    {new Date(s.scanned_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
