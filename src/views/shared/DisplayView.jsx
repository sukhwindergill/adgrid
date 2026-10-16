import { useState } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { useOperatorScreenCampaignRows } from '../../hooks/useOperatorScreenCampaignRows.js';
import { IconChart, IconClock, IconScreen } from '../../components/icons.jsx';

const HOUR_LABELS = ['12a','1','2','3','4','5','6','7','8','9','10','11','12p','1','2','3','4','5','6','7','8','9','10','11'];

function parseHour(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

function timeLabel(t) {
  if (!t) return '';
  const [h] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}${ampm}`;
}

function NowPlayingCard({ campaign }) {
  if (!campaign) return (
    <div style={{ ...TX.bodyMuted, padding: '20px 0', textAlign: 'center' }}>
      No active campaigns right now
    </div>
  );
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ height: 4, background: campaign.color || C.purple }} />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ ...TX.caption, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Now Playing</div>
        <div style={{ ...TX.heading, marginBottom: 2 }}>{campaign.headline || campaign.advertiser || campaign.advertiser_name || ''}</div>
        {/* When there's no headline, the title above already shows the advertiser name --
            repeating it here would read as "Nike / Nike · Fashion", so drop it from the subtitle. */}
        <div style={{ ...TX.helper, marginBottom: 10 }}>{campaign.headline ? `${campaign.advertiser} · ${campaign.category}` : campaign.category}</div>
        <div style={{ ...TX.caption, display: 'flex', gap: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconClock size={14} /> {timeLabel(campaign.timeStart)} – {timeLabel(campaign.timeEnd)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconClock size={14} /> {campaign.duration}s slots</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconChart size={14} /> {campaign.slots}% share</span>
        </div>
      </div>
    </div>
  );
}

function TimelineBar({ campaigns }) {
  const now = new Date();
  const nowPct = ((now.getHours() + now.getMinutes() / 60) / 24) * 100;
  return (
    <div>
      <div style={{ fontSize: T.sm, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 10 }}>Today's Schedule</div>
      <div style={{ position: 'relative', height: 40, background: C.surfaceAlt, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
        {campaigns.map(c => {
          const start = parseHour(c.timeStart);
          const end   = parseHour(c.timeEnd);
          const left  = (start / 24) * 100;
          const width = Math.max(1, ((end - start) / 24) * 100);
          return (
            <div
              key={c.id}
              title={`${c.advertiser}: ${c.timeStart}–${c.timeEnd}`}
              style={{
                position: 'absolute', top: 6, bottom: 6,
                left: `${left}%`, width: `${width}%`,
                background: c.color || C.purple,
                borderRadius: 4, opacity: 0.85,
                minWidth: 4,
              }}
            />
          );
        })}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${nowPct}%`, width: 2, background: C.red, opacity: 0.8 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.xs, color: C.textMuted, fontFamily: F.mono }}>
        {HOUR_LABELS.filter((_, i) => i % 6 === 0).map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

// Used to filter on `c.screenId`, a field no real booking row has (which
// screens a campaign runs on lives in the campaign_screens junction table)
// -- always rendered "No screens with campaigns" against live data.
// useOperatorScreenCampaignRows flattens that junction into real
// per-screen rows, each carrying a real screenId/screenName/city.
export function DisplayView({ operatorScreenIds = [], screens: operatorScreens = [] }) {
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;

  const { rows: campaigns } = useOperatorScreenCampaignRows(operatorScreenIds, operatorScreens);

  const screenMap = {};
  campaigns.forEach(c => {
    if (!screenMap[c.screenId]) {
      screenMap[c.screenId] = {
        id: c.screenId,
        name: c.screenName,
        city: c.city,
        campaigns: [],
      };
    }
    screenMap[c.screenId].campaigns.push(c);
  });
  const screens = Object.values(screenMap);

  const [selectedId, setSelectedId] = useState(screens[0]?.id || null);
  const selected = screenMap[selectedId];

  const activeCampaigns = selected?.campaigns.filter(c =>
    ['active', 'scheduled'].includes(c.status)
  ) || [];

  const nowPlaying = selected?.campaigns.find(c => {
    if (c.status !== 'active') return false;
    return nowH >= parseHour(c.timeStart) && nowH < parseHour(c.timeEnd);
  }) || null;

  const queued = selected?.campaigns
    .filter(c => c.status === 'scheduled' || (c.status === 'active' && c !== nowPlaying))
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 6) || [];

  return (
    <div>
      <PageHeader
        title="Display Manager"
        subtitle={`${screens.length} screen${screens.length !== 1 ? 's' : ''} · ${campaigns.filter(c => c.status === 'active').length} campaigns live`}
      />

      {screens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.textMuted, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconScreen size={36} /></div>
          <div style={{ ...TX.titleLg, marginBottom: 6 }}>No screens with campaigns</div>
          <div style={TX.bodySub}>Create campaigns to see them here</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Screen list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...TX.caption, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Screens</div>
            {screens.map(s => {
              const isSelected = s.id === selectedId;
              const liveCount  = s.campaigns.filter(c => c.status === 'active').length;
              const nowLive    = s.campaigns.find(c =>
                c.status === 'active' && nowH >= parseHour(c.timeStart) && nowH < parseHour(c.timeEnd)
              );
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${isSelected ? C.purple : C.border}`,
                    background: isSelected ? C.purpleSoft : C.surface,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.surfaceAlt; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = C.surface; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ fontSize: T.base, fontWeight: 600, color: isSelected ? C.purple : C.text, fontFamily: F.sans }}>{s.name}</div>
                    {liveCount > 0 && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, flexShrink: 0 }} />}
                  </div>
                  <div style={{ ...TX.caption, marginBottom: nowLive ? 6 : 0 }}>{s.city}</div>
                  {nowLive ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: nowLive.color || C.purple, flexShrink: 0 }} />
                      <span style={{ fontSize: T.xs, color: C.textSub, fontFamily: F.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowLive.advertiser}</span>
                    </div>
                  ) : (
                    <div style={TX.caption}>{s.campaigns.length} campaign{s.campaigns.length !== 1 ? 's' : ''}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Content panel */}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={TX.heading}>{selected.name}</div>
                    <div style={{ ...TX.helper, marginTop: 2 }}>{selected.city}</div>
                  </div>
                  <Badge status={nowPlaying ? 'active' : 'scheduled'} />
                </div>
                <TimelineBar campaigns={activeCampaigns} />
              </Card>

              <Card style={{ padding: '16px 20px' }}>
                <NowPlayingCard campaign={nowPlaying} />
              </Card>

              <Card style={{ padding: '16px 20px' }}>
                <div style={{ ...TX.strong, marginBottom: 12 }}>
                  Queued ({queued.length})
                </div>
                {queued.length === 0 ? (
                  <div style={{ ...TX.helperMuted, padding: '12px 0' }}>No queued campaigns</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {queued.map((c, i) => (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 0',
                        borderBottom: i < queued.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: c.color || C.purple, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...TX.body, fontWeight: 500 }}>{c.advertiser}</div>
                          <div style={TX.caption}>
                            {timeLabel(c.timeStart)}–{timeLabel(c.timeEnd)} · {c.duration}s · {c.slots}% share
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <Badge status={c.status} />
                          <div style={{ fontSize: T.xs, color: C.textMuted, fontFamily: F.mono, marginTop: 3 }}>{c.start}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
