import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { downloadCsv } from '../../lib/csv.js';
import { DeliveryCheckPanel } from '../../components/shared/DeliveryCheckPanel.jsx';
import './CampaignReport.css';
import { useT } from '../../i18n/useT.js';
import { t as tNow } from '../../i18n/core.js';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : '';


export function CampaignReport() {
  const { token } = useParams();
  const { t, tx, formatNumber, formatPercent, formatDate } = useT();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${FUNCTIONS_URL}/campaign-report?t=${encodeURIComponent(token)}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(body.error ?? tNow('public.report.unavailable')); return; }
        setReport(body);
      })
      .catch(() => { if (!cancelled) setError(tNow('public.report.loadError')); });
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
        {t('public.report.loading')}
      </div>
    );
  }

  const { campaign, totals, daily, health, deliveryCheck } = report;

  return (
    <div className="report-page">
      <div className="report-actions">
        <button onClick={() => window.print()} style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
        >{t('public.report.print')}</button>
        <button
          onClick={() => downloadCsv(`${campaign.name}-delivery.csv`, [
            { key: 'day', label: t('public.report.day') },
            { key: 'plays', label: t('public.report.plays') },
            { key: 'impressions', label: t('public.report.impressions') },
            { key: 'billable_scans', label: t('public.report.scans') },
            { key: 'basis', label: t('public.report.basis') },
          ], daily)}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
        >{t('public.report.exportCsv')}</button>
      </div>

      <div style={{ ...TX.caption, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
        {t('public.report.eyebrow')}
      </div>
      <h1 style={{ fontSize: T.display, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 4px' }}>{campaign.name}</h1>
      <div style={{ ...TX.bodySub, marginBottom: 28 }}>
        {campaign.category ? `${campaign.category} · ` : ''}{formatDate(campaign.start_date)} → {formatDate(campaign.end_date)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <Stat label={t('public.report.plays')} value={formatNumber(totals.plays)} sub={t('public.report.playsSub')} />
        <Stat label={t('public.report.impressions')} value={formatNumber(totals.impressions)} sub={t(`public.report.basisLabel.${totals.basis}`)} />
        <Stat label={t('public.report.qrScans')} value={formatNumber(totals.scans)} sub={t('public.report.scansSub')} />
      </div>

      {health?.delivery_pct != null && (
        <div style={{ ...TX.bodySub, marginBottom: 28 }}>
          {tx('public.report.health', {
            strong: chunk => <strong style={{ color: C.text }}>{chunk}</strong>,
            pct: formatPercent(Number(health.delivery_pct) / 100, { decimals: 1, minimumFractionDigits: 1 }),
          })}
          {Number(health.offline_days) > 0 && t('public.report.offline', { count: Number(health.offline_days) })}
        </div>
      )}

      {deliveryCheck && (
        <div style={{ marginBottom: 28 }}>
          {/* The public report never sends holdout_enabled directly (see
              campaign-report/index.ts) -- `deliveryCheck` is only present at
              all when it's true, so its presence alone is the signal here. */}
          <DeliveryCheckPanel holdoutEnabled={true} row={deliveryCheck} />
        </div>
      )}

      {daily.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.sans, fontSize: T.sm }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: 'left', color: C.textSub }}>
              <th style={cell}>{t('public.report.day')}</th><th style={cell}>{t('public.report.plays')}</th><th style={cell}>{t('public.report.impressions')}</th>
              <th style={cell}>{t('public.report.scans')}</th><th style={cell}>{t('public.report.basis')}</th>
            </tr>
          </thead>
          <tbody>
            {daily.map(r => (
              <tr key={`${r.day}-${r.plays}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={cell}>{formatDate(r.day)}</td>
                <td style={cell}>{formatNumber(r.plays)}</td>
                <td style={cell}>{formatNumber(r.impressions)}</td>
                <td style={cell}>{formatNumber(r.billable_scans)}</td>
                <td style={{ ...cell, color: C.textMuted }}>{r.basis ? t(`public.report.basisShort.${r.basis}`) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ ...TX.bodyMuted, padding: '24px 0' }}>
          {t('public.report.noDelivery')}
        </div>
      )}
    </div>
  );
}

const cell = { padding: '8px 6px' };
const btnStyle = {
  padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.surface, color: C.textSub, fontFamily: F.sans, fontSize: T.sm, cursor: 'pointer',
  transition: 'background 0.15s',
};

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: T.xs, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: T.xxl, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{value}</div>
      <div style={{ ...TX.caption, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
