# Operator Mobile App — Plan 2: Screens Module

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plan 1 complete. App running with auth and tab shell.

**Goal:** Implement the Screens tab — screen list with health status, screen detail view, and a 5-step registration wizard that uses the camera to scan a QR code on the display device to claim it.

**Architecture:** `useScreens` hook owns all Supabase queries for the screens module. Expo Router dynamic route `(tabs)/screens/[id].jsx` handles screen detail. Onboard wizard lives in `app/onboard/` as a separate Expo Router group so it can be a full-screen flow outside the tab bar. QR scan uses `expo-camera` with `barCodeScannerSettings` — no separate barcode scanner package needed.

**Tech Stack:** `expo-camera`, `expo-image-picker`, `@adgrid/core` (VENUE_TAXONOMY, COUNTRIES, STATE_LABEL, STATE_TIMEZONE), `@testing-library/react-native`, `jest-expo`

---

## File Map

**New files:**
- `mobile/hooks/useScreens.js` — fetch, create, update screens for current operator
- `mobile/app/(tabs)/screens/_layout.jsx` — Stack navigator for screens group
- `mobile/app/(tabs)/screens/index.jsx` — Screen list (replaces placeholder)
- `mobile/app/(tabs)/screens/[id].jsx` — Screen detail
- `mobile/components/screens/ScreenCard.jsx` — Card with health dot, venue info, photo
- `mobile/components/screens/HealthBadge.jsx` — Live/Stale/Offline badge
- `mobile/app/onboard/_layout.jsx` — Wizard Stack (no tab bar)
- `mobile/app/onboard/welcome.jsx` — Step 1: intro
- `mobile/app/onboard/venue.jsx` — Step 2: venue info + address
- `mobile/app/onboard/hours.jsx` — Step 3: operating hours + timezone
- `mobile/app/onboard/photos.jsx` — Step 4: photos (camera or library)
- `mobile/app/onboard/connect.jsx` — Step 5: QR scan to claim screen token
- `mobile/components/onboard/WizardProgress.jsx` — progress bar + step labels
- `mobile/context/OnboardContext.jsx` — wizard form state across steps

**Tests:**
- `mobile/__tests__/hooks/useScreens.test.js`
- `mobile/__tests__/screens/ScreenCard.test.jsx`
- `mobile/__tests__/onboard/venue.test.jsx`
- `mobile/__tests__/onboard/connect.test.jsx`

---

### Task 1: useScreens hook

**Files:**
- Create: `mobile/hooks/useScreens.js`
- Test: `mobile/__tests__/hooks/useScreens.test.js`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/hooks/useScreens.test.js`:

```js
import { renderHook, waitFor } from '@testing-library/react-native';
import { useScreens } from '../../hooks/useScreens';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

// Inject mock data for screens query
beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({
      data: [
        { id: '1', name: 'Lobby Screen', venue_category: 'retail', health_status: null, last_seen: new Date().toISOString(), screen_photos: [] },
      ],
      error: null,
    }),
  });
});

