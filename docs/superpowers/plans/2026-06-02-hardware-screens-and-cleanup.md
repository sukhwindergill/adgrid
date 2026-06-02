# Hardware Screens, CV Insights, Advertiser Mobile & Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add screen health badges, ScreenDetail tabs (Overview/CV Insights/Setup Guide), fix SecurityTab split-msg bug, make all advertiser views mobile-responsive, and verify Vercel deploy.

**Architecture:** All changes are self-contained UI additions to existing files. No new routes, no DB migrations. CV Insights queries `impression_events` in ScreenDetail on tab mount. Health signal is a pure function over `last_seen`/`health_status` fields already fetched. Advertiser mobile fixes use the existing `useBreakpoint` hook.

**Tech Stack:** React (hooks), Supabase JS client, inline styles, design tokens (`C`, `F`) from `src/lib/constants.js`, `useBreakpoint` from `src/lib/useBreakpoint.js`

---

## File Map

| File | Changes |
|---|---|
| `src/views/operator/Screens.jsx` | Add `healthSignal()` helper, update `ScreenCard` to show health dot, add connection-check button to `AddScreenModal` success screen |
| `src/views/operator/ScreenDetail.jsx` | Add `tab` state + tab bar, extract current content into Overview section, add CV Insights tab, add Setup Guide tab |
| `src/views/operator/OperatorSettingsView.jsx` | Split `msg` → `emailMsg` + `pwMsg` in `SecurityTab` |
| `src/views/advertiser/AdvDashboard.jsx` | Fix KPI grid columns for mobile |
| `src/views/advertiser/CreateCampaign.jsx` | Add `useBreakpoint`, fix 2-col step layouts for mobile |
| `src/views/advertiser/BillingView.jsx` | Add `useBreakpoint`, fix outer padding + invoice table overflow on mobile |
| `src/views/advertiser/ScansView.jsx` | Add `useBreakpoint`, fix outer padding on mobile |

---

## Task 1: Screen Health Signal — `Screens.jsx`

**Files:**
- Modify: `src/views/operator/Screens.jsx`

### What `healthSignal` returns

```js
// returns { dot: string (CSS color), label: string, pulse: boolean }
function healthSignal(screen) {
  const C_GREEN  = '#16a34a';
  const C_AMBER  = '#d97706';
  const C_RED    = '#dc2626';

  if (screen.health_status === 'degraded') {
    return { dot: C_AMBER, label: 'Degraded', pulse: false };
  }
  if (!screen.last_seen) {
    return { dot: C_RED, label: 'Offline', pulse: false };
  }
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5)  return { dot: C_GREEN, label: 'Live',   pulse: true  };
  if (minsAgo <= 60) return { dot: C_AMBER, label: 'Stale',  pulse: false };
  return               { dot: C_RED,   label: 'Offline', pulse: false };
}
```

- [ ] **Step 1: Add `healthSignal` helper above `ScreenCard`**

In `src/views/operator/Screens.jsx`, add the following just before the `function ScreenCard(` line:

```jsx
function healthSignal(screen) {
  if (screen.health_status === 'degraded') {
    return { dot: '#d97706', label: 'Degraded', pulse: false };
  }
  if (!screen.last_seen) {
    return { dot: '#dc2626', label: 'Offline', pulse: false };
  }
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5)  return { dot: C.green,  label: 'Live',    pulse: true  };
  if (minsAgo <= 60) return { dot: '#d97706', label: 'Stale',  pulse: false };
  return                    { dot: '#dc2626', label: 'Offline', pulse: false };
}
```

- [ ] **Step 2: Update `ScreenCard` to use `healthSignal`**

In `ScreenCard`, find the existing live-pulse span:
```jsx
{screen.status === 'live' && (
  <span className="pulse" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.green, marginTop: 4, flexShrink: 0 }} />
)}
```

Replace it with:
```jsx
{(() => {
  const hs = healthSignal(screen);
  return (
    <span
      className={hs.pulse ? 'pulse' : undefined}
      style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: hs.dot, marginTop: 4, flexShrink: 0 }}
    />
  );
})()}
```

