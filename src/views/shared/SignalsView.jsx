import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { SCREENS } from '../../lib/data.js';

const BOOSTS = { 'Food & Beverage': { morning: 2, cold: 1, highFoot: 2 }, 'Health & Fitness': { morning: 3, weekend: 2, sunny: 2 }, 'Fashion & Retail': { weekend: 2, highFoot: 3, sunny: 1 }, 'Finance & Banking': { morning: 3, weekday: 2 }, Entertainment: { evening: 3, weekend: 3 }, Technology: { morning: 1, weekday: 2 } };

export function SignalsView({ campaigns }) {
  const now = new Date();
  const [hour, setHour]     = useState(now.getHours());
  const [day, setDay]       = useState(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()]);
  const [weather, setWeather] = useState('Sunny');
  const [screen, setScreen] = useState(SCREENS[0].id);
  const [liveMode, setLive] = useState(true);
  const [simming, setSimming] = useState(false);

  const foot = (() => {
    const wknd = day === 'Sat' || day === 'Sun';
    const peaks = wknd ? { 10: 70, 11: 82, 12: 90, 13: 88, 14: 84 } : { 7: 78, 8: 92, 9: 80, 12: 84, 13: 82, 17: 86, 18: 90, 19: 72 };
    const pct = peaks[hour] ?? Math.max(8, 45 - Math.abs(hour - 13) * 4);
    return { pct, label: pct >= 80 ? 'Very High' : pct >= 62 ? 'High' : pct >= 42 ? 'Medium' : pct >= 22 ? 'Low' : 'Very Low' };
  })();

  const activeOnScreen = campaigns.filter(c => c.screenId === screen && ['active', 'scheduled'].includes(c.status));
  const ranked = activeOnScreen.map(c => {
    let score = 50; const b = BOOSTS[c.category] || {};
    if (hour >= 6 && hour < 11 && b.morning) score += b.morning * 10;
    if (hour >= 17 && hour < 22 && b.evening) score += 20;
    if ((day === 'Sat' || day === 'Sun') && b.weekend) score += b.weekend * 10;
    if (foot.pct >= 62 && b.highFoot) score += b.highFoot * 10;
    if (weather === 'Sunny' && b.sunny) score += 10;
    if ((weather === 'Cold' || weather === 'Rainy') && b.cold) score += 10;
    if (day !== 'Sat' && day !== 'Sun' && b.weekday) score += b.weekday * 10;
    return { ...c, score: Math.min(score, 100) };
  }).sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  const scoreColor = s => s >= 75 ? C.green : s >= 50 ? C.amber : C.textSub;
  const timeLabel = h => h < 6 ? 'Late Night' : h < 11 ? 'Morning' : h < 14 ? 'Midday' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';

  const runSim = () => {
    setLive(false); setSimming(true); let i = 0;
    const hrs = [6, 8, 10, 12, 14, 17, 19, 21];
    const id = setInterval(() => { if (i >= hrs.length) { clearInterval(id); setSimming(false); return; } setHour(hrs[i]); i++; }, 700);
  };

  return (
    <div>
      <PageHeader title="Live Signals" subtitle="Real-time context engine — weather, footfall, and ad ranking" />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Context Signals</div>
            <SelInput label="Screen" value={screen} onChange={e => setScreen(e.target.value)} style={{ marginBottom: 12 }}>
              {SCREENS.filter(s => s.status === 'live').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelInput>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans }}>Time of Day</label>
                <span style={{ fontSize: 12, color: C.purple, fontFamily: F.sans, fontWeight: 500 }}>{String(hour).padStart(2, '0')}:00 · {timeLabel(hour)}</span>
              </div>
              <input type="range" min={0} max={23} value={hour} onChange={e => { setLive(false); setHour(parseInt(e.target.value)); }} style={{ width: '100%', accentColor: C.purple }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, display: 'block', marginBottom: 6 }}>Day of Week</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <button key={d} onClick={() => { setLive(false); setDay(d); }} style={{
                    padding: '5px 9px', borderRadius: 6,
                    border: `1px solid ${day === d ? C.purple : C.border}`,
                    background: day === d ? C.purpleSoft : C.surface,
                    color: day === d ? C.purple : C.textSub,
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: F.sans,
                  }}>{d}</button>
                ))}
              </div>
            </div>
            <SelInput label="Weather" value={weather} onChange={e => setWeather(e.target.value)}>
              {['Sunny', 'Cloudy', 'Rainy', 'Cold', 'Hot', 'Windy'].map(w => <option key={w}>{w}</option>)}
            </SelInput>
          </Card>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant={liveMode ? 'success' : 'secondary'} size="sm" onClick={() => setLive(!liveMode)} style={{ flex: 1, justifyContent: 'center' }}>
              {liveMode ? '● Live' : '○ Manual'}
            </Btn>
            <Btn size="sm" onClick={runSim} disabled={simming} style={{ flex: 1, justifyContent: 'center' }}>
              {simming ? 'Simulating…' : '▶ Simulate Day'}
            </Btn>
          </div>
        </div>

        <div>
          {winner && (
            <div style={{ background: 'linear-gradient(135deg, #f5f3ff, #ecfdf5)', border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, letterSpacing: '0.5px', marginBottom: 4, fontFamily: F.sans }}>NOW PLAYING — HIGHEST SIGNAL MATCH</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{winner.advertiser}</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>{winner.category} · {winner.screen}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: scoreColor(winner.score), fontFamily: F.mono, lineHeight: 1 }}>{winner.score}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 4 }}>Signal match score</div>
                  <ProgressBar value={winner.score} max={100} height={8} color={scoreColor(winner.score)} />
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>All Campaigns — Ranked by Signal Match</div>
          {ranked.length === 0 && <Card style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontFamily: F.sans }}>No active campaigns on this screen</Card>}
          {ranked.map((c, i) => (
            <Card key={c.id} style={{ marginBottom: 10, padding: '14px 18px', border: i === 0 ? `1px solid ${C.purpleBorder}` : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? C.purple : C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#fff' : C.textSub, fontFamily: F.sans }}>#{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.advertiser}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.category} · {c.timeStart}–{c.timeEnd}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(c.score), fontFamily: F.mono, lineHeight: 1 }}>{c.score}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>/100</div>
                </div>
              </div>
              <ProgressBar value={c.score} max={100} height={4} color={scoreColor(c.score)} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
