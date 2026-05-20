import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SkeletonRow, Skeleton } from '../../components/ui/Skeleton.jsx';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const EMPTY_HOURLY = Array(24).fill(0);
const EMPTY_DAY    = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
const DAY_NAMES    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatmapGrid({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {data.map((v, i) => (
        <div key={i} title={`${String(i).padStart(2, '0')}:00 — ${v} people`} style={{
          width: 36, height: 36, borderRadius: 6, background: v === 0 ? C.surfaceAlt : C.purple,
          opacity: v === 0 ? 1 : 0.20 + (v / max) * 0.80,
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

function useImpressionStats(days = 7) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasReal, setHasReal] = useState(false);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    supabase
      .from('impression_events')
      .select('window_start, people_count, avg_dwell_seconds, avg_attention_score, age_18_24, age_25_34, age_35_44, age_45_54, age_55_plus, gender_male, gender_female, gender_unknown')
      .gte('window_start', since.toISOString())
      .order('window_start', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRows(data);
          setHasReal(true);
        }
        setLoading(false);
      });
  }, [days]);

  const stats = useMemo(() => {
    if (!hasReal) return null;

    const hourly = Array(24).fill(0);
    const daily  = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    let totalPeople = 0, totalDwell = 0, totalAttn = 0;
    let ageCounts   = { age_18_24: 0, age_25_34: 0, age_35_44: 0, age_45_54: 0, age_55_plus: 0 };
    let genderCounts = { male: 0, female: 0, unknown: 0 };

    for (const r of rows) {
      const d = new Date(r.window_start);
      hourly[d.getHours()] += r.people_count;
      daily[DAY_NAMES[d.getDay()]] += r.people_count;
      totalPeople += r.people_count;
      totalDwell  += r.avg_dwell_seconds * r.people_count;
      totalAttn   += r.avg_attention_score * r.people_count;
      ageCounts.age_18_24   += r.age_18_24;
      ageCounts.age_25_34   += r.age_25_34;
      ageCounts.age_35_44   += r.age_35_44;
      ageCounts.age_45_54   += r.age_45_54;
      ageCounts.age_55_plus += r.age_55_plus;
      genderCounts.male     += r.gender_male;
      genderCounts.female   += r.gender_female;
      genderCounts.unknown  += r.gender_unknown;
    }

    const gTotal = genderCounts.male + genderCounts.female + genderCounts.unknown || 1;
    const aTotal = Object.values(ageCounts).reduce((a, b) => a + b, 0) || 1;

    return {
      hourly, daily, totalPeople,
      avgDwell:   totalPeople > 0 ? (totalDwell / totalPeople).toFixed(1) : '0',
      avgAttn:    totalPeople > 0 ? Math.round((totalAttn / totalPeople) * 100) : 0,
      femalePct:  Math.round((genderCounts.female / gTotal) * 100),
      malePct:    Math.round((genderCounts.male / gTotal) * 100),
      ageData: [
        ['18–24', Math.round((ageCounts.age_18_24 / aTotal) * 100)],
        ['25–34', Math.round((ageCounts.age_25_34 / aTotal) * 100)],
        ['35–44', Math.round((ageCounts.age_35_44 / aTotal) * 100)],
        ['45–54', Math.round((ageCounts.age_45_54 / aTotal) * 100)],
        ['55+',   Math.round((ageCounts.age_55_plus / aTotal) * 100)],
      ],
    };
  }, [rows, hasReal]);

  return { stats, loading, hasReal };
}

export function Analytics({ campaigns }) {
  const [filters, setFilters] = useState({ gender: '', age: '' });
  const [period, setPeriod] = useState(7);
  const { isMobile } = useBreakpoint();
  const { stats, loading, hasReal } = useImpressionStats(period);

  const totalImpr  = campaigns.reduce((a, c) => a + (c.impressions || 0), 0);
  const totalScans = campaigns.reduce((a, c) => a + (c.scans || 0), 0);
  const totalSpend = campaigns.filter(c => c.status === 'active').reduce((a, c) => a + c.budget, 0);
  const avgCPM     = totalImpr > 0 ? ((totalSpend / totalImpr) * 1000).toFixed(2) : '4.20';
  const scanRate   = totalImpr > 0 ? ((totalScans / totalImpr) * 100).toFixed(2) : '0.00';

  const byCity = [...new Set(campaigns.map(c => c.city))].map(city => {
    const cc = campaigns.filter(c => c.city === city);
    return { city, impr: cc.reduce((a, c) => a + (c.impressions || 0), 0), scans: cc.reduce((a, c) => a + (c.scans || 0), 0), spend: cc.reduce((a, c) => a + c.budget, 0) };
  });
  const maxImpr = Math.max(...byCity.map(c => c.impr), 1);

  const hourlyData  = stats?.hourly   ?? EMPTY_HOURLY;
  const dailyData   = stats?.daily    ?? EMPTY_DAY;
  const femalePct   = stats?.femalePct ?? 0;
  const malePct     = stats?.malePct   ?? 0;
  const ageData     = stats?.ageData   ?? [['18–24', 0], ['25–34', 0], ['35–44', 0], ['45–54', 0], ['55+', 0]];
  const totalPeople = stats?.totalPeople ?? 0;
  const avgDwell    = stats?.avgDwell ?? '—';
  const avgAttn     = stats?.avgAttn ?? '—';

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <Skeleton height={220} radius={12} style={{ marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Skeleton height={160} radius={12} />
          <Skeleton height={160} radius={12} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Analytics"
        subtitle={hasReal ? `Real impression data · ${period}-day window` : 'Impression tracking, scan rates, demographics, and campaign performance'}
        actions={
          <div style={{ display: 'flex', gap: 4 }}>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setPeriod(d)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${period === d ? C.purple : C.border}`,
                background: period === d ? C.purpleSoft : C.surface,
                color: period === d ? C.purple : C.textSub, fontFamily: F.sans, fontWeight: 500,
              }}>{d}d</button>
            ))}
          </div>
        }
      />

      {!hasReal && !loading && (
        <div style={{
          padding: '12px 16px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`,
          borderRadius: 8, marginBottom: 20, fontSize: 13, color: C.amber, fontFamily: F.sans,
        }}>
          No impression data yet — connect a Screen Agent to start tracking verified impressions. Showing estimated data below.
        </div>
      )}

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, marginBottom: 24,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans }}>Filter by:</span>
        <select value={filters.gender} onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}
          style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}>
          <option value="">All Genders</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
        <select value={filters.age} onChange={e => setFilters(f => ({ ...f, age: e.target.value }))}
          style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}>
          <option value="">All Ages</option>
          <option value="18-24">18–24</option>
          <option value="25-34">25–34</option>
          <option value="35-44">35–44</option>
          <option value="45-54">45–54</option>
          <option value="55+">55+</option>
        </select>
        <button onClick={() => setFilters({ gender: '', age: '' })}
          style={{ padding: '6px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.textSub, cursor: 'pointer' }}>
          Reset
        </button>
        {hasReal && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.green, fontFamily: F.sans, fontWeight: 600 }}>
            ✓ Verified impressions
          </span>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Impressions" value={hasReal ? totalPeople.toLocaleString() : `${(totalImpr / 1000).toFixed(1)}K`} sub={hasReal ? 'verified by CV' : 'estimated'} trend={8} icon="👁" />
        <KPI label="Avg Dwell Time"    value={hasReal ? `${avgDwell}s` : `${avgCPM}£ CPM`} sub={hasReal ? 'seconds on screen' : 'cost per 1,000'} color={C.blue} icon={hasReal ? '⏱' : '💲'} />
        <KPI label="QR Scans"          value={totalScans} sub="total scans" color={C.green} icon="📲" />
        <KPI label={hasReal ? 'Avg Attention' : 'Scan Rate'} value={hasReal ? `${avgAttn}%` : `${scanRate}%`} sub={hasReal ? 'frontal attention score' : 'scans / impressions'} icon="📊" />
      </div>

      {/* Heatmap + Day bars */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>
            {hasReal ? 'People by Hour' : 'Scans by Hour'}
            {!hasReal && <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400, marginLeft: 6 }}>(estimated)</span>}
          </div>
          <HeatmapGrid data={hourlyData} />
          <div style={{ marginTop: 10, fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>Hover a block to see count · Darker = more activity</div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>
            {hasReal ? 'People by Day of Week' : 'Scans by Day of Week'}
            {!hasReal && <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400, marginLeft: 6 }}>(estimated)</span>}
          </div>
          <DayBars data={dailyData} />
        </Card>
      </div>

      {/* Demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Gender Split</div>
          {!hasReal && <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, marginBottom: 12 }}>estimated</div>}
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
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Age Distribution</div>
          {!hasReal && <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, marginBottom: 8 }}>estimated</div>}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80, marginBottom: 8 }}>
            {ageData.map(([label, pct]) => {
              const maxPct = Math.max(...ageData.map(d => d[1]), 1);
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 9, fontFamily: F.mono, color: C.textMuted }}>{pct}%</div>
                  <div style={{ width: '100%', height: `${(pct / maxPct) * 60}px`, background: C.purple, opacity: 0.7, borderRadius: '2px 2px 0 0', minHeight: 3 }} />
                  <div style={{ fontSize: 9, fontFamily: F.sans, color: C.textMuted, whiteSpace: 'nowrap' }}>{label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Campaign Performance</div>
          {campaigns.slice(0, 5).map(c => (
            <div key={c.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: C.textMid, fontFamily: F.sans, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.advertiser}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.purple, fontFamily: F.mono }}>{c.scans} scans</span>
              </div>
              <ProgressBar value={c.scans || 0} max={Math.max(...campaigns.map(x => x.scans || 0), 1)} height={4} />
            </div>
          ))}
        </Card>
      </div>

      {/* Impressions by city + 24h pattern */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Impressions by City</div>
          {byCity.length > 0 ? byCity.map(({ city, impr, scans }) => (
            <div key={city} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{city}</span>
                <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{(impr / 1000).toFixed(0)}K impr · {scans} scans</span>
              </div>
              <ProgressBar value={impr} max={maxImpr} height={5} />
            </div>
          )) : <div style={{ fontSize: 13, color: C.textMuted, fontFamily: F.sans }}>No campaign data</div>}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>
            24h Activity Pattern
            {!hasReal && <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400, marginLeft: 6 }}>(estimated)</span>}
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 80, marginBottom: 8 }}>
            {hourlyData.map((v, h) => {
              const maxH = Math.max(...hourlyData, 1);
              return (
                <div key={h} title={`${String(h).padStart(2, '0')}:00`} style={{
                  flex: 1, borderRadius: '2px 2px 0 0',
                  background: h === new Date().getHours() ? C.purple : C.purpleSoft,
                  height: `${Math.max(3, (v / maxH) * 80)}px`,
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
          { key: 'spent',      label: 'Spend', render: v => <span style={{ fontFamily: F.sans }}>£{(v || 0).toLocaleString()}</span> },
          { key: 'status',     label: 'Status', render: v => <Badge status={v} /> },
        ]}
        rows={campaigns}
        emptyTitle="No campaign data"
        emptyDescription="Campaigns will appear here once active"
      />
    </div>
  );
}