Also add a health label beneath the screen name. Find the `<div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{screen.neighbourhood} · {screen.city}</div>` line and add after it:

```jsx
{(() => {
  const hs = healthSignal(screen);
  if (hs.label !== 'Live') {
    return (
      <div style={{ fontSize: 10, color: hs.dot, fontFamily: F.sans, fontWeight: 600, marginTop: 2 }}>
        {hs.label}
      </div>
    );
  }
  return null;
})()}
```

- [ ] **Step 3: Add "Check Connection" button to `AddScreenModal` success screen**

In the `registered` return block of `AddScreenModal`, after the `<Btn onClick={onClose}…>Done</Btn>` button, add a connection-check section. First add state at the top of `AddScreenModal`:

```jsx
const [connCheck, setConnCheck] = useState(null); // null | 'checking' | 'connected' | 'none'
```

Then replace the final `<Btn onClick={onClose}…>Done</Btn>` with:

```jsx
<div style={{ marginBottom: 16 }}>
  <Btn
    variant="secondary"
    style={{ width: '100%', marginBottom: 8 }}
    disabled={connCheck === 'checking'}
    onClick={async () => {
      setConnCheck('checking');
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('display_heartbeats')
        .select('id')
        .eq('screen_id', registered.id)
        .gte('created_at', since)
        .limit(1);
      setConnCheck(data && data.length > 0 ? 'connected' : 'none');
    }}
  >
    {connCheck === 'checking' ? 'Checking…' : 'Check Connection'}
  </Btn>
  {connCheck === 'connected' && (
    <div style={{ fontSize: 12, color: C.green, fontFamily: F.sans, textAlign: 'center' }}>✓ Heartbeat received — screen is online</div>
  )}
  {connCheck === 'none' && (
    <div style={{ fontSize: 12, color: '#d97706', fontFamily: F.sans, textAlign: 'center' }}>No heartbeat yet — complete setup below then retry</div>
  )}
</div>
<Btn onClick={onClose} style={{ width: '100%' }}>Done</Btn>
```

- [ ] **Step 4: Verify in browser**

Start dev server (`npm run dev`). Register a screen (or view an existing one). Confirm:
- ScreenCard shows coloured dot based on `last_seen` / `health_status`
- Non-live screens show amber/red label beneath location
- AddScreenModal success screen shows "Check Connection" button that queries and reports

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/Screens.jsx
git commit -m "feat: screen health signal badges and connection check in AddScreenModal"
```

---

## Task 2: ScreenDetail Tab Chrome

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

- [ ] **Step 1: Add tab state**

At the top of `ScreenDetailView`, after the existing `useState` declarations, add:

```jsx
const [tab, setTab] = useState('overview');
```

- [ ] **Step 2: Add tab bar after `PageHeader`**

After the `{showEdit && …}` block and `<PageHeader …/>` component (before the KPI row comment), add:

```jsx
{/* Tab bar */}
<div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
  {[
    { key: 'overview', label: 'Overview' },
    { key: 'cv',       label: 'CV Insights' },
    { key: 'setup',    label: 'Setup Guide' },
  ].map(t => (
    <button
      key={t.key}
      onClick={() => setTab(t.key)}
      style={{
        padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
        fontFamily: F.sans, fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
        color: tab === t.key ? C.purple : C.textSub,
        borderBottom: `2px solid ${tab === t.key ? C.purple : 'transparent'}`,
        marginBottom: -1, transition: 'all 0.15s',
      }}
    >{t.label}</button>
  ))}
</div>
```

- [ ] **Step 3: Wrap existing content in `{tab === 'overview' && (…)}`**

Wrap everything from the `{/* KPI row */}` comment to the closing `</div>` of the return in a conditional:

```jsx
{tab === 'overview' && (
  <>
    {/* KPI row */}
    … (all existing content) …
    {/* Campaign history Card */}
  </>
)}
```

- [ ] **Step 4: Commit this checkpoint**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat: add tab chrome to ScreenDetail (overview tab only)"
```

---

