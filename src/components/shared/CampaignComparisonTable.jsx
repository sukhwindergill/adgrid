import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { Badge } from '../primitives/Badge.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { useT } from '../../i18n/useT.js';

// Side-by-side comparison for campaigns a media buyer selects from the list
// — the list itself only ever showed one campaign's numbers at a time, with
// no way to see spend/CPM/cost-per-scan next to each other to decide where
// budget is working harder. Built from fields already on each campaign row
// (no extra fetch); efficiency columns are null, not a fake $0, when there's
// nothing to divide by yet — same convention as the dashboard KPIs.
export function CampaignComparisonTable({ campaigns, onRemove }) {
  const { t, formatCurrency, formatNumber, formatDate } = useT();
  if (campaigns.length === 0) return null;
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 });

  const rows = [
    { label: t('widgets.compare.status'), render: c => <Badge status={c.badgeStatus ?? c.status} /> },
    { label: t('widgets.compare.budget'), render: c => money(c.budget) },
    { label: t('widgets.compare.spent'), render: c => money(c.spent) },
    { label: t('widgets.compare.impressions'), render: c => formatNumber(c.impressions) },
    { label: t('widgets.compare.scans'), render: c => formatNumber(c.scans) },
    { label: t('widgets.compare.cpm'), render: c => c.impressions > 0 ? formatCurrency((c.spent / c.impressions) * 1000) : '—' },
    { label: t('widgets.compare.costPerScan'), render: c => c.scans > 0 ? formatCurrency(c.spent / c.scans) : '—' },
    { label: t('widgets.compare.screens'), render: c => c.screenCount },
    { label: t('widgets.compare.flight'), render: c => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(c.start)} → {formatDate(c.end)}</span> },
  ];

  return (
    <Card style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ ...TX.title, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
        {t('widgets.compare.title', { count: campaigns.length })}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.base, minWidth: 480 + campaigns.length * 140 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 20px', color: C.textSub, fontWeight: 500, fontFamily: F.sans, borderBottom: `1px solid ${C.border}`, background: C.bg, position: 'sticky', left: 0 }} />
              {campaigns.map(c => (
                <th key={c.id} style={{ textAlign: 'left', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.bg, minWidth: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.advertiser}</span>
                    {onRemove && (
                      <Btn variant="unstyled" onClick={() => onRemove(c.id)} aria-label={t('widgets.compare.remove', { name: c.advertiser })}
                        style={{ color: C.textMuted, fontSize: T.md, lineHeight: 1, padding: 2 }}>✕</Btn>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 20px', color: C.textSub, fontFamily: F.sans, fontWeight: 500, whiteSpace: 'nowrap', background: C.surface, position: 'sticky', left: 0 }}>{row.label}</td>
                {campaigns.map(c => (
                  <td key={c.id} style={{ padding: '10px 20px', color: C.text, fontFamily: F.mono, fontVariantNumeric: 'tabular-nums' }}>{row.render(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
