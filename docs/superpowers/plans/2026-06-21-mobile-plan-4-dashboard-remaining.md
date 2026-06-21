# Operator Mobile App — Plan 4: Dashboard + Remaining Tabs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plans 1, 2, and 3 complete.

**Goal:** Replace all remaining placeholder tab screens with full implementations — Dashboard KPIs, Revenue breakdown, Analytics, Advertisers, Billing, Settings, and the More menu. Adds sign-out which deregisters push token.

**Architecture:** Each tab is a self-contained screen component. Dashboard, Revenue, and Analytics fetch data directly with Supabase queries. Advertisers, Billing, and Settings are read-heavy with minimal writes. More tab is a navigation menu linking into the sub-screens. Sign-out in Settings deregisters the Expo push token before calling `supabase.auth.signOut()`.

**Tech Stack:** `expo-linking` (for external Stripe/billing URLs), `@testing-library/react-native`

---

## File Map

**Modified files:**
- `mobile/app/(tabs)/index.jsx` — replace placeholder with Dashboard
- `mobile/app/(tabs)/revenue.jsx` — replace placeholder with Revenue
- `mobile/app/(tabs)/more/index.jsx` — replace placeholder with More menu

**New files:**
- `mobile/hooks/useDashboard.js` — aggregate KPI data
- `mobile/hooks/useRevenue.js` — revenue data by period
- `mobile/app/(tabs)/more/analytics.jsx`
- `mobile/app/(tabs)/more/_layout.jsx` — Stack for More group
- `mobile/app/(tabs)/more/advertisers.jsx`
- `mobile/app/(tabs)/more/billing.jsx`
- `mobile/app/(tabs)/more/settings.jsx`
- `mobile/components/ui/PillFilter.jsx` — period filter pill row

**Tests:**
- `mobile/__tests__/hooks/useDashboard.test.js`

---

### Task 1: useDashboard hook

**Files:**
- Create: `mobile/hooks/useDashboard.js`
- Test: `mobile/__tests__/hooks/useDashboard.test.js`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/hooks/useDashboard.test.js`:

```js
import { renderHook, waitFor } from '@testing-library/react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

beforeEach(() => {
  jest.clearAllMocks();
  // Mock screens query
  mockSupabase.from.mockImplementation((table) => {
    if (table === 'screens') return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          { id: 's1', last_seen: new Date().toISOString(), health_status: null },
          { id: 's2', last_seen: null, health_status: null },
        ],
        error: null,
      }),
    };
    if (table === 'campaign_screens') return {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [{ id: 'cs1', status: 'pending' }], error: null }),
    };
    if (table === 'bookings') return {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ data: [{ budget: 500 }], error: null }),
    };
    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
  });
});