## Task 3: ScreenDetail — CV Insights Tab

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

- [ ] **Step 1: Add CV data state**

Add to `ScreenDetailView` state declarations:

```jsx
const [cvEvents, setCvEvents] = useState([]);
const [cvLoading, setCvLoading] = useState(false);
```

- [ ] **Step 2: Fetch CV data when tab switches to `cv`**

Add a `useEffect` after the heartbeats/campaigns effect:

```jsx
useEffect(() => {
  if (tab !== 'cv' || !screen) return;
  setCvLoading(true);
  const since = new Date();
  since.setDate(since.getDate() - 30);
  supabase
    .from('impression_events')
    .select('window_start, people_count, avg_dwell_seconds, avg_attention_score, age_18_24, age_25_34, age_35_44, age_45_54, age_55_plus, gender_male, gender_female, gender_unknown')
    .eq('screen_id', screen.id)
    .gte('window_start', since.toISOString())
    .order('window_start', { ascending: true })
    .then(({ data }) => {
      setCvEvents(data ?? []);
      setCvLoading(false);
    });
}, [tab, screen]);
```

- [ ] **Step 3: Add CV Insights tab content after the overview block**

Add after the `{tab === 'overview' && (…)}` block:

```jsx
{tab === 'cv' && (
  <div>
    {cvLoading ? (
      <div style={{ padding: '48px 0', textAlign: 'center', color: C.textMuted, fontFamily: F.sans, fontSize: 13 }}>Loading CV data…</div>
    ) : cvEvents.length === 0 ? (
      <div style={{ padding: '48px 24px', textAlign: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>📷</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>No CV data yet</div>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Requires screen-agent with USB camera. See Setup Guide tab.</div>
      </div>
    ) : (() => {
      const totalPeople  = cvEvents.reduce((a, e) => a + (e.people_count ?? 0), 0);
      const avgDwell     = cvEvents.length ? (cvEvents.reduce((a, e) => a + (e.avg_dwell_seconds ?? 0), 0) / cvEvents.length).toFixed(1) : '—';
      const avgAttention = cvEvents.length ? Math.round(cvEvents.reduce((a, e) => a + (e.avg_attention_score ?? 0), 0) / cvEvents.length * 100) : '—';

      // Age buckets
      const ageBuckets = [
        { label: '18–24', val: cvEvents.reduce((a, e) => a + (e.age_18_24 ?? 0), 0) },
        { label: '25–34', val: cvEvents.reduce((a, e) => a + (e.age_25_34 ?? 0), 0) },
        { label: '35–44', val: cvEvents.reduce((a, e) => a + (e.age_35_44 ?? 0), 0) },
        { label: '45–54', val: cvEvents.reduce((a, e) => a + (e.age_45_54 ?? 0), 0) },
        { label: '55+',   val: cvEvents.reduce((a, e) => a + (e.age_55_plus ?? 0), 0) },
      ];
      const maxAge = Math.max(...ageBuckets.map(b => b.val), 1);

      const genderBuckets = [
        { label: 'Male',    val: cvEvents.reduce((a, e) => a + (e.gender_male ?? 0), 0),    color: C.blue },
        { label: 'Female',  val: cvEvents.reduce((a, e) => a + (e.gender_female ?? 0), 0),  color: C.purple },
        { label: 'Unknown', val: cvEvents.reduce((a, e) => a + (e.gender_unknown ?? 0), 0), color: C.border },
      ];
      const maxGender = Math.max(...genderBuckets.map(b => b.val), 1);

      // 7-day sparkline
      const days7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        const count = cvEvents.filter(e => e.window_start?.slice(0, 10) === key).reduce((a, e) => a + (e.people_count ?? 0), 0);
        return { key, count };
      });
      const maxDay = Math.max(...days7.map(d => d.count), 1);

      return (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            <KPI label="People Seen (30d)" value={totalPeople.toLocaleString()} color={C.purple} />
            <KPI label="Avg Dwell" value={`${avgDwell}s`} sub="per impression event" />
            <KPI label="Avg Attention" value={`${avgAttention}%`} color={avgAttention > 60 ? C.green : C.amber} />
          </div>

          {/* Age breakdown */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Age Breakdown</div>
            {ageBuckets.map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 44, fontSize: 12, color: C.textSub, fontFamily: F.sans, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 4, height: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${(b.val / maxAge) * 100}%`, height: '100%', background: C.purple, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: 40, fontSize: 12, color: C.text, fontFamily: F.mono, textAlign: 'right', flexShrink: 0 }}>{b.val.toLocaleString()}</div>
              </div>
            ))}
          </Card>

          {/* Gender split */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Gender Split</div>
            {genderBuckets.map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 60, fontSize: 12, color: C.textSub, fontFamily: F.sans, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 4, height: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${(b.val / maxGender) * 100}%`, height: '100%', background: b.color, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: 40, fontSize: 12, color: C.text, fontFamily: F.mono, textAlign: 'right', flexShrink: 0 }}>{b.val.toLocaleString()}</div>
              </div>
            ))}
          </Card>

          {/* 7-day sparkline */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>7-Day People Trend</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
              {days7.map(d => (
                <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', borderRadius: 3,
                    height: `${Math.max(4, (d.count / maxDay) * 64)}px`,
                    background: d.count > 0 ? C.purple : C.border,
                    transition: 'height 0.2s',
                  }} title={`${d.key}: ${d.count}`} />
                  <div style={{ fontSize: 9, color: C.textMuted, fontFamily: F.sans }}>{d.key.slice(5)}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      );
    })()}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat: CV Insights tab in ScreenDetail with age/gender/dwell/sparkline"
```

---

## Task 4: ScreenDetail — Setup Guide Tab

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

- [ ] **Step 1: Add hardware selector state**

Add to `ScreenDetailView` state declarations:

```jsx
const [hwType, setHwType] = useState('kiosk');
const [connStatus, setConnStatus] = useState(null); // null | 'checking' | 'ok' | 'none'
```

- [ ] **Step 2: Add Setup Guide tab content**

After the `{tab === 'cv' && (…)}` block, add:

```jsx
{tab === 'setup' && screen && (
  <div>
    {/* Token section */}
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Screen Token</div>
      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 13, color: C.text, wordBreak: 'break-all', letterSpacing: '0.5px', marginBottom: 8 }}>
        {screen.screen_token}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => navigator.clipboard.writeText(screen.screen_token)}
          style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 12, fontFamily: F.sans, cursor: 'pointer' }}
        >
          Copy Token
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/display/${screen.screen_token}`)}
          style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 12, fontFamily: F.sans, cursor: 'pointer' }}
        >
          Copy Player URL
        </button>
      </div>
    </Card>

    {/* Hardware selector */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
      {[
        { key: 'kiosk',  label: 'Browser Kiosk' },
        { key: 'rpi',    label: 'Raspberry Pi 5' },
        { key: 'minipc', label: 'Mini PC' },
        { key: 'atv',    label: 'Android TV' },
      ].map(h => (
        <button key={h.key} onClick={() => setHwType(h.key)} style={{
          padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
          border: `1px solid ${hwType === h.key ? C.purple : C.border}`,
          background: hwType === h.key ? C.purpleSoft : C.surface,
          color: hwType === h.key ? C.purple : C.textSub,
          fontSize: 12, fontWeight: 500, fontFamily: F.sans,
        }}>{h.label}</button>
      ))}
    </div>

    {hwType === 'kiosk' && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Browser Kiosk Setup</div>
        <ol style={{ paddingLeft: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 2 }}>
          <li>Open a Chromium-based browser on your display device.</li>
          <li>Navigate to the player URL below.</li>
          <li>Press <strong>F11</strong> (or Cmd+Ctrl+F on Mac) to enter fullscreen.</li>
          <li>Enable auto-start in browser settings to launch on boot.</li>
        </ol>
        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 11, color: C.purple, wordBreak: 'break-all', marginTop: 12 }}>
          {`${window.location.origin}/display/${screen.screen_token}`}
        </div>
      </Card>
    )}

    {(hwType === 'rpi' || hwType === 'minipc') && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
          {hwType === 'rpi' ? 'Raspberry Pi 5' : 'Mini PC'} — Screen Agent Setup
        </div>
        <ol style={{ paddingLeft: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 2 }}>
          <li>Connect a USB camera to <strong>/dev/video0</strong>.</li>
          <li>Install Docker: <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: 12 }}>curl -fsSL https://get.docker.com | sh</code></li>
          <li>Create <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: 12 }}>docker-compose.yml</code> with the snippet below.</li>
          <li>Run: <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: 12 }}>docker-compose up -d</code></li>
        </ol>
        <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px 14px', fontFamily: F.mono, fontSize: 11, color: '#a3e635', whiteSpace: 'pre', overflowX: 'auto', marginTop: 12 }}>
{`version: "3"
services:
  display:
    image: adgrid/screen-agent:latest
    environment:
      SCREEN_TOKEN: "${screen.screen_token}"
      SUPABASE_URL: "${import.meta.env.VITE_SUPABASE_URL}"
      SUPABASE_ANON_KEY: "${import.meta.env.VITE_SUPABASE_ANON_KEY}"
    devices:
      - /dev/video0:/dev/video0
    restart: unless-stopped`}
        </div>
      </Card>
    )}

    {hwType === 'atv' && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Android TV Setup</div>
        <ol style={{ paddingLeft: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 2 }}>
          <li>Enable <strong>Developer Options</strong> on your Android TV device (Settings → About → click Build Number 7×).</li>
          <li>Enable <strong>Install unknown apps</strong> in Developer Options.</li>
          <li>Download the Adgrid APK to a USB drive or sideload via ADB.</li>
          <li>Install and launch. Enter your screen token when prompted.</li>
          <li>Token: <strong style={{ fontFamily: F.mono }}>{screen.screen_token}</strong></li>
        </ol>
        <div style={{ marginTop: 12, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder ?? '#fde68a'}`, borderRadius: 8, fontSize: 12, color: '#92400e', fontFamily: F.sans }}>
          Note: Android TV app is in beta. Contact support for the APK download link.
        </div>
      </Card>
    )}

    {/* Test connection */}
    <Card>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Test Connection</div>
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
        After completing setup, click below to verify your screen is sending heartbeats.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn
          variant="secondary"
          size="sm"
          disabled={connStatus === 'checking'}
          onClick={async () => {
            setConnStatus('checking');
            const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data } = await supabase
              .from('display_heartbeats')
              .select('id')
              .eq('screen_id', screen.id)
              .gte('created_at', since)
              .limit(1);
            setConnStatus(data && data.length > 0 ? 'ok' : 'none');
          }}
        >
          {connStatus === 'checking' ? 'Checking…' : 'Check Connection'}
        </Btn>
        {connStatus === 'ok' && (
          <span style={{ fontSize: 13, color: C.green, fontFamily: F.sans }}>✓ Connected — heartbeat received</span>
        )}
        {connStatus === 'none' && (
          <span style={{ fontSize: 13, color: '#d97706', fontFamily: F.sans }}>No heartbeat in last 5 minutes — check your setup</span>
        )}
      </div>
    </Card>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat: Setup Guide tab in ScreenDetail with hardware instructions and connection test"
```

---

## Task 5: SecurityTab Split Msg State

**Files:**
- Modify: `src/views/operator/OperatorSettingsView.jsx`

- [ ] **Step 1: Split the shared `msg` state into two**

Find in `SecurityTab`:
```js
const [msg, setMsg] = useState(null);
```
Replace with:
```js
const [emailMsg, setEmailMsg] = useState(null);
const [pwMsg,    setPwMsg]    = useState(null);
```

- [ ] **Step 2: Update `changeEmail` to use `emailMsg`**

Find:
```js
async function changeEmail() {
  if (!newEmail) return;
  setEmailSaving(true);
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  setEmailSaving(false);
  setMsg(error ? error.message : 'Confirmation email sent. Check your inbox.');
  if (!error) setNewEmail('');
  setTimeout(() => setMsg(null), 5000);
}
```
Replace with:
```js
async function changeEmail() {
  if (!newEmail) return;
  setEmailSaving(true);
  setEmailMsg(null);
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  setEmailSaving(false);
  setEmailMsg(error ? { text: error.message, ok: false } : { text: 'Confirmation email sent. Check your inbox.', ok: true });
  if (!error) setNewEmail('');
  setTimeout(() => setEmailMsg(null), 5000);
}
```

- [ ] **Step 3: Update `changePassword` to use `pwMsg`**

Find:
```js
async function changePassword() {
  if (newPw !== confirmPw) { setMsg('Passwords do not match.'); return; }
  if (newPw.length < 8) { setMsg('Password must be at least 8 characters.'); return; }
  setPwSaving(true);
  const { error } = await supabase.auth.updateUser({ password: newPw });
  setPwSaving(false);
  setMsg(error ? error.message : 'Password updated.');
  setNewPw(''); setConfirmPw('');
  setTimeout(() => setMsg(null), 4000);
}
```
Replace with:
```js
async function changePassword() {
  if (newPw !== confirmPw) { setPwMsg({ text: 'Passwords do not match.', ok: false }); return; }
  if (newPw.length < 8) { setPwMsg({ text: 'Password must be at least 8 characters.', ok: false }); return; }
  setPwSaving(true);
  setPwMsg(null);
  const { error } = await supabase.auth.updateUser({ password: newPw });
  setPwSaving(false);
  setPwMsg(error ? { text: error.message, ok: false } : { text: 'Password updated.', ok: true });
  setNewPw(''); setConfirmPw('');
  setTimeout(() => setPwMsg(null), 4000);
}
```

- [ ] **Step 4: Update JSX to render separate messages**

Find the email section's button and add `emailMsg` after it. Replace the existing button area for email:
```jsx
<div style={{ marginBottom: 32 }}>
  <SaveBtn onClick={changeEmail} saving={emailSaving} label="Update Email" />
</div>
```
With:
```jsx
<div style={{ marginBottom: 32 }}>
  <SaveBtn onClick={changeEmail} saving={emailSaving} label="Update Email" />
  {emailMsg && (
    <div style={{ fontSize: 13, color: emailMsg.ok ? C.green : C.red, fontFamily: F.sans, marginTop: 8 }}>
      {emailMsg.text}
    </div>
  )}
</div>
```

Find the existing shared-msg line in the password section:
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <SaveBtn onClick={changePassword} saving={pwSaving} label="Update Password" />
  {msg && <span style={{ fontSize: 13, color: msg.includes('updated') || msg.includes('sent') ? C.green : C.red }}>{msg}</span>}
</div>
```
Replace with:
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <SaveBtn onClick={changePassword} saving={pwSaving} label="Update Password" />
  {pwMsg && <span style={{ fontSize: 13, color: pwMsg.ok ? C.green : C.red }}>{pwMsg.text}</span>}
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/OperatorSettingsView.jsx
git commit -m "fix: split SecurityTab shared msg state into emailMsg and pwMsg"
```

---

## Task 6: Advertiser Mobile Fixes

**Files:**
- Modify: `src/views/advertiser/AdvDashboard.jsx`
- Modify: `src/views/advertiser/CreateCampaign.jsx`
- Modify: `src/views/advertiser/BillingView.jsx`
- Modify: `src/views/advertiser/ScansView.jsx`

### AdvDashboard

- [ ] **Step 1: Fix KPI grid columns**

`AdvDashboard.jsx` already imports `useBreakpoint`. Find:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
```
Replace with:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
```

### CreateCampaign

- [ ] **Step 2: Add `useBreakpoint` import to `CreateCampaign.jsx`**

Find in `CreateCampaign.jsx`:
```js
import { CATEGORIES, DAYS, HOURS } from '../../lib/data.js';
```
Replace with:
```js
import { CATEGORIES, DAYS, HOURS } from '../../lib/data.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
```

- [ ] **Step 3: Destructure `isMobile` inside `CreateCampaign`**

Find the opening line of `export function CreateCampaign(`:
```jsx
export function CreateCampaign({ onSave, onCancel, dbScreens = [] }) {
  const [step, setStep]     = useState(0);
```
Replace with:
```jsx
export function CreateCampaign({ onSave, onCancel, dbScreens = [] }) {
  const { isMobile } = useBreakpoint();
  const [step, setStep]     = useState(0);
```

- [ ] **Step 4: Fix Step 0 outer grid**

Find (Step 0 layout):
```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
  <Card>
    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Select Screens by Area</div>
```
Replace the outer div:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 24, alignItems: 'start' }}>
  <Card>
    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Select Screens by Area</div>
