import { useState, useEffect } from "react";
import { C, F } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBreakpoint } from "../../lib/useBreakpoint.js";

function Card({ label, value, sub }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "20px 24px", flex: 1, minWidth: 160, fontFamily: F.sans,
    }}>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function exportCSV(rows) {
  const header = ["Timestamp", "Campaign", "Screen", "Device", "City", "Email", "Consent"];
  const lines = rows.map((r) => [
    new Date(r.scanned_at).toISOString(),
    r.bookings?.advertiser_name ?? "",
    r.screens?.name ?? "",
    r.device_type ?? "",
    r.city ?? "",
    r.email ?? "",
    r.consent ? "yes" : "no",
  ].join(","));
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "adgrid-scans.csv";
  a.click();
}

export default function ScansView({ impersonatingId }) {
  const { isMobile } = useBreakpoint();
  const { user } = useAuth();
  const effectiveId = impersonatingId ?? user?.id;
  const [scans, setScans] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ padding: isMobile ? "20px 16px" : "32px 40px", fontFamily: F.sans, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 24px" }}>
        Scans & Data
      </h2>

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <Card label="Total Scans" value={scans.length.toLocaleString()} />
        <Card label="This Month" value={thisMonth.length.toLocaleString()} />
        <Card label="Unique Screens" value={uniqueScreens} />
        <Card label="Top Campaign" value={topCampaign} />
      </div>

      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Scans — last 30 days
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {chartData.map((d) => (
            <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: "100%", borderRadius: 3,
                height: `${Math.max(3, (d.count / maxCount) * 70)}px`,
                background: d.count > 0 ? C.blue : C.border,
                transition: "height 0.2s",
              }} title={`${d.label}: ${d.count}`} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          style={{
            border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px",
            fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface,
          }}
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.advertiser_name}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: F.sans, fontSize: 13, color: C.text }} />
        <span style={{ color: C.textSub, fontSize: 13 }}>to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: F.sans, fontSize: 13, color: C.text }} />
        <button
          onClick={() => exportCSV(filtered)}
          style={{
            marginLeft: "auto", padding: "7px 16px", borderRadius: 8,
            background: C.blue, color: "#fff", border: "none", cursor: "pointer",
            fontFamily: F.sans, fontSize: 13, fontWeight: 500,
          }}
        >
          Export CSV
        </button>
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
                {["Timestamp", "Campaign", "Screen", "Device", "City", "UTM Source"].map((h) => (
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
                  <td style={{ padding: "10px 16px", color: C.textSub }}>{s.city ?? "—"}</td>
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
      )}
    </div>
  );
}