describe('useDashboard', () => {
  it('loads dashboard data for operator', async () => {
    const { result } = renderHook(() => useDashboard('op-1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalScreens).toBe(2);
    expect(result.current.liveScreens).toBe(1);
    expect(result.current.pendingApprovals).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/hooks/useDashboard.test.js
```

Expected: FAIL.

- [ ] **Step 3: Create `mobile/hooks/useDashboard.js`**

```js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function isLive(screen) {
  if (!screen.last_seen || screen.health_status === 'degraded') return false;
  return (Date.now() - new Date(screen.last_seen).getTime()) / 60000 <= 5;
}

export function useDashboard(operatorId) {
  const [data, setData] = useState({
    totalScreens: 0, liveScreens: 0, pendingApprovals: 0, revenueThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!operatorId) { setLoading(false); return; }

    async function load() {
      setLoading(true);

      // Screens
      const { data: screens } = await supabase
        .from('screens')
        .select('id, last_seen, health_status')
        .eq('operator_id', operatorId);

      const screenIds = (screens || []).map(s => s.id);
      const liveScreens = (screens || []).filter(isLive).length;

      let pendingApprovals = 0;
      let revenueThisMonth = 0;

      if (screenIds.length > 0) {
        // Pending approvals
        const { data: pending } = await supabase
          .from('campaign_screens')
          .select('id')
          .in('screen_id', screenIds)
          .eq('status', 'pending');
        pendingApprovals = pending?.length || 0;

        // Revenue this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
        const { data: bookings } = await supabase
          .from('bookings')
          .select('budget')
          .in('screen_id', screenIds)
          .gte('created_at', startOfMonth.toISOString());
        revenueThisMonth = (bookings || []).reduce((sum, b) => sum + (b.budget || 0) * 0.70, 0);
      }

      setData({ totalScreens: screens?.length || 0, liveScreens, pendingApprovals, revenueThisMonth });
      setLoading(false);
    }

    load();
  }, [operatorId]);

  return { ...data, loading };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/hooks/useDashboard.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/hooks/useDashboard.js mobile/__tests__/hooks/useDashboard.test.js
git commit -m "feat(mobile): add useDashboard hook"
```

---

### Task 2: Dashboard screen (Home tab)

**Files:**
- Modify: `mobile/app/(tabs)/index.jsx`

- [ ] **Step 1: Replace `mobile/app/(tabs)/index.jsx`**

```jsx
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { useScreens } from '../../hooks/useScreens';
import { KPI } from '../../components/ui/KPI';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { HealthBadge } from '../../components/screens/HealthBadge';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { C, F } from '../../lib/tokens';
import { formatCurrency } from '@adgrid/core';

export default function DashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { totalScreens, liveScreens, pendingApprovals, revenueThisMonth, loading } = useDashboard(profile?.id);
  const { screens, loading: screensLoading, refetch } = useScreens(profile?.id);

  const firstName = profile?.full_name?.split(' ')[0] || 'Operator';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading || screensLoading} onRefresh={refetch} tintColor={C.purple} />}
      >
        <PageHeader title={`Hello, ${firstName}`} subtitle="Here's your network at a glance" />

        {/* KPI row */}
        {loading ? (
          <View style={styles.kpis}><SkeletonCard rows={2} /><SkeletonCard rows={2} /></View>
        ) : (
          <View style={styles.kpis}>
            <KPI label="Total Screens" value={String(totalScreens)} icon="📺" />
            <KPI label="Live Now" value={String(liveScreens)} icon="🟢" color={C.green} />
            <KPI label="Pending Ads" value={String(pendingApprovals)} icon="⏳" color={pendingApprovals > 0 ? C.amber : C.textMuted} />
            <KPI label="Revenue (MTD)" value={formatCurrency(revenueThisMonth, 'cad')} icon="💰" color={C.green} />
          </View>
        )}

        {/* Pending approvals CTA */}
        {pendingApprovals > 0 && (
          <Card style={[styles.alertCard, { borderColor: C.amberBorder, backgroundColor: C.amberSoft }]}>
            <Text style={[styles.alertText, { fontFamily: F.sansMed }]}>
              ⚠ {pendingApprovals} ad{pendingApprovals !== 1 ? 's' : ''} awaiting your approval
            </Text>
            <Btn variant="secondary" size="sm" onPress={() => router.push('/(tabs)/approvals')} style={{ marginTop: 10 }}>
              Review Now
            </Btn>
          </Card>
        )}

        {/* Screen health summary */}
        <Text style={[styles.sectionTitle, { fontFamily: F.sansSemi }]}>Your screens</Text>
        {screensLoading
          ? <SkeletonCard rows={2} />
          : screens.slice(0, 5).map(screen => (
            <Card
              key={screen.id}
              style={styles.screenRow}
              onPress={() => router.push(`/(tabs)/screens/${screen.id}`)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.screenName, { fontFamily: F.sansMed }]} numberOfLines={1}>{screen.name}</Text>
                <HealthBadge screen={screen} />
              </View>
            </Card>
          ))
        }
        {screens.length > 5 && (
          <Btn variant="ghost" onPress={() => router.push('/(tabs)/screens')} style={{ alignSelf: 'center', marginTop: 4 }}>
            View all {screens.length} screens →
          </Btn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  alertCard: { borderWidth: 1, marginBottom: 20, padding: 14 },
  alertText: { fontSize: 14, color: C.amber },
  sectionTitle: { fontSize: 16, color: C.text, marginBottom: 10 },
  screenRow: { padding: 12, marginBottom: 8 },
  screenName: { fontSize: 14, color: C.text, flex: 1, marginRight: 10 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/(tabs)/index.jsx
git commit -m "feat(mobile): implement dashboard home screen with KPIs and screen health"
```

---

### Task 3: Revenue tab

**Files:**
- Create: `mobile/hooks/useRevenue.js`
- Modify: `mobile/app/(tabs)/revenue.jsx`
- Create: `mobile/components/ui/PillFilter.jsx`

- [ ] **Step 1: Create `mobile/components/ui/PillFilter.jsx`**

```jsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function PillFilter({ options, value, onChange }) {
  return (
    <View style={styles.row}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.pill, { borderColor: active ? C.purple : C.border, backgroundColor: active ? C.purpleSoft : C.surface }]}
          >
            <Text style={[styles.label, { fontFamily: F.sansMed, color: active ? C.purple : C.textSub }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 12 },
});
```

- [ ] **Step 2: Create `mobile/hooks/useRevenue.js`**

```js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SCREEN_SHARE = 0.70;

export function useRevenue(operatorId, screenIds, periodDays) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!operatorId || !screenIds || screenIds.length === 0) { setCampaigns([]); setLoading(false); return; }

    async function load() {
      setLoading(true);
      let query = supabase
        .from('campaign_screens')
        .select('id, status, approved_at, campaign:campaigns(id, name, budget, start_date, advertiser:profiles(full_name))')
        .in('screen_id', screenIds)
        .eq('status', 'approved');

      if (periodDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - periodDays);
        query = query.gte('approved_at', cutoff.toISOString());
      }

      const { data } = await query;
      setCampaigns(data || []);
      setLoading(false);
    }

    load();
  }, [operatorId, JSON.stringify(screenIds), periodDays]);

  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.campaign?.budget || 0) * SCREEN_SHARE, 0);

  return { campaigns, loading, totalRevenue };
}
```

- [ ] **Step 3: Replace `mobile/app/(tabs)/revenue.jsx`**

```jsx
import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useScreens } from '../../hooks/useScreens';
import { useRevenue } from '../../hooks/useRevenue';
import { KPI } from '../../components/ui/KPI';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { PillFilter } from '../../components/ui/PillFilter';
import { C, F } from '../../lib/tokens';
import { formatCurrency } from '@adgrid/core';