```

- [ ] **Step 5: Fix Step 1 outer grid**

Find (Step 1 layout, the second `gridTemplateColumns: '1fr 320px'`):
```jsx
{step === 1 && (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
```
Replace:
```jsx
{step === 1 && (
  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 24, alignItems: 'start' }}>
```

### BillingView

- [ ] **Step 6: Add `useBreakpoint` to `BillingView.jsx`**

Find in `BillingView.jsx`:
```js
import { useToast } from "../../components/primitives/Toast.jsx";
```
Replace with:
```js
import { useToast } from "../../components/primitives/Toast.jsx";
import { useBreakpoint } from "../../lib/useBreakpoint.js";
```

- [ ] **Step 7: Destructure `isMobile` and fix outer padding**

Find:
```jsx
export default function BillingView() {
  const [data, setData] = useState({ invoices: [], paymentMethods: [], portalUrl: null });
```
Replace with:
```jsx
export default function BillingView() {
  const { isMobile } = useBreakpoint();
  const [data, setData] = useState({ invoices: [], paymentMethods: [], portalUrl: null });
```

Find the outer return div:
```jsx
return (
  <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 900 }}>
```
Replace with:
```jsx
return (
  <div style={{ padding: isMobile ? "20px 16px" : "32px 40px", fontFamily: F.sans, maxWidth: 900 }}>
```

- [ ] **Step 8: Wrap invoice table in `overflowX: auto`**

Find the invoice table element:
```jsx
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
```
Wrap it:
```jsx
<div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
```
And add the closing `</div>` after the `</table>`.

### ScansView

- [ ] **Step 9: Add `useBreakpoint` to `ScansView.jsx` and fix outer padding**

Find:
```js
import { useAuth } from "../../context/AuthContext.jsx";
```
Replace with:
```js
import { useAuth } from "../../context/AuthContext.jsx";
import { useBreakpoint } from "../../lib/useBreakpoint.js";
```

Find inside `ScansView`:
```jsx
export default function ScansView({ impersonatingId }) {
  const { user } = useAuth();
```
Replace with:
```jsx
export default function ScansView({ impersonatingId }) {
  const { isMobile } = useBreakpoint();
  const { user } = useAuth();
```

Find the outer return div:
```jsx
return (
  <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 1100 }}>
```
Replace with:
```jsx
return (
  <div style={{ padding: isMobile ? "20px 16px" : "32px 40px", fontFamily: F.sans, maxWidth: 1100 }}>
```

- [ ] **Step 10: Commit all advertiser mobile fixes**

```bash
git add src/views/advertiser/AdvDashboard.jsx src/views/advertiser/CreateCampaign.jsx src/views/advertiser/BillingView.jsx src/views/advertiser/ScansView.jsx
git commit -m "fix: advertiser views mobile responsive (dashboard, create campaign, billing, scans)"
```

---

## Task 7: Vercel Deploy Verification

- [ ] **Step 1: Check latest Vercel deployment**

Use Vercel MCP `list_deployments` to confirm commit `10cd0c2` deployed successfully and is the current production build.

- [ ] **Step 2: Report result**

If deployment is successful and live: note it in conversation.
If deployment failed or is still in progress: report the error and check build logs via `get_deployment_build_logs`.

---

## Task 8: Final push

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Confirm Vercel auto-deploy triggered**

Check Vercel MCP for new deployment triggered by push.
