import { useState, useEffect } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { supabase } from '../../lib/supabase.js';
import { fetchScreenDemographics } from '../../lib/marketplace.js';
import { useT } from '../../i18n/useT.js';

function summarizeTraffic(events) {
  const byDay = {};
  for (const e of events) {
    const day = e.created_at?.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const days = Object.keys(byDay);
  const avgDaily = days.length ? Math.round(events.length / days.length) : 0;
  return { avgDaily, sampleDays: days.length };
}

const INCOME_BANDS = ['under_40k', '40k_75k', '75k_120k', '120k_plus'];

export function ScreenAnalyticsPanel({ screenId }) {
  const { t } = useT();
  const [traffic, setTraffic] = useState(null);
  const [trafficError, setTrafficError] = useState(false);
  const [demo, setDemo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setTrafficError(false);
    supabase.from('impression_events').select('created_at').eq('screen_id', screenId)
      .then(({ data, error }) => {
        if (cancelled) return;
        // Don't let a failed query masquerade as "0 scans/day" -- that reads
        // as real, verified traffic data to the advertiser.
        if (error) { setTrafficError(true); return; }
        setTraffic(summarizeTraffic(data ?? []));
      });
    fetchScreenDemographics(screenId).then(d => { if (!cancelled) setDemo(d); });
    return () => { cancelled = true; };
  }, [screenId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card data-testid="traffic-section" style={{ padding: 16 }}>
        <div style={{ ...TX.strong, marginBottom: 8 }}>
          {t('widgets.analytics.traffic')}
        </div>
        {trafficError ? (
          <div style={TX.bodyMuted}>{t('widgets.analytics.trafficError')}</div>
        ) : traffic ? (
          <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.textMid }}>
            {t('widgets.analytics.trafficBody', { avg: traffic.avgDaily, days: traffic.sampleDays })}
          </div>
        ) : (
          <div style={TX.bodyMuted}>{t('common.loading')}</div>
        )}
      </Card>

      <div
        data-testid="demographic-section"
        style={{ background: C.surfaceAlt, border: `1px dashed ${C.borderDark}`, borderRadius: 12, padding: 16 }}
      >
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: T.base, color: C.textMid, marginBottom: 8 }}>
          {t('widgets.analytics.area')}
        </div>
        {demo === null ? (
          <div style={TX.bodyMuted}>{t('common.loading')}</div>
        ) : demo.available ? (
          <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.textMid }}>
            {t('widgets.analytics.demo', { age: demo.medianAge ?? '—', income: INCOME_BANDS.includes(demo.incomeBand) ? t(`widgets.analytics.income.${demo.incomeBand}`) : '—' })}
            <div style={{ fontSize: T.xs, color: C.textMuted, marginTop: 4 }}>
              {t('widgets.analytics.census')}
            </div>
          </div>
        ) : (
          <div style={TX.bodyMuted}>
            {t('widgets.analytics.noDemo')}
          </div>
        )}
      </div>
    </div>
  );
}