const PERIODS = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '365d', value: 365 },
  { label: 'All', value: null },
];

export default function RevenueScreen() {
  const [period, setPeriod] = useState(30);
  const { profile } = useAuth();
  const { screens } = useScreens(profile?.id);
  const screenIds = screens.map(s => s.id);
  const { campaigns, loading, totalRevenue } = useRevenue(profile?.id, screenIds, period);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <PageHeader title="Revenue" subtitle="Your earnings from approved campaigns" />
            <PillFilter options={PERIODS} value={period} onChange={setPeriod} />
            <View style={styles.kpis}>
              <KPI label="Your Earnings" value={formatCurrency(totalRevenue, 'cad')} icon="💰" color={C.green} />
              <KPI label="Campaigns" value={String(campaigns.length)} icon="📋" />
            </View>
          </View>
        )}
        data={campaigns}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10, padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.campaignName, { fontFamily: F.sansMed }]} numberOfLines={1}>
                {item.campaign?.name}
              </Text>
              <Text style={[styles.amount, { fontFamily: F.sansSemi, color: C.green }]}>
                +{formatCurrency((item.campaign?.budget || 0) * 0.70, 'cad')}
              </Text>
            </View>
            <Text style={[styles.meta, { fontFamily: F.sans }]}>{item.campaign?.advertiser?.full_name}</Text>
          </Card>
        )}
        ListEmptyComponent={() =>
          loading ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text style={[styles.emptyTitle, { fontFamily: F.sansBold }]}>No revenue yet</Text>
              <Text style={[styles.emptySub, { fontFamily: F.sans }]}>Approved campaigns will appear here</Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, paddingBottom: 0 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  kpis: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  campaignName: { fontSize: 14, color: C.text, flex: 1, marginRight: 10 },
  amount: { fontSize: 14 },
  meta: { fontSize: 12, color: C.textSub },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, color: C.text },
  emptySub: { fontSize: 14, color: C.textSub },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/hooks/useRevenue.js mobile/app/(tabs)/revenue.jsx mobile/components/ui/PillFilter.jsx
