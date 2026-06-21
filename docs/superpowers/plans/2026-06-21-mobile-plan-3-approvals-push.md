# Operator Mobile App — Plan 3: Approvals + Push Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plan 1 complete. App running with auth and tab shell.

**Goal:** Implement the Approvals tab with real-time ad approval queue, approve/reject actions, and push notifications that deliver when a new ad is pending on an operator's screen.

**Architecture:** `useApprovals` hook owns Supabase queries + real-time channel subscription for `campaign_screens`. `usePushNotifications` hook registers the device's Expo push token in `push_tokens` table on login. The existing `notification-cron` edge function is extended to dispatch Expo push notifications. Approval badge count in tab bar is driven by pending count from `useApprovals`.

**Tech Stack:** `expo-notifications`, `@testing-library/react-native`, Supabase real-time channels, Supabase edge function (Deno/TypeScript)

---

## File Map

**New files — mobile:**
- `mobile/hooks/useApprovals.js` — fetch pending approvals, approve/reject actions, real-time subscription
- `mobile/hooks/usePushNotifications.js` — register Expo token, handle foreground notification taps
- `mobile/components/approvals/ApprovalCard.jsx` — single pending ad card with approve/reject UI
- `mobile/app/(tabs)/approvals.jsx` — Approvals screen (replaces placeholder)
- Modified: `mobile/app/(tabs)/_layout.jsx` — wire badge count to pending approvals

**New files — database:**
- `supabase/migrations/20260621000000_push_tokens.sql` — `push_tokens` table

**Modified files — edge function:**
- `supabase/functions/notification-cron/index.ts` — add Expo push dispatch for pending campaign_screens

**Tests:**
- `mobile/__tests__/hooks/useApprovals.test.js`
- `mobile/__tests__/approvals/ApprovalCard.test.jsx`

---

### Task 1: push_tokens database migration

**Files:**
- Create: `supabase/migrations/20260621000000_push_tokens.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260621000000_push_tokens.sql
create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  expo_token  text not null,
  created_at  timestamptz not null default now(),
  unique (operator_id, expo_token)
);

alter table public.push_tokens enable row level security;

create policy "Operators manage own tokens"
  on public.push_tokens
  using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

create index on public.push_tokens (operator_id);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Or apply via Supabase MCP:

```
apply_migration(name: "push_tokens", query: <contents of the SQL above>)
```

Expected: migration applies without error. `push_tokens` table appears in Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260621000000_push_tokens.sql
git commit -m "feat(db): add push_tokens table for expo push notification tokens"
```

---

### Task 2: usePushNotifications hook

**Files:**
- Create: `mobile/hooks/usePushNotifications.js`

- [ ] **Step 1: Add expo-notifications mock**

Add to `mobile/__mocks__/expo-notifications.js`:

```js
module.exports = {
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test-token]' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
};
```

- [ ] **Step 2: Create `mobile/hooks/usePushNotifications.js`**

```js
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(operatorId, onNotificationTap) {
  useEffect(() => {
    if (!operatorId) return;
    let responseListener;
    let receivedListener;

    async function register() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const { data: token } = await Notifications.getExpoPushTokenAsync();
      if (!token) return;

      // Upsert token — safe to call multiple times
      await supabase.from('push_tokens').upsert(
        { operator_id: operatorId, expo_token: token },
        { onConflict: 'operator_id,expo_token' }
      );
    }

    register();

    receivedListener = Notifications.addNotificationReceivedListener(() => {
      // App is foregrounded — notification received silently, UI updates via real-time subscription
    });

    responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      // User tapped notification — navigate to approvals
      if (onNotificationTap) onNotificationTap(response);
    });

    return () => {
      receivedListener?.remove();
      responseListener?.remove();
    };
  }, [operatorId]);

  async function deregister(operatorId) {
    const { data: token } = await Notifications.getExpoPushTokenAsync().catch(() => ({ data: null }));
    if (token) {
      await supabase.from('push_tokens')
        .delete()
        .eq('operator_id', operatorId)
        .eq('expo_token', token);
    }
  }

  return { deregister };
}
```

- [ ] **Step 3: Wire usePushNotifications into `mobile/app/(tabs)/_layout.jsx`**

Read `mobile/app/(tabs)/_layout.jsx` (created in Plan 1) and add push notification registration:

```jsx
// Add to imports
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

// Add inside TabsLayout() before the return:
const { profile } = useAuth();
const router = useRouter();
usePushNotifications(profile?.id, () => router.push('/(tabs)/approvals'));
```

- [ ] **Step 4: Commit**

```bash
git add mobile/__mocks__/expo-notifications.js mobile/hooks/usePushNotifications.js mobile/app/(tabs)/_layout.jsx
git commit -m "feat(mobile): add push notification registration via usePushNotifications"
```

