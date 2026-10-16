import { useState, useEffect } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { supabase } from '../../lib/supabase.js';
import { fetchScreenDemographics } from '../../lib/marketplace.js';

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

const INCOME_LABELS = {
  under_40k: 'Under $40k', '40k_75k': '$40k–$75k', '75k_120k': '$75k–$120k', '120k_plus': '$120k+',
};

export function ScreenAnalyticsPanel({ screenId }) {
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
      <div
        data-testid="traffic-section"
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}
      >
        <div style={{ ...TX.strong, marginBottom: 8 }}>
          Traffic — platform-verified
        </div>
        {trafficError ? (
          <div style={TX.bodyMuted}>Traffic data unavailable right now.</div>
        ) : traffic ? (
          <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.textMid }}>
            ~{traffic.avgDaily} scans/day average, based on {traffic.sampleDays} days of measured data
          </div>
        ) : (
          <div style={TX.bodyMuted}>Loading…</div>
        )}
      </div>

      <div
        data-testid="demographic-section"
        style={{ background: C.surfaceAlt, border: `1px dashed ${C.borderDark}`, borderRadius: 12, padding: 16 }}
      >
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: T.base, color: C.textMid, marginBottom: 8 }}>
          Area estimate — not board-verified
        </div>
        {demo === null ? (
          <div style={TX.bodyMuted}>Loading…</div>
        ) : demo.available ? (
          <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.textMid }}>
            Median age ~{demo.medianAge ?? '—'}, household income {INCOME_LABELS[demo.incomeBand] ?? '—'}
            <div style={{ fontSize: T.xs, color: C.textMuted, marginTop: 4 }}>
              Based on public census data for this area, not measured foot traffic.
            </div>
          </div>
        ) : (
          <div style={TX.bodyMuted}>
            Demographic data not available for this location.
          </div>
        )}
      </div>
    </div>
  );
}