git commit -m "feat(mobile): implement revenue tab with period filter"
```

---

### Task 4: More tab — layout + menu

**Files:**
- Create: `mobile/app/(tabs)/more/_layout.jsx`
- Modify: `mobile/app/(tabs)/more/index.jsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/more/_layout.jsx`**

```jsx
import { Stack } from 'expo-router';
import { C } from '../../../lib/tokens';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
  );
}
```

- [ ] **Step 2: Replace `mobile/app/(tabs)/more/index.jsx`**

```jsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { C, F } from '../../../lib/tokens';

const MENU_ITEMS = [
  { icon: '📊', label: 'Analytics', route: '/(tabs)/more/analytics' },
  { icon: '🏢', label: 'Advertisers', route: '/(tabs)/more/advertisers' },
  { icon: '💳', label: 'Billing', route: '/(tabs)/more/billing' },
  { icon: '⚙️', label: 'Settings', route: '/(tabs)/more/settings' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { deregister } = usePushNotifications(profile?.id);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          if (profile?.id) await deregister(profile.id);
          await signOut();
        }
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>More</Text>
        {profile && (
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { fontFamily: F.sansBold }]}>
                {(profile.full_name || 'O')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.profileName, { fontFamily: F.sansSemi }]}>{profile.full_name}</Text>
              <Text style={[styles.profileEmail, { fontFamily: F.sans }]}>{profile.email}</Text>
            </View>
          </View>
        )}

        <View style={styles.menu}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.route}
              onPress={() => router.push(item.route)}
              style={styles.menuItem}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, { fontFamily: F.sansMed }]}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOut}>
          <Text style={[styles.signOutText, { fontFamily: F.sansMed }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, color: C.text, marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28, padding: 16, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, color: C.purple },
  profileName: { fontSize: 15, color: C.text },
  profileEmail: { fontSize: 12, color: C.textSub, marginTop: 2 },
  menu: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  menuIcon: { fontSize: 18, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, color: C.text },
  menuChevron: { fontSize: 20, color: C.textMuted },
  signOut: { padding: 16, alignItems: 'center' },
  signOutText: { fontSize: 15, color: C.red },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/more/
git commit -m "feat(mobile): implement More menu with profile, navigation, and sign out"
```

---

### Task 5: Analytics screen

**Files:**
- Create: `mobile/app/(tabs)/more/analytics.jsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/more/analytics.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useScreens } from '../../../hooks/useScreens';
import { supabase } from '../../../lib/supabase';
import { KPI } from '../../../components/ui/KPI';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Btn } from '../../../components/ui/Btn';
import { C, F } from '../../../lib/tokens';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { screens, loading: screensLoading } = useScreens(profile?.id);
  const [stats, setStats] = useState({ totalImpressions: 0, totalScans: 0, activeCampaigns: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id || screensLoading) return;
    async function load() {
      setLoading(true);
      const screenIds = screens.map(s => s.id);
      if (screenIds.length === 0) { setLoading(false); return; }

      const [{ data: impressions }, { data: active }] = await Promise.all([
        supabase.from('impressions').select('id', { count: 'exact', head: true }).in('screen_id', screenIds),
        supabase.from('campaign_screens').select('id', { count: 'exact', head: true }).in('screen_id', screenIds).eq('status', 'approved'),
      ]);

      setStats({
        totalImpressions: impressions?.length || 0,
        activeCampaigns: active?.length || 0,
      });
      setLoading(false);
    }
    load();
  }, [profile?.id, screens, screensLoading]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title="Analytics" subtitle="Performance across your screen network" />

        {loading ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : (
          <>
            <View style={styles.kpis}>
              <KPI label="Total Impressions" value={stats.totalImpressions.toLocaleString()} icon="👁" />
              <KPI label="Active Campaigns" value={String(stats.activeCampaigns)} icon="📋" color={C.green} />
            </View>

            <Card style={styles.infoCard}>
              <Text style={[styles.infoTitle, { fontFamily: F.sansSemi }]}>About Impressions</Text>
              <Text style={[styles.infoText, { fontFamily: F.sans }]}>
                Impressions are counted each time your screen completes a full ad display cycle. Data updates in real time as your screens serve ads.
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12, paddingHorizontal: 0 },
  kpis: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  infoCard: { marginBottom: 16 },
  infoTitle: { fontSize: 15, color: C.text, marginBottom: 8 },
  infoText: { fontSize: 13, color: C.textSub, lineHeight: 20 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/(tabs)/more/analytics.jsx
git commit -m "feat(mobile): add analytics screen"
```

---

### Task 6: Advertisers screen

**Files:**
- Create: `mobile/app/(tabs)/more/advertisers.jsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/more/advertisers.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useScreens } from '../../../hooks/useScreens';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Btn } from '../../../components/ui/Btn';
import { C, F } from '../../../lib/tokens';