describe('useScreens', () => {
  it('loads screens for given operatorId', async () => {
    const { result } = renderHook(() => useScreens('op-123'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.screens).toHaveLength(1);
    expect(result.current.screens[0].name).toBe('Lobby Screen');
  });

  it('returns empty array when operatorId is null', async () => {
    const { result } = renderHook(() => useScreens(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.screens).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/hooks/useScreens.test.js
```

Expected: FAIL — "Cannot find module '../../hooks/useScreens'"

- [ ] **Step 3: Create `mobile/hooks/useScreens.js`**

```js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useScreens(operatorId) {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchScreens() {
    if (!operatorId) { setScreens([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('screens')
      .select('id, name, venue_category, venue_subtype, address_city, health_status, last_seen, screen_token, screen_photos, status, operating_hours_start, operating_hours_end, timezone')
      .eq('operator_id', operatorId);
    if (err) setError(err.message);
    else setScreens(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchScreens(); }, [operatorId]);

  async function createScreen(fields) {
    const { data, error: err } = await supabase
      .from('screens')
      .insert({ ...fields, operator_id: operatorId })
      .select()
      .single();
    if (!err) setScreens(prev => [...prev, data]);
    return { data, error: err };
  }

  async function claimScreenToken(screenToken, screenId) {
    const { error: err } = await supabase
      .from('screens')
      .update({ status: 'active' })
      .eq('id', screenId)
      .eq('screen_token', screenToken);
    return { error: err };
  }

  return { screens, loading, error, refetch: fetchScreens, createScreen, claimScreenToken };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/hooks/useScreens.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/hooks/useScreens.js mobile/__tests__/hooks/
git commit -m "feat(mobile): add useScreens hook"
```

---

### Task 2: HealthBadge + ScreenCard components

**Files:**
- Create: `mobile/components/screens/HealthBadge.jsx`
- Create: `mobile/components/screens/ScreenCard.jsx`
- Test: `mobile/__tests__/screens/ScreenCard.test.jsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/screens/ScreenCard.test.jsx`:

```jsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ScreenCard } from '../../components/screens/ScreenCard';

const baseScreen = {
  id: '1',
  name: 'Lobby Screen',
  venue_category: 'retail',
  venue_subtype: 'Clothing',
  address_city: 'Toronto',
  health_status: null,
  last_seen: new Date().toISOString(),
  screen_photos: [],
};

describe('ScreenCard', () => {
  it('renders screen name', () => {
    const { getByText } = render(<ScreenCard screen={baseScreen} onPress={() => {}} />);
    expect(getByText('Lobby Screen')).toBeTruthy();
  });

  it('shows Live badge when last_seen within 5 minutes', () => {
    const { getByText } = render(<ScreenCard screen={baseScreen} onPress={() => {}} />);
    expect(getByText('Live')).toBeTruthy();
  });

  it('shows Offline when last_seen is null', () => {
    const { getByText } = render(
      <ScreenCard screen={{ ...baseScreen, last_seen: null }} onPress={() => {}} />
    );
    expect(getByText('Offline')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/screens/ScreenCard.test.jsx
```

- [ ] **Step 3: Create `mobile/components/screens/HealthBadge.jsx`**

```jsx
import React from 'react';
import { Badge } from '../ui/Badge';
import { C } from '../../lib/tokens';

export function healthSignal(screen) {
  if (screen.health_status === 'degraded') return { label: 'Degraded', variant: 'amber' };
  if (!screen.last_seen) return { label: 'Offline', variant: 'red' };
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5) return { label: 'Live', variant: 'green' };
  if (minsAgo <= 60) return { label: 'Stale', variant: 'amber' };
  return { label: 'Offline', variant: 'red' };
}

export function HealthBadge({ screen }) {
  const { label, variant } = healthSignal(screen);
  return <Badge label={label} variant={variant} dot />;
}
```

- [ ] **Step 4: Create `mobile/components/screens/ScreenCard.jsx`**

```jsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { HealthBadge } from './HealthBadge';
import { C, F } from '../../lib/tokens';
import { VENUE_TAXONOMY } from '@adgrid/core';

export function ScreenCard({ screen, onPress }) {
  const photo = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype || VENUE_TAXONOMY[screen.venue_category]?.label || '';

  return (
    <Card onPress={onPress} style={styles.card}>
      {photo && <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.name, { fontFamily: F.sansSemi }]} numberOfLines={1}>{screen.name}</Text>
          <HealthBadge screen={screen} />
        </View>
        <Text style={[styles.meta, { fontFamily: F.sans }]}>
          {[venueLabel, screen.address_city].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', marginBottom: 12 },
  photo: { width: '100%', height: 120 },
  body: { padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 15, color: C.text, flex: 1, marginRight: 8 },
  meta: { fontSize: 12, color: C.textSub },
});
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/screens/ScreenCard.test.jsx
```

Expected: PASS — 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/components/screens/ mobile/__tests__/screens/
git commit -m "feat(mobile): add HealthBadge and ScreenCard components"
```

---

### Task 3: Screens list + detail screens

**Files:**
- Create: `mobile/app/(tabs)/screens/_layout.jsx`
- Modify: `mobile/app/(tabs)/screens/index.jsx` (replace placeholder)
- Create: `mobile/app/(tabs)/screens/[id].jsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/screens/_layout.jsx`**

```jsx
import { Stack } from 'expo-router';
import { C } from '../../../lib/tokens';

export default function ScreensLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
  );
}
```

- [ ] **Step 2: Replace `mobile/app/(tabs)/screens/index.jsx`**

```jsx
import { useEffect } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useScreens } from '../../../hooks/useScreens';
import { ScreenCard } from '../../../components/screens/ScreenCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { C, F } from '../../../lib/tokens';

export default function ScreensScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { screens, loading, refetch } = useScreens(profile?.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.container}>
        <PageHeader
          title="Screens"
          subtitle={`${screens.length} screen${screens.length !== 1 ? 's' : ''} on your network`}
        />

        {loading ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : screens.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon]}>📺</Text>
            <Text style={[styles.emptyTitle, { fontFamily: F.sansBold }]}>No screens yet</Text>
            <Text style={[styles.emptySub, { fontFamily: F.sans }]}>Tap + to register your first screen</Text>
          </View>
        ) : (
          <FlatList
            data={screens}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <ScreenCard screen={item} onPress={() => router.push(`/(tabs)/screens/${item.id}`)} />
            )}
            onRefresh={refetch}
            refreshing={loading}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* FAB — add screen */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/onboard/welcome')}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, color: C.text },
  emptySub: { fontSize: 14, color: C.textSub },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 26, lineHeight: 28 },
});
```

- [ ] **Step 3: Create `mobile/app/(tabs)/screens/[id].jsx`**

```jsx
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { HealthBadge } from '../../../components/screens/HealthBadge';
import { Card } from '../../../components/ui/Card';
import { Btn } from '../../../components/ui/Btn';
import { Badge } from '../../../components/ui/Badge';
import { PageHeader } from '../../../components/ui/PageHeader';
import { KPI } from '../../../components/ui/KPI';
import { C, F } from '../../../lib/tokens';
import { VENUE_TAXONOMY } from '@adgrid/core';

export default function ScreenDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [screen, setScreen] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: cs }] = await Promise.all([
        supabase.from('screens').select('*').eq('id', id).single(),
        supabase.from('campaign_screens')
          .select('id, status, campaign:campaigns(id, name, advertiser:profiles(full_name), budget, start_date)')
          .eq('screen_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      setScreen(s);
      setCampaigns(cs || []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.purple} /></SafeAreaView>;
  if (!screen) return null;

  const venueLabel = screen.venue_subtype || VENUE_TAXONOMY[screen.venue_category]?.label || '';
  const activeCampaigns = campaigns.filter(c => c.status === 'approved').length;
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back button */}
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>

        <PageHeader title={screen.name} subtitle={[venueLabel, screen.address_city].filter(Boolean).join(' · ')} />

        <HealthBadge screen={screen} />

        {/* Photos */}
        {screen.screen_photos?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
            {screen.screen_photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {/* KPIs */}
        <View style={styles.kpis}>
          <KPI label="Active Ads" value={String(activeCampaigns)} icon="✅" color={C.green} />
          <KPI label="Pending" value={String(pendingCampaigns)} icon="⏳" color={C.amber} />
        </View>

        {/* Details card */}
        <Card style={styles.detailCard}>
          <Row label="Status" value={screen.status || 'active'} />
          <Row label="Hours" value={`${screen.operating_hours_start || '—'} – ${screen.operating_hours_end || '—'}`} />
          <Row label="Timezone" value={screen.timezone || '—'} />
          <Row label="Screen Token" value={screen.screen_token || '—'} mono />
        </Card>

        {/* Recent campaigns */}
        {campaigns.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.sectionTitle, { fontFamily: F.sansSemi }]}>Recent Campaigns</Text>
            {campaigns.map(cs => (
              <Card key={cs.id} style={{ marginBottom: 10, padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[{ fontFamily: F.sansMed, color: C.text, fontSize: 14 }]} numberOfLines={1}>
                    {cs.campaign?.name || 'Campaign'}
                  </Text>
                  <Badge label={cs.status} variant={cs.status === 'approved' ? 'green' : cs.status === 'pending' ? 'amber' : 'muted'} />
                </View>
                <Text style={[{ fontFamily: F.sans, color: C.textSub, fontSize: 12, marginTop: 4 }]}>
                  {cs.campaign?.advertiser?.full_name}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ fontFamily: F.sansMed, color: C.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ fontFamily: mono ? F.mono : F.sans, color: C.text, fontSize: 13, flex: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20 },
  back: { marginBottom: 12, paddingHorizontal: 0 },
  photos: { marginVertical: 16, marginHorizontal: -20 },
  photo: { width: 280, height: 160, borderRadius: 8, marginLeft: 20 },
  kpis: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 },
  detailCard: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, color: C.text, marginBottom: 10 },
});
```

- [ ] **Step 4: Verify navigation in Expo Go**

With simulator or device:
1. Screens tab → list appears
2. Tap a screen card → detail screen with health badge
3. Back button returns to list
4. FAB tap → should navigate to `/onboard/welcome` (created in next tasks)

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(tabs)/screens/
git commit -m "feat(mobile): add screens list and detail views"
```

---

### Task 4: Onboard wizard — context + steps 1–4

**Files:**
- Create: `mobile/context/OnboardContext.jsx`
- Create: `mobile/app/onboard/_layout.jsx`
- Create: `mobile/components/onboard/WizardProgress.jsx`
- Create: `mobile/app/onboard/welcome.jsx`
- Create: `mobile/app/onboard/venue.jsx`
- Create: `mobile/app/onboard/hours.jsx`
- Create: `mobile/app/onboard/photos.jsx`
- Test: `mobile/__tests__/onboard/venue.test.jsx`

- [ ] **Step 1: Write failing venue step test**

Create `mobile/__tests__/onboard/venue.test.jsx`:

```jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VenueScreen from '../../app/onboard/venue';
import { OnboardProvider } from '../../context/OnboardContext';
import { AuthProvider } from '../../context/AuthContext';

const wrapper = ({ children }) => (
  <AuthProvider><OnboardProvider>{children}</OnboardProvider></AuthProvider>
);

describe('VenueScreen', () => {
  it('renders venue name field', () => {
    const { getByPlaceholderText } = render(<VenueScreen />, { wrapper });
    expect(getByPlaceholderText('e.g. Main Lobby Screen')).toBeTruthy();
  });

  it('shows error when name is empty and next pressed', async () => {
    const { getByText, findByText } = render(<VenueScreen />, { wrapper });
    fireEvent.press(getByText('Next'));
    expect(await findByText('Screen name is required')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/onboard/venue.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Create `mobile/context/OnboardContext.jsx`**

```jsx
import { createContext, useContext, useState } from 'react';

const OnboardContext = createContext({});

const INITIAL = {
  name: '',
  venue_category: '',
  venue_subtype: '',
  address_street: '',
  address_city: '',
  address_state: '',
  address_country: 'CA',
  operating_hours_start: '08:00',
  operating_hours_end: '22:00',
  timezone: 'America/Toronto',
  photos: [],             // local URIs before upload
  screenId: null,         // set after DB insert in venue step
};

export function OnboardProvider({ children }) {
  const [form, setForm] = useState(INITIAL);
  function update(fields) { setForm(prev => ({ ...prev, ...fields })); }
  function reset() { setForm(INITIAL); }
  return (
    <OnboardContext.Provider value={{ form, update, reset }}>
      {children}
    </OnboardContext.Provider>
  );
}

export const useOnboard = () => useContext(OnboardContext);
```

- [ ] **Step 4: Create `mobile/app/onboard/_layout.jsx`**

```jsx
import { Stack } from 'expo-router';
import { OnboardProvider } from '../../context/OnboardContext';
import { C } from '../../lib/tokens';

export default function OnboardLayout() {
  return (
    <OnboardProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
    </OnboardProvider>
  );
}
```

- [ ] **Step 5: Create `mobile/components/onboard/WizardProgress.jsx`**

```jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

const STEPS = ['Welcome', 'Venue', 'Hours', 'Photos', 'Connect'];

export function WizardProgress({ step }) {
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <View style={styles.wrap}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.labels}>
        {STEPS.map((label, i) => (
          <Text
            key={label}
            style={[styles.label, { fontFamily: i + 1 === step ? F.sansSemi : F.sans, color: i + 1 <= step ? C.purple : C.textMuted }]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  barTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 8 },
  barFill: { height: '100%', backgroundColor: C.purple, borderRadius: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 10 },
});
```

- [ ] **Step 6: Create `mobile/app/onboard/welcome.jsx`**

```jsx
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WizardProgress step={1} />
        <Text style={styles.emoji}>📺</Text>
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Let's get your screen on the network</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>
          ADGRID connects your display to advertisers who pay to reach your audience. Setup takes about 5 minutes.
        </Text>
        <View style={styles.bullets}>
          {['Register your screen details', 'Set operating hours', 'Upload a photo', 'Scan QR to connect your display'].map(item => (
            <View key={item} style={styles.bullet}>
              <Text style={[styles.bulletDot, { color: C.purple }]}>•</Text>
              <Text style={[styles.bulletText, { fontFamily: F.sans }]}>{item}</Text>
            </View>
          ))}
        </View>
        <Btn onPress={() => router.push('/onboard/venue')} size="lg">Get Started</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 12 }}>Cancel</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 20 },
  emoji: { fontSize: 52, textAlign: 'center', marginBottom: 20 },
  title: { fontSize: 24, color: C.text, textAlign: 'center', marginBottom: 12 },
  sub: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  bullets: { marginBottom: 32, gap: 10 },
  bullet: { flexDirection: 'row', gap: 10 },
  bulletDot: { fontSize: 18, lineHeight: 22 },
  bulletText: { fontSize: 14, color: C.textSub, flex: 1, lineHeight: 22 },
});
```

- [ ] **Step 7: Create `mobile/app/onboard/venue.jsx`**

```jsx
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { Inp } from '../../components/ui/Inp';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { C, F } from '../../lib/tokens';
import { VENUE_TAXONOMY, COUNTRIES, STATE_LABEL } from '@adgrid/core';

export default function VenueScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { form, update } = useOnboard();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = Object.entries(VENUE_TAXONOMY).map(([k, v]) => ({ value: k, label: v.label }));
  const subtypes = form.venue_category ? VENUE_TAXONOMY[form.venue_category]?.subtypes || [] : [];

  async function handleNext() {
    if (!form.name.trim()) { setError('Screen name is required'); return; }
    if (!form.venue_category) { setError('Venue category is required'); return; }
    if (!form.address_city.trim()) { setError('City is required'); return; }
    setError('');
    setLoading(true);

    // Create screen record now so we have an ID for subsequent steps
    const { data, error: err } = await supabase
      .from('screens')
      .insert({
        operator_id: profile.id,
        name: form.name.trim(),
        venue_category: form.venue_category,
        venue_subtype: form.venue_subtype || null,
        address_city: form.address_city.trim(),
        address_state: form.address_state.trim() || null,
        address_country: form.address_country,
        status: 'pending',
      })
      .select()
      .single();

    setLoading(false);
    if (err) { setError(err.message); return; }
    update({ screenId: data.id });
    router.push('/onboard/hours');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <WizardProgress step={2} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>About your screen</Text>
        <ErrorBanner message={error} />
        <Inp label="Screen name" value={form.name} onChangeText={v => update({ name: v })} placeholder="e.g. Main Lobby Screen" autoCapitalize="words" />
        <Inp label="City" value={form.address_city} onChangeText={v => update({ address_city: v })} placeholder="Toronto" autoCapitalize="words" />
        <Inp label={STATE_LABEL[form.address_country] || 'Province'} value={form.address_state} onChangeText={v => update({ address_state: v })} placeholder="Ontario" autoCapitalize="words" />

        {/* Category picker — simple pill selector */}
        <Text style={[styles.label, { fontFamily: F.sansMed }]}>Venue category</Text>
        <View style={styles.pills}>
          {categories.map(cat => (
            <View key={cat.value}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => update({ venue_category: cat.value, venue_subtype: '' })}
              style={[styles.pill, { borderColor: form.venue_category === cat.value ? C.purple : C.border, backgroundColor: form.venue_category === cat.value ? C.purpleSoft : C.surface }]}
            >
              <Text style={[styles.pillText, { fontFamily: F.sansMed, color: form.venue_category === cat.value ? C.purple : C.textSub }]}>{cat.label}</Text>
            </View>
          ))}
        </View>

        {subtypes.length > 0 && (
          <>
            <Text style={[styles.label, { fontFamily: F.sansMed }]}>Venue type</Text>
            <View style={styles.pills}>
              {subtypes.map(sub => (
                <View key={sub}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={() => update({ venue_subtype: sub })}
                  style={[styles.pill, { borderColor: form.venue_subtype === sub ? C.purple : C.border, backgroundColor: form.venue_subtype === sub ? C.purpleSoft : C.surface }]}
                >
                  <Text style={[styles.pillText, { fontFamily: F.sansMed, color: form.venue_subtype === sub ? C.purple : C.textSub }]}>{sub}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Btn onPress={handleNext} loading={loading} size="lg" style={{ marginTop: 24 }}>Next</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }}>Back</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24 },
  title: { fontSize: 22, color: C.text, marginBottom: 20 },
  label: { fontSize: 13, color: C.textMid, marginBottom: 8, marginTop: 8, fontWeight: '500' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12 },
});
```

- [ ] **Step 8: Create `mobile/app/onboard/hours.jsx`**

```jsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { Inp } from '../../components/ui/Inp';
import { C, F } from '../../lib/tokens';
import { STATE_TIMEZONE } from '@adgrid/core';

export default function HoursScreen() {
  const router = useRouter();
  const { form, update } = useOnboard();

  // Auto-derive timezone from country + state when state changes
  function handleStateChange(state) {
    const tz = STATE_TIMEZONE[form.address_country]?.[state];
    update({ address_state: state, ...(tz ? { timezone: tz } : {}) });
  }

  async function handleNext() {
    await supabase.from('screens').update({
      operating_hours_start: form.operating_hours_start,
      operating_hours_end: form.operating_hours_end,
      timezone: form.timezone,
    }).eq('id', form.screenId);
    router.push('/onboard/photos');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WizardProgress step={3} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Operating hours</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>When is your screen on and showing ads?</Text>
        <Inp label="Start time (HH:MM)" value={form.operating_hours_start} onChangeText={v => update({ operating_hours_start: v })} placeholder="08:00" keyboardType="numbers-and-punctuation" />
        <Inp label="End time (HH:MM)" value={form.operating_hours_end} onChangeText={v => update({ operating_hours_end: v })} placeholder="22:00" keyboardType="numbers-and-punctuation" />
        <Inp label="Timezone (IANA)" value={form.timezone} onChangeText={v => update({ timezone: v })} placeholder="America/Toronto" />
        <Text style={[styles.hint, { fontFamily: F.sans }]}>Timezone is auto-detected from your province/region. Edit if incorrect.</Text>
        <Btn onPress={handleNext} size="lg" style={{ marginTop: 24 }}>Next</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }}>Back</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24 },
  title: { fontSize: 22, color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 20 },
  hint: { fontSize: 12, color: C.textMuted, marginTop: -8 },
});
```

- [ ] **Step 9: Create `mobile/app/onboard/photos.jsx`**

```jsx
import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function PhotosScreen() {
  const router = useRouter();
  const { form, update } = useOnboard();
  const [uploading, setUploading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      update({ photos: [...form.photos, result.assets[0].uri].slice(0, 3) });
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required to take photos.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      update({ photos: [...form.photos, result.assets[0].uri].slice(0, 3) });
    }
  }

  function removePhoto(index) {
    update({ photos: form.photos.filter((_, i) => i !== index) });
  }

  async function handleNext() {
    if (form.photos.length === 0) { router.push('/onboard/connect'); return; }
    setUploading(true);
    const uploaded = [];
    for (const uri of form.photos) {
      const ext = uri.split('.').pop() || 'jpg';
      const path = `screens/${form.screenId}/${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from('screen-photos').upload(path, blob, { contentType: `image/${ext}` });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('screen-photos').getPublicUrl(path);
        uploaded.push(publicUrl);
      }
    }
    if (uploaded.length > 0) {
      await supabase.from('screens').update({ screen_photos: uploaded }).eq('id', form.screenId);
    }
    setUploading(false);
    router.push('/onboard/connect');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WizardProgress step={4} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Add photos</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>Show advertisers where your screen is located. Up to 3 photos.</Text>

        {/* Photo previews */}
        <View style={styles.previews}>
          {form.photos.map((uri, i) => (
            <View key={i} style={styles.previewWrap}>
              <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
              <TouchableOpacity onPress={() => removePhoto(i)} style={styles.removeBtn}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {form.photos.length < 3 && (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <Btn variant="secondary" onPress={pickImage} style={{ flex: 1 }}>📁 Library</Btn>
            <Btn variant="secondary" onPress={takePhoto} style={{ flex: 1 }}>📷 Camera</Btn>
          </View>
        )}

        <Btn onPress={handleNext} loading={uploading} size="lg">{form.photos.length === 0 ? 'Skip' : 'Next'}</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }}>Back</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24 },
  title: { fontSize: 22, color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 20 },
  previews: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  previewWrap: { position: 'relative' },
  preview: { width: 100, height: 70, borderRadius: 8 },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 10: Run tests — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/onboard/venue.test.jsx
```

Expected: PASS — 2 tests pass.

- [ ] **Step 11: Commit**

```bash
git add mobile/context/OnboardContext.jsx mobile/app/onboard/ mobile/components/onboard/ mobile/__tests__/onboard/
git commit -m "feat(mobile): add screen registration wizard steps 1-4"
```

---

### Task 5: Onboard wizard — step 5 (QR scan to connect)

**Files:**
- Create: `mobile/app/onboard/connect.jsx`
- Test: `mobile/__tests__/onboard/connect.test.jsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/onboard/connect.test.jsx`:

```jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ConnectScreen from '../../app/onboard/connect';
import { OnboardProvider } from '../../context/OnboardContext';
import { AuthProvider } from '../../context/AuthContext';

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: ({ onBarcodeScanned, children }) => {
    // Expose a way to trigger scan in tests
    global.__triggerScan = onBarcodeScanned;
    return children || null;
  },
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

const wrapper = ({ children }) => (
  <AuthProvider><OnboardProvider>{children}</OnboardProvider></AuthProvider>
);

describe('ConnectScreen', () => {
  it('shows scan instruction', () => {
    const { getByText } = render(<ConnectScreen />, { wrapper });
    expect(getByText(/Scan the QR code/i)).toBeTruthy();
  });

  it('shows success state after scan', async () => {
    const { getByText } = render(<ConnectScreen />, { wrapper });
    // Simulate a barcode scan
    global.__triggerScan({ type: 'qr', data: 'screen_token_abc123' });
    await waitFor(() => expect(getByText(/Connected/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/onboard/connect.test.jsx
```

Expected: FAIL — "Cannot find module '../../app/onboard/connect'"

- [ ] **Step 3: Create `mobile/app/onboard/connect.jsx`**

```jsx
import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function ConnectScreen() {
  const router = useRouter();
  const { form, reset } = useOnboard();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const lastScanRef = useRef(null);

  async function handleScan({ data }) {
    // Debounce — QR scanner fires repeatedly
    if (scanned || connecting || data === lastScanRef.current) return;
    lastScanRef.current = data;
    setScanned(true);
    setConnecting(true);
    setError('');

    // data is the screen_token value encoded in the QR code on the display device
    const { error: err } = await supabase
      .from('screens')
      .update({ screen_token: data, status: 'active' })
      .eq('id', form.screenId);

    setConnecting(false);
    if (err) {
      setError('Could not connect screen. Check the QR code and try again.');
      setScanned(false);
      lastScanRef.current = null;
    } else {
      setConnected(true);
    }
  }

  async function handleDone() {
    reset();
    router.replace('/(tabs)/screens');
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24 }}>
        <WizardProgress step={5} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Camera access needed</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>Allow camera access to scan your screen's QR code.</Text>
        <Btn onPress={requestPermission} size="lg">Allow Camera</Btn>
      </SafeAreaView>
    );
  }

  if (connected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 64, marginBottom: 20 }}>✅</Text>
        <Text style={[styles.title, { fontFamily: F.sansBold, textAlign: 'center' }]}>Connected!</Text>
        <Text style={[styles.sub, { fontFamily: F.sans, textAlign: 'center', marginBottom: 40 }]}>
          Your screen is on the AdGrid network and ready to display ads.
        </Text>
        <Btn onPress={handleDone} size="lg">View My Screens</Btn>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={styles.scanWrap}>
        <WizardProgress step={5} />
        <Text style={[styles.scanTitle, { fontFamily: F.sansBold }]}>Connect your display</Text>
        <Text style={[styles.scanSub, { fontFamily: F.sans }]}>
          Scan the QR code shown on your screen device (TV/monitor running AdGrid display software)
        </Text>

        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        >
          <View style={styles.overlay}>
            <View style={styles.finder} />
          </View>
        </CameraView>

        {connecting && <Text style={[styles.hint, { fontFamily: F.sans }]}>Connecting…</Text>}
        {error ? <Text style={[styles.error, { fontFamily: F.sans }]}>{error}</Text> : null}
        {scanned && !connecting && !connected && (
          <Btn variant="secondary" onPress={() => { setScanned(false); lastScanRef.current = null; }} style={{ marginTop: 16 }}>Scan Again</Btn>
        )}

        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 16, color: '#fff' }}>Back</Btn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scanWrap: { flex: 1, padding: 24 },
  scanTitle: { fontSize: 20, color: '#fff', marginBottom: 8 },
  scanSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18, marginBottom: 20 },
  camera: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  finder: { width: 200, height: 200, borderWidth: 2, borderColor: C.purple, borderRadius: 12 },
  hint: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8 },
  error: { color: C.red, textAlign: 'center', marginTop: 8 },
  title: { fontSize: 22, color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 20 },
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/onboard/connect.test.jsx
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Run all tests**

```bash
cd mobile && pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/onboard/connect.jsx mobile/__tests__/onboard/connect.test.jsx
git commit -m "feat(mobile): add QR scan connect step to screen registration wizard"
```

---

**Plan 2 complete.** Operators can browse their screen list, view screen details, and register new screens with a 5-step wizard including QR scan to claim the display device.
