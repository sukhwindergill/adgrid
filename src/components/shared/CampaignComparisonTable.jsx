import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { Badge } from '../primitives/Badge.jsx';

// Side-by-side comparison for campaigns a media buyer selects from the list
// — the list itself only ever showed one campaign's numbers at a time, with
// no way to see spend/CPM/cost-per-scan next to each other to decide where
// budget is working harder. Built from fields already on each campaign row
// (no extra fetch); efficiency columns are null, not a fake $0, when there's
// nothing to divide by yet — same convention as the dashboard KPIs.
export function CampaignComparisonTable({ campaigns, onRemove }) {
  if (campaigns.length === 0) return null;

  const rows = [
    { label: 'Status',          render: c => <Badge status={c.badgeStatus ?? c.status} /> },
    { label: 'Budget',          render: c => `$${c.budget.toLocaleString()}` },
    { label: 'Spent',           render: c => `$${c.spent.toLocaleString()}` },
    { label: 'Impressions',     render: c => c.impressions.toLocaleString() },
    { label: 'Scans',           render: c => c.scans.toLocaleString() },
    { label: 'CPM',             render: c => c.impressions > 0 ? `$${((c.spent / c.impressions) * 1000).toFixed(2)}` : '—' },
    { label: 'Cost per Scan',   render: c => c.scans > 0 ? `$${(c.spent / c.scans).toFixed(2)}` : '—' },
    { label: 'Screens',         render: c => c.screenCount },
    { label: 'Flight',          render: c => <span style={{ whiteSpace: 'nowrap' }}>{c.start} → {c.end}</span> },
  ];

  return (
    <Card style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
        Comparing {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 + campaigns.length * 140 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 20px', color: C.textSub, fontWeight: 500, fontFamily: F.sans, borderBottom: `1px solid ${C.border}`, background: C.bg, position: 'sticky', left: 0 }} />
              {campaigns.map(c => (
                <th key={c.id} style={{ textAlign: 'left', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.bg, minWidth: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.advertiser}</span>
                    {onRemove && (
                      <button onClick={() => onRemove(c.id)} aria-label={`Remove ${c.advertiser} from comparison`}
                        style={{ border: 'none', background: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
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
