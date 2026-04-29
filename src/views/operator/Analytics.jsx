import { useState, useMemo } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const HOURLY_SCANS = [0,0,0,0,0,0,2,8,24,18,12,10,9,8,7,6,10,16,22,14,8,4,2,1];
const DAY_SCANS = { Mon: 18, Tue: 22, Wed: 25, Thu: 20, Fri: 28, Sat: 15, Sun: 8 };
const INTERESTS = [
  { label: 'Food & Dining', pct: 78 },
  { label: 'Coffee Enthusiasts', pct: 65 },
  { label: 'Urban Professionals', pct: 58 },
  { label: 'Tech & Gadgets', pct: 44 },
  { label: 'Health & Wellness', pct: 37 },
];

function HeatmapGrid({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {data.map((v, i) => (
        <div key={i} title={`${String(i).padStart(2, '0')}:00 — ${v} scans`} style={{
          width: 36, height: 36, borderRadius: 6, background: C.purple,
          opacity: 0.06 + (v / max) * 0.94,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: F.mono, color: v / max > 0.4 ? '#fff' : C.textMuted,
          cursor: 'default', transition: 'transform 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >{i}</div>
      ))}
    </div>
  );
}

function DayBars({ data }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
      {Object.entries(data).map(([day, v]) => (
        <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 10, fontFamily: F.mono, color: C.textMuted }}>{v}</div>
          <div style={{ width: '100%', height: `${(v / max) * 60}px`, background: C.purple, borderRadius: '3px 3px 0 0', opacity: 0.7, minHeight: 4 }} />
          <div style={{ fontSize: 10, fontFamily: F.sans, color: C.textMuted }}>{day}</div>
        </div>
      ))}
    </div>
  );
}