export default function AdvertisersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { screens } = useScreens(profile?.id);
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    async function load() {
      setLoading(true);
      const screenIds = screens.map(s => s.id);
      if (screenIds.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from('campaign_screens')
        .select('status, campaign:campaigns(id, name, budget, advertiser:profiles(id, full_name, email))')
        .in('screen_id', screenIds)
        .in('status', ['approved', 'pending']);

      // Group by advertiser
      const byAdvertiser = {};
      (data || []).forEach(cs => {
        const adv = cs.campaign?.advertiser;
        if (!adv) return;
        if (!byAdvertiser[adv.id]) byAdvertiser[adv.id] = { ...adv, campaigns: [], approved: 0, pending: 0 };
        byAdvertiser[adv.id].campaigns.push(cs.campaign?.name);
        if (cs.status === 'approved') byAdvertiser[adv.id].approved++;
        if (cs.status === 'pending') byAdvertiser[adv.id].pending++;
      });
      setAdvertisers(Object.values(byAdvertiser));
      setLoading(false);
    }
    load();
  }, [profile?.id, screens]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        ListHeaderComponent={() => (
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Btn variant="ghost" onPress={() => router.back()} style={{ paddingHorizontal: 0, marginBottom: 12 }}>← Back</Btn>
            <PageHeader title="Advertisers" subtitle="Brands running on your screens" />
          </View>
        )}
        data={advertisers}
        keyExtractor={a => a.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10, padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[{ fontFamily: F.sansSemi, fontSize: 15, color: C.text, flex: 1 }]} numberOfLines={1}>{item.full_name}</Text>
              {item.pending > 0 && <Badge label={`${item.pending} pending`} variant="amber" />}
            </View>
            <Text style={[{ fontFamily: F.sans, fontSize: 12, color: C.textSub }]}>{item.email}</Text>
            <Text style={[{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 }]}>
              {item.approved} approved · {item.campaigns.slice(0, 2).join(', ')}{item.campaigns.length > 2 ? '…' : ''}
            </Text>
          </Card>
        )}
        ListEmptyComponent={() =>
          loading ? <ActivityIndicator color={C.purple} style={{ margin: 40 }} /> : (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>No advertisers yet</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/(tabs)/more/advertisers.jsx
git commit -m "feat(mobile): add advertisers screen"
```

---

### Task 7: Billing screen

**Files:**
- Create: `mobile/app/(tabs)/more/billing.jsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/more/billing.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../../components/ui/Card';
import { Btn } from '../../../components/ui/Btn';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { C, F } from '../../../lib/tokens';

const SUPABASE_FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

export default function BillingScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [connectStatus, setConnectStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('stripe_connect_id, payout_enabled, default_currency')
        .eq('id', profile.id)
        .single();
      setConnectStatus(data);
      setLoading(false);
    }
    load();
  }, [profile?.id]);

  async function handleConnectStripe() {
    setConnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ returnUrl: 'adgrid://billing', state: Math.random().toString(36) }),
      });
      const { url } = await res.json();
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', 'Could not connect to Stripe. Try again.');
    }
    setConnecting(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title="Billing" subtitle="Payout settings and history" />

        {loading ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : (
          <>
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Stripe Payout Account</Text>
              {connectStatus?.payout_enabled ? (
                <>
                  <Badge label="Connected" variant="green" />
                  <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                    Currency: {(connectStatus.default_currency || 'CAD').toUpperCase()}
                  </Text>
                </>
              ) : (
                <>
                  <Badge label="Not connected" variant="amber" />
                  <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                    Connect Stripe to receive payouts from approved campaigns.
                  </Text>
                  <Btn onPress={handleConnectStripe} loading={connecting} size="lg" style={{ marginTop: 14 }}>
                    Connect Stripe →
                  </Btn>
                </>
              )}
            </Card>

            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Payout rate</Text>
              <Text style={[styles.cardSub, { fontFamily: F.sans }]}>
                You receive 70% of the campaign budget for each approved ad on your screens. Payouts are processed monthly.
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12, paddingHorizontal: 0 },
  card: { marginBottom: 16, gap: 8 },
  cardTitle: { fontSize: 15, color: C.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: C.textSub, lineHeight: 20, marginTop: 4 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/(tabs)/more/billing.jsx
git commit -m "feat(mobile): add billing screen with Stripe Connect status"
```

---

### Task 8: Settings screen

**Files:**
- Create: `mobile/app/(tabs)/more/settings.jsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/more/settings.jsx`**

```jsx
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Inp } from '../../../components/ui/Inp';
import { Btn } from '../../../components/ui/Btn';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { C, F } from '../../../lib/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, fetchProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setError(''); setSaving(true);
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', profile.id);
    setSaving(false);
    if (err) setError(err.message);
    else { setSuccess(true); setTimeout(() => setSuccess(false), 2000); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title="Settings" subtitle="Your account preferences" />

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Profile</Text>
          <ErrorBanner message={error} />
          {success && (
            <View style={styles.successBanner}>
              <Text style={[{ fontFamily: F.sans, color: C.green, fontSize: 13 }]}>✓ Saved</Text>
            </View>
          )}
          <Inp label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <Inp label="Email" value={profile?.email || ''} onChangeText={() => {}} editable={false} />
          <Btn onPress={handleSave} loading={saving}>Save changes</Btn>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Account</Text>
          <Text style={[styles.infoText, { fontFamily: F.sans }]}>
            To delete your account or change your email, contact support at support@adgrid.io
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12, paddingHorizontal: 0 },
  card: { marginBottom: 16 },
  cardTitle: { fontSize: 15, color: C.text, marginBottom: 12 },
  infoText: { fontSize: 13, color: C.textSub, lineHeight: 20 },
  successBanner: { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 8, padding: 10, marginBottom: 12 },
});
```

- [ ] **Step 2: Run all tests**

```bash
cd mobile && pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/more/settings.jsx
git commit -m "feat(mobile): add settings screen with profile editing"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full test run**

```bash
cd mobile && pnpm test -- --coverage
```

Expected: all tests pass. Coverage report generated.

- [ ] **Step 2: Run Expo in simulator**

```bash
cd mobile && pnpm ios
```

Walk through all flows:
1. Login → Dashboard KPIs load
2. Screens tab → list, tap card → detail, FAB → wizard all 5 steps
3. Approvals tab → pending queue, approve one, reject one with reason
4. Revenue tab → earnings with period filter
5. More → Analytics, Advertisers, Billing, Settings
6. Settings → edit name → save
7. More → Sign out → login screen

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat(mobile): complete operator mobile app — full operator feature parity"
```

---

**Plan 4 complete. All plans complete.** Full operator parity on mobile: dashboard, screens, registration wizard, approval queue with push notifications, revenue, analytics, advertisers, billing, settings.
