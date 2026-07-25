import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { C, F } from '../../design/tokens.js';
import { downloadCsv } from '../../lib/csv.js';
import './CampaignReport.css';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : '';

const BASIS_LABEL = {
  measured: 'measured by camera',
  mixed: 'part measured, part modelled',
  modelled: 'modelled',
  none: 'no delivery yet',
};

export function CampaignReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${FUNCTIONS_URL}/campaign-report?t=${encodeURIComponent(token)}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(body.error ?? 'This report link is no longer available'); return; }
        setReport(body);
      })
      .catch(() => { if (!cancelled) setError('Could not load this report'); });
    return () => { cancelled = true; };
  }, [token]);

  if (error) {
    return (
      <div className="report-page" style={{ fontFamily: F.sans, color: C.textSub, textAlign: 'center', paddingTop: 80 }}>
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="report-page" style={{ fontFamily: F.sans, color: C.textMuted, textAlign: 'center', paddingTop: 80 }}>
        Loading report…
      </div>
    );
  }

  const { campaign, totals, daily, health } = report;

  return (
    <div className="report-page">
      <div className="report-actions">
        <button onClick={() => window.print()} style={btnStyle}>Print / Save PDF</button>
        <button
          onClick={() => downloadCsv(`${campaign.name}-delivery.csv`, [
            { key: 'day', label: 'Day' },
            { key: 'plays', label: 'Plays' },
            { key: 'impressions', label: 'Impressions' },
            { key: 'billable_scans', label: 'Scans' },
            { key: 'basis', label: 'Basis' },
          ], daily)}
          style={btnStyle}
        >Export CSV</button>
      </div>

      <div style={{ fontSize: 11, letterSpacing: 3, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', marginBottom: 8 }}>
        ADGRID CAMPAIGN REPORT
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>{campaign.name}</h1>
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28 }}>
        {campaign.category ? `${campaign.category} · ` : ''}{campaign.start_date} → {campaign.end_date}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <Stat label="Plays" value={totals.plays.toLocaleString()} sub="verified proof of play" />
        <Stat label="Impressions" value={totals.impressions.toLocaleString()} sub={BASIS_LABEL[totals.basis]} />
        <Stat label="QR Scans" value={totals.scans.toLocaleString()} sub="bot and duplicate filtered" />
      </div>

      {health?.delivery_pct != null && (
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28 }}>
          Delivery health: <strong style={{ color: C.text }}>{Number(health.delivery_pct).toFixed(1)}%</strong> of scheduled plays confirmed
          {Number(health.offline_days) > 0 && ` · ${health.offline_days} day(s) a screen was offline`}
        </div>
      )}

      {daily.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.sans, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: 'left', color: C.textSub }}>
              <th style={cell}>Day</th><th style={cell}>Plays</th><th style={cell}>Impressions</th><th style={cell}>Scans</th><th style={cell}>Basis</th>
            </tr>
          </thead>
          <tbody>
            {daily.map(r => (
              <tr key={`${r.day}-${r.plays}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={cell}>{r.day}</td>
                <td style={cell}>{Number(r.plays).toLocaleString()}</td>
                <td style={cell}>{Number(r.impressions).toLocaleString()}</td>
                <td style={cell}>{Number(r.billable_scans).toLocaleString()}</td>
                <td style={{ ...cell, color: C.textMuted }}>{r.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 13, color: C.textMuted, fontFamily: F.sans, padding: '24px 0' }}>
          No delivery recorded for this campaign yet.
        </div>
      )}
    </div>
  );
}

const cell = { padding: '8px 6px' };
const btnStyle = {
  padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.surface, color: C.textSub, fontFamily: F.sans, fontSize: 12, cursor: 'pointer',
};

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