---

### Task 3: useApprovals hook

**Files:**
- Create: `mobile/hooks/useApprovals.js`
- Test: `mobile/__tests__/hooks/useApprovals.test.js`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/hooks/useApprovals.test.js`:

```js
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useApprovals } from '../../hooks/useApprovals';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

const pendingRow = {
  id: 'cs-1',
  status: 'pending',
  screen_id: 's-1',
  campaign_id: 'c-1',
  screen: { id: 's-1', name: 'Lobby', operator_id: 'op-1' },
  campaign: { id: 'c-1', name: 'Test Campaign', budget: 1000, start_when: 'all', advertiser: { full_name: 'Acme Inc' }, creatives: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [pendingRow], error: null }),
    update: jest.fn().mockReturnThis(),
  });
});

describe('useApprovals', () => {
  it('loads pending approvals for operator screens', async () => {
    const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pendingCount).toBe(1);
  });

  it('returns empty when no screenIds', async () => {
    const { result } = renderHook(() => useApprovals('op-1', []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pending).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/hooks/useApprovals.test.js
```

Expected: FAIL — "Cannot find module '../../hooks/useApprovals'"

- [ ] **Step 3: Create `mobile/hooks/useApprovals.js`**

```js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const CAMPAIGN_SCREENS_SELECT = `
  id, status, screen_id, campaign_id, approved_at,
  screen:screens(id, name, operator_id),
  campaign:campaigns(
    id, name, budget, start_when, start_date, end_date,
    advertiser:profiles(full_name),
    creatives(id, type, url, headline)
  )
`;

export function useApprovals(operatorId, screenIds) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPending = useCallback(async () => {
    if (!operatorId || !screenIds || screenIds.length === 0) {
      setPending([]); setLoading(false); return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('campaign_screens')
      .select(CAMPAIGN_SCREENS_SELECT)
      .in('screen_id', screenIds)
      .eq('status', 'pending');
    if (err) setError(err.message);
    else setPending(data || []);
    setLoading(false);
  }, [operatorId, JSON.stringify(screenIds)]);

  useEffect(() => {
    fetchPending();

    if (!screenIds || screenIds.length === 0) return;

    // Real-time: listen for new pending campaign_screens
    const channel = supabase
      .channel(`approvals-${operatorId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaign_screens',
        filter: `screen_id=in.(${screenIds.join(',')})`,
      }, () => fetchPending())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPending]);

  async function approve(campaignScreenId, campaignId, startWhen) {
    await supabase
      .from('campaign_screens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', campaignScreenId);

    if (startWhen === 'partial') {
      await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaignId);
    }
    setPending(prev => prev.filter(p => p.id !== campaignScreenId));
  }

  async function reject(campaignScreenId, reason) {
    await supabase
      .from('campaign_screens')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', campaignScreenId);
    setPending(prev => prev.filter(p => p.id !== campaignScreenId));
  }

  return {
    pending,
    loading,
    error,
    pendingCount: pending.length,
    approve,
    reject,
    refetch: fetchPending,
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/hooks/useApprovals.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/hooks/useApprovals.js mobile/__tests__/hooks/useApprovals.test.js
git commit -m "feat(mobile): add useApprovals hook with real-time subscription"
```

---

### Task 4: ApprovalCard component

**Files:**
- Create: `mobile/components/approvals/ApprovalCard.jsx`
- Test: `mobile/__tests__/approvals/ApprovalCard.test.jsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/approvals/ApprovalCard.test.jsx`:

```jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ApprovalCard } from '../../components/approvals/ApprovalCard';

const mockRow = {
  id: 'cs-1',
  screen_id: 's-1',
  campaign_id: 'c-1',
  screen: { name: 'Lobby Screen' },
  campaign: {
    name: 'Spring Sale',
    budget: 500,
    start_when: 'all',
    advertiser: { full_name: 'Acme Inc' },
    creatives: [{ id: 'cr-1', type: 'image', url: 'https://example.com/img.jpg', headline: 'Save 20%' }],
  },
};

describe('ApprovalCard', () => {
  it('renders campaign name and advertiser', () => {
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(getByText('Spring Sale')).toBeTruthy();
    expect(getByText('Acme Inc')).toBeTruthy();
  });

  it('calls onApprove when Approve pressed', () => {
    const onApprove = jest.fn();
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={onApprove} onReject={jest.fn()} />);
    fireEvent.press(getByText('Approve'));
    expect(onApprove).toHaveBeenCalled();
  });

  it('shows reject reason picker when Reject pressed', () => {
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={jest.fn()} />);
    fireEvent.press(getByText('Reject'));
    expect(getByText('Inappropriate content')).toBeTruthy();
  });

  it('calls onReject with reason when confirmed', () => {
    const onReject = jest.fn();
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={onReject} />);
    fireEvent.press(getByText('Reject'));
    fireEvent.press(getByText('Confirm Rejection'));
    expect(onReject).toHaveBeenCalledWith('Inappropriate content');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/approvals/ApprovalCard.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Create `mobile/components/approvals/ApprovalCard.jsx`**

```jsx
import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { Btn } from '../ui/Btn';
import { Badge } from '../ui/Badge';
import { C, F } from '../../lib/tokens';

const REJECT_REASONS = [
  'Inappropriate content',
  'Competitor brand',
  'Not relevant to my venue',
  'Other',
];

const SCREEN_SHARE = 0.70;

export function ApprovalCard({ row, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [acting, setActing] = useState(false);

  const creative = row.campaign?.creatives?.[0];
  const estimatedRevenue = ((row.campaign?.budget || 0) * SCREEN_SHARE).toFixed(2);

  async function handleApprove() {
    setActing(true);
    await onApprove();
    setActing(false);
  }

  async function handleReject() {
    setActing(true);
    await onReject(reason);
    setActing(false);
    setRejecting(false);
  }

  return (
    <Card style={styles.card}>
      {/* Creative preview */}
      {creative?.url && (
        <Image source={{ uri: creative.url }} style={styles.creative} resizeMode="cover" />
      )}

      <View style={styles.body}>
        {/* Header row */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.campaignName, { fontFamily: F.sansSemi }]} numberOfLines={1}>
              {row.campaign?.name}
            </Text>
            <Text style={[styles.advertiser, { fontFamily: F.sans }]}>
              {row.campaign?.advertiser?.full_name}
            </Text>
          </View>
          <Badge label={`~$${estimatedRevenue}`} variant="green" />
        </View>

        {/* Screen + headline */}
        <View style={styles.meta}>
          <Text style={[styles.metaText, { fontFamily: F.sans }]}>📺 {row.screen?.name}</Text>
          {creative?.headline && (
            <Text style={[styles.metaText, { fontFamily: F.sans }]}>💬 "{creative.headline}"</Text>
          )}
        </View>

        {/* Actions */}
        {!rejecting ? (
          <View style={styles.actions}>
            <Btn variant="danger" onPress={() => setRejecting(true)} style={{ flex: 1 }}>Reject</Btn>
            <Btn onPress={handleApprove} loading={acting} style={{ flex: 1 }}>Approve</Btn>
          </View>
        ) : (
          <View style={styles.rejectSection}>
            <Text style={[styles.rejectLabel, { fontFamily: F.sansMed }]}>Reason for rejection</Text>
            {REJECT_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setReason(r)}
                style={[styles.reasonOption, { borderColor: reason === r ? C.red : C.border, backgroundColor: reason === r ? C.redSoft : C.surface }]}
              >
                <Text style={[styles.reasonText, { fontFamily: F.sans, color: reason === r ? C.red : C.textSub }]}>{r}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.actions}>
              <Btn variant="secondary" onPress={() => setRejecting(false)} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="danger" onPress={handleReject} loading={acting} style={{ flex: 1 }}>Confirm Rejection</Btn>
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', marginBottom: 16 },
  creative: { width: '100%', height: 160 },
  body: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  campaignName: { fontSize: 15, color: C.text, marginBottom: 2 },
  advertiser: { fontSize: 12, color: C.textSub },
  meta: { gap: 4, marginBottom: 14 },
  metaText: { fontSize: 12, color: C.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectSection: { marginTop: 4 },
  rejectLabel: { fontSize: 13, color: C.textMid, marginBottom: 8 },
  reasonOption: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 6 },
  reasonText: { fontSize: 13 },
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/approvals/ApprovalCard.test.jsx
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/components/approvals/ mobile/__tests__/approvals/
git commit -m "feat(mobile): add ApprovalCard component with reject reason picker"
```

---

### Task 5: Approvals screen + tab badge

**Files:**
- Modify: `mobile/app/(tabs)/approvals.jsx` (replace placeholder)
- Modify: `mobile/app/(tabs)/_layout.jsx` (add badge count)

- [ ] **Step 1: Replace `mobile/app/(tabs)/approvals.jsx`**

```jsx
import { View, FlatList, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useScreens } from '../../hooks/useScreens';
import { useApprovals } from '../../hooks/useApprovals';
import { ApprovalCard } from '../../components/approvals/ApprovalCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { C, F } from '../../lib/tokens';

export default function ApprovalsScreen() {
  const { profile } = useAuth();
  const { screens } = useScreens(profile?.id);
  const screenIds = screens.map(s => s.id);
  const { pending, loading, approve, reject } = useApprovals(profile?.id, screenIds);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.container}>
        <PageHeader
          title="Approvals"
          subtitle={pending.length > 0 ? `${pending.length} ad${pending.length !== 1 ? 's' : ''} awaiting your review` : 'All caught up'}
        />

        {loading ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : pending.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={[styles.emptyTitle, { fontFamily: F.sansBold }]}>All caught up</Text>
            <Text style={[styles.emptySub, { fontFamily: F.sans }]}>No ads pending approval</Text>
          </View>
        ) : (
          <FlatList
            data={pending}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ApprovalCard
                row={item}
                onApprove={() => approve(item.id, item.campaign_id, item.campaign?.start_when)}
                onReject={(reason) => reject(item.id, reason)}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, color: C.text },
  emptySub: { fontSize: 14, color: C.textSub },
});
```

- [ ] **Step 2: Add badge count to tab layout**

The tab layout needs to know the pending count. Add a shared context for this. Modify `mobile/app/(tabs)/_layout.jsx`:

```jsx
// Add these imports at the top:
import { useScreens } from '../../hooks/useScreens';
import { useApprovals } from '../../hooks/useApprovals';

// Add inside TabsLayout(), after the existing useAuth/usePushNotifications lines:
const { screens } = useScreens(profile?.id);
const screenIds = screens.map(s => s.id);
const { pendingCount } = useApprovals(profile?.id, screenIds);

// Then update the Approvals tab Tabs.Screen:
<Tabs.Screen
  name="approvals"
  options={{
    title: 'Approvals',
    tabBarIcon: ({ focused }) => <TabIcon icon="✅" label="Approvals" focused={focused} badgeCount={pendingCount} />,
  }}
/>
```

- [ ] **Step 3: Verify in Expo Go**

1. Log in → Approvals tab shows pending queue
2. Approve an ad → card disappears, badge count decrements
3. Reject an ad → reason picker appears, confirm → card disappears
4. When queue is empty → "All caught up" empty state

- [ ] **Step 4: Commit**

```bash
git add mobile/app/(tabs)/approvals.jsx mobile/app/(tabs)/_layout.jsx
git commit -m "feat(mobile): implement approvals screen with real-time queue and tab badge"
```

---

### Task 6: Update notification-cron to send Expo push notifications

**Files:**
- Modify: `supabase/functions/notification-cron/index.ts`

- [ ] **Step 1: Read existing notification-cron**

Read `supabase/functions/notification-cron/index.ts` to understand the current structure before editing.

- [ ] **Step 2: Add Expo push dispatch function**

Add this helper function inside `supabase/functions/notification-cron/index.ts`, before the main handler:

```typescript
async function sendExpoPushToOperator(
  supabaseClient: ReturnType<typeof createClient>,
  operatorId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const { data: tokens } = await supabaseClient
    .from("push_tokens")
    .select("expo_token")
    .eq("operator_id", operatorId);

  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map(({ expo_token }) => ({
    to: expo_token,
    sound: "default",
    title,
    body,
    data,
  }));

  // Expo Push API — no auth needed for Expo managed push
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(messages),
  });
}
```

- [ ] **Step 3: Call sendExpoPushToOperator when a campaign_screen becomes pending**

In the main cron handler, find where campaigns are processed or newly scheduled. After any `campaign_screens` row is inserted/updated to `status = 'pending'`, call:

```typescript
// After inserting/setting a campaign_screen to pending:
// Determine the operator_id from the screen
const { data: screen } = await supabase
  .from("screens")
  .select("operator_id, name")
  .eq("id", screenId)
  .single();

if (screen) {
  await sendExpoPushToOperator(
    supabase,
    screen.operator_id,
    "New ad awaiting approval",
    `An ad is waiting for your review on ${screen.name}`,
    { screen: "approvals" }
  );
}
```

Note: the exact insertion point depends on the existing cron logic. Read the file first (Step 1), then insert after the point where `campaign_screens` status is set to `'pending'`.

- [ ] **Step 4: Deploy updated edge function**

```bash
npx supabase functions deploy notification-cron
```

Expected: deploys without error.

- [ ] **Step 5: Smoke test**

Trigger a campaign that adds screens (or manually insert a `campaign_screens` row with `status='pending'` for a screen you own). Verify Expo push notification arrives on device within 30 seconds.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/notification-cron/index.ts
git commit -m "feat(notifications): send Expo push to operator when ad pending approval"
```

---

**Plan 3 complete.** Operators receive push notifications when ads need review, can approve or reject from the mobile app in real-time, and the tab badge reflects the current pending count.
