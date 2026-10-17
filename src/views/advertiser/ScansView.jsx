import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { downloadCsv } from "../../lib/csv.js";
import { computeVariantPerformance } from "../../lib/variantPerformance.js";
import { PageHeader } from "../../components/primitives/PageHeader.jsx";
import { Card } from "../../components/primitives/Card.jsx";
import { KPI } from "../../components/primitives/KPI.jsx";
import { Btn } from "../../components/primitives/Btn.jsx";
import { useT } from "../../i18n/useT.js";
import { T, C, F } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';

// Header labels are translated; cell values (yes/no, ISO timestamps) stay
// machine-readable for remarketing tools.
const SCAN_EXPORT_COLUMNS = [
  { key: "timestamp", label: "timestamp" },
  { key: "campaign",  label: "campaign" },
  { key: "screen",    label: "screen" },
  { key: "device",    label: "device" },
  { key: "country",   label: "country" },
  { key: "email",     label: "email" },
  { key: "consent",   label: "consent" },
  // Disclose why a scan was excluded from reported counts. An export that
  // hides the filtering invites "your numbers don't match" support tickets.
  { key: "filtered_bot",       label: "filteredBot" },
  { key: "filtered_duplicate", label: "filteredDuplicate" },
];

function exportCSV(rows, t) {
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
  downloadCsv("adgrid-scans.csv", SCAN_EXPORT_COLUMNS.map(c => ({ ...c, label: t(`scans.col.${c.label}`) })), flat);
}

export default function ScansView({ impersonatingId }) {
  const { user } = useAuth();
  const { t, formatNumber, formatPercent, formatCurrency, formatDate, formatDateTime } = useT();
  const effectiveId = impersonatingId ?? user?.id;
  const [scans, setScans] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [variantPerf, setVariantPerf] = useState(null); // null = not a variant-test campaign (or none selected)

  // Per-variant reporting (Competitive Parity Program G15, reporting half --
  // rotation and attribution already ship, see src/lib/variantPerformance.js).
  // Only fetched when a single campaign is selected, and only shown when
  // that campaign actually has more than one creative -- a campaign with
  // exactly one creative isn't running a variant test.
  useEffect(() => {
    if (filterCampaign === "all") return;
    let cancelled = false;
    Promise.all([
      supabase.from("campaign_creatives").select("id, label").eq("campaign_id", filterCampaign),
      supabase.from("ad_plays").select("creative_id").eq("campaign_id", filterCampaign),
      supabase.from("bookings").select("spent").eq("id", filterCampaign).maybeSingle(),
    ]).then(([creativesRes, playsRes, bookingRes]) => {
      if (cancelled) return;
      const creatives = creativesRes.data ?? [];
      if (creatives.length < 2) { setVariantPerf(null); return; }
      const campaignScans = scans.filter((s) => s.campaign_id === filterCampaign);
      const spend = Number(bookingRes.data?.spent) || 0;
      setVariantPerf(computeVariantPerformance(creatives, playsRes.data ?? [], campaignScans, spend));
    });
    return () => { cancelled = true; };
  }, [filterCampaign, scans]);

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
      days.push({ key, label: formatDate(d, { month: "short", day: "numeric" }), count: 0 });
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
    <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>{t('scans.loading')}</div>
  );

  if (loadError) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.redText }}>{t('scans.loadError')}</div>
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHeader title={t('scans.title')} subtitle={t('scans.subtitle')} />

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <KPI label={t('scans.kpiTotal')} value={formatNumber(scans.length)} />
        <KPI label={t('scans.kpiMonth')} value={formatNumber(thisMonth.length)} />
        <KPI label={t('scans.kpiScreens')} value={uniqueScreens} />
        <KPI label={t('scans.kpiTop')} value={topCampaign} />
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ ...TX.title, marginBottom: 16 }}>
          {t('scans.chartTitle')}
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
        <SelInput value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} style={{ borderRadius: 8, padding: "6px 12px", fontFamily: F.sans, fontSize: T.base, color: C.text, background: C.surface, transition: 'border-color 0.15s' }}>
          <option value="all">{t('scans.allCampaigns')}</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.advertiser_name}</option>
          ))}
        </SelInput>
        <Inp type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...TX.body, borderRadius: 8, padding: "6px 10px", transition: 'border-color 0.15s' }} />
        <span style={{ color: C.textSub, fontSize: T.base }}>{t('scans.to')}</span>
        <Inp type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...TX.body, borderRadius: 8, padding: "6px 10px", transition: 'border-color 0.15s' }} />
        <div style={{ marginLeft: "auto" }}>
          <Btn onClick={() => exportCSV(filtered, t)}>{t('scans.exportCsv')}</Btn>
        </div>
      </div>

      {filterCampaign !== "all" && variantPerf && variantPerf.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: T.md, fontWeight: 600, color: C.text }}>
            {t('scans.variantPerformance')}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: T.base }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {["variant", "plays", "scans", "scanRate", "costPerScan"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{t(`scans.col.${h}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variantPerf.map((v) => (
                  <tr key={v.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 16px", color: C.text, fontWeight: 500 }}>{v.label}</td>
                    <td style={{ padding: "10px 16px", color: C.textSub, fontFamily: F.mono }}>{formatNumber(v.plays)}</td>
                    <td style={{ padding: "10px 16px", color: C.textSub, fontFamily: F.mono }}>{formatNumber(v.scans)}</td>
                    <td style={{ padding: "10px 16px", color: C.text, fontFamily: F.mono }}>{formatPercent(v.scanRate, { decimals: 2, minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: "10px 16px", color: C.text, fontFamily: F.mono }}>{v.costPerScan === null ? "—" : formatCurrency(v.costPerScan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: T.md, fontWeight: 600, color: C.text }}>
          {t('scans.scanLog', { count: filtered.length })}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: T.base }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["timestamp", "campaign", "screen", "device", "country", "utmSource"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{t(`scans.col.${h}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", color: C.text, fontFamily: F.mono, fontSize: T.sm }}>
                    {formatDateTime(s.scanned_at)}
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
                    {t('scans.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {emailCaptures.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: T.md, fontWeight: 600, color: C.text }}>
            {t('scans.emailCaptures', { count: emailCaptures.length })}
          </div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: T.base, minWidth: 400 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["email", "consent", "campaign", "date"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{t(`scans.col.${h}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emailCaptures.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.email}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: T.xs, fontWeight: 600,
                      background: s.consent ? C.greenLight : C.redLight,
                      color: s.consent ? C.greenText : C.redText,
                    }}>{s.consent ? t('scans.yes') : t('scans.no')}</span>
                  </td>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.bookings?.advertiser_name ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub, fontSize: T.sm }}>
                    {formatDate(s.scanned_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}