export function Analytics({ campaigns }) {
  const [filters, setFilters] = useState({ gender: '', age: '' });
  const { isMobile } = useBreakpoint();

  const totalImpr  = campaigns.reduce((a, c) => a + c.impressions, 0);
  const totalScans = campaigns.reduce((a, c) => a + c.scans, 0);
  const totalSpend = campaigns.filter(c => c.status === 'active').reduce((a, c) => a + c.budget, 0);
  const avgCPM     = totalImpr > 0 ? ((totalSpend / totalImpr) * 1000).toFixed(2) : '4.20';
  const scanRate   = totalImpr > 0 ? ((totalScans / totalImpr) * 100).toFixed(2) : '0.00';

  const byCity = [...new Set(campaigns.map(c => c.city))].map(city => {
    const cc = campaigns.filter(c => c.city === city);
    return { city, impr: cc.reduce((a, c) => a + c.impressions, 0), scans: cc.reduce((a, c) => a + c.scans, 0), spend: cc.reduce((a, c) => a + c.budget, 0) };
  });
  const maxImpr = Math.max(...byCity.map(c => c.impr), 1);

  const onFilterChange = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const onReset = () => setFilters({ gender: '', age: '' });

  const femalePct = 58, malePct = 42;
  const ageData = [['18–24', 18], ['25–34', 38], ['35–44', 24], ['45–54', 14], ['55+', 6]];

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Impression tracking, scan rates, demographics, and campaign performance" />

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, marginBottom: 24,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans }}>Filter by:</span>
        <select value={filters.gender} onChange={e => onFilterChange('gender', e.target.value)}
          style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}>
          <option value="">All Genders</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
        <select value={filters.age} onChange={e => onFilterChange('age', e.target.value)}
          style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}>
          <option value="">All Ages</option>
          <option value="18-24">18–24</option>
          <option value="25-34">25–34</option>
          <option value="35-44">35–44</option>
          <option value="45-54">45–54</option>
          <option value="55+">55+</option>
        </select>
        <button onClick={onReset} style={{ padding: '6px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.textSub, cursor: 'pointer' }}>
          Reset
        </button>
      </div>

      {/* KPIs with change indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Impressions" value={`${(totalImpr / 1000).toFixed(1)}K`} sub="verified" trend={8} icon="👁" />
        <KPI label="Avg CPM"           value={`£${avgCPM}`}                         sub="cost per 1,000" color={C.blue} icon="💲" />
        <KPI label="QR Scans"          value={totalScans}                            sub="total scans" color={C.green} icon="📲" />
        <KPI label="Scan Rate"         value={`${scanRate}%`}                        sub="scans / impressions" icon="📊" />
      </div>

      {/* Heatmap + Day bars */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Scans by Hour</div>
          <HeatmapGrid data={HOURLY_SCANS} />
          <div style={{ marginTop: 10, fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>Hover a block to see scan count · Darker = more scans</div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Scans by Day of Week</div>
          <DayBars data={DAY_SCANS} />
        </Card>
      </div>

      {/* Demographics + Interests */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Gender Split</div>
          {[['Female', femalePct, '#ec4899'], ['Male', malePct, C.blue]].map(([g, pct, col]) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{g}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: col, fontFamily: F.mono }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.surfaceAlt, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Age Distribution</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80, marginBottom: 8 }}>
            {ageData.map(([label, pct]) => {
              const max = Math.max(...ageData.map(d => d[1]), 1);
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 9, fontFamily: F.mono, color: C.textMuted }}>{pct}%</div>
                  <div style={{ width: '100%', height: `${(pct / max) * 60}px`, background: C.purple, opacity: 0.7, borderRadius: '2px 2px 0 0', minHeight: 3 }} />
                  <div style={{ fontSize: 9, fontFamily: F.sans, color: C.textMuted, whiteSpace: 'nowrap' }}>{label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Audience Interests</div>
          {INTERESTS.map(({ label, pct }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: C.textMid, fontFamily: F.sans }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.purple, fontFamily: F.mono }}>{pct}%</span>
              </div>
              <ProgressBar value={pct} max={100} height={4} />
            </div>
          ))}
        </Card>
      </div>

      {/* Impressions by city */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Impressions by City</div>
          {byCity.map(({ city, impr, scans }) => (
            <div key={city} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{city}</span>
                <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{(impr / 1000).toFixed(0)}K impr · {scans} scans</span>
              </div>
              <ProgressBar value={impr} max={maxImpr} height={5} />
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>24h Impression Pattern</div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 80, marginBottom: 8 }}>
            {[12,8,6,4,3,5,18,42,68,72,65,58,62,55,48,52,70,86,90,78,55,38,24,16].map((v, h) => {
              const max = 90;
              return (
                <div key={h} title={`${String(h).padStart(2, '0')}:00`} style={{
                  flex: 1, borderRadius: '2px 2px 0 0',
                  background: h === new Date().getHours() ? C.purple : C.purpleSoft,
                  height: `${Math.max(3, (v / max) * 80)}px`,
                  border: h === new Date().getHours() ? `1px solid ${C.purple}` : 'none',
                  transition: 'height 0.3s',
                }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textMuted, fontFamily: F.mono }}>
            {['00:00', '06:00', '12:00', '18:00', '23:00'].map(t => <span key={t}>{t}</span>)}
          </div>
        </Card>
      </div>

      {/* Campaign table */}
      <Table
        columns={[
          { key: 'advertiser', label: 'Campaign', render: (v, r) => <div><div style={{ fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</div><div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{r.category} · {r.city}</div></div> },
          { key: 'screen',     label: 'Screen' },
          { key: 'impressions',label: 'Impressions', render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>{(v / 1000).toFixed(1)}K</span> },
          { key: 'scans',      label: 'Scans', render: v => <span style={{ color: C.purple, fontWeight: 600, fontFamily: F.mono }}>{v}</span> },
          { key: 'scans',      label: 'Scan Rate', render: (v, r) => <span style={{ fontFamily: F.sans }}>{r.impressions > 0 ? ((v / r.impressions) * 100).toFixed(2) : '0.00'}%</span> },
          { key: 'spent',      label: 'Spend', render: v => <span style={{ fontFamily: F.sans }}>£{v.toLocaleString()}</span> },
          { key: 'status',     label: 'Status', render: v => <Badge status={v} /> },
        ]}
        rows={campaigns}
        emptyTitle="No campaign data"
        emptyDescription="Campaigns will appear here once active"
      />
    </div>
  );
}
