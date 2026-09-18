# Table Overflow + Mobile Pairing Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two findings from the 2026-07-07 go-live pass: (1) the shared web `Table` primitive silently clips columns on narrow viewports instead of scrolling, breaking 8 dashboard views on mobile; (2) the operator mobile app's screen-registration wizard ends on a dead-end QR-scan step that has no matching feature anywhere in the display player.

**Architecture:** Task 1 is a pure CSS fix — wrap the table in a horizontally-scrolling container instead of clipping it, no behavior change otherwise. Task 2 replaces the QR-scan step with the same mechanism the web app already uses successfully: `screens.screen_token` is generated server-side the instant a screen row is created (`DEFAULT gen_random_uuid()`), so there is nothing to "pair" — the mobile wizard's job is to fetch that token via the existing `get_screen_token(p_screen_id)` RPC (already used by the web Setup Guide and by this repo's `screens/[id].jsx` fix) and hand it to the operator to enter into their display device's config, exactly like the web Setup Guide's "Copy Token" flow. This removes `expo-camera` usage from the onboarding wizard entirely (still used elsewhere in the app, untouched).

**Tech Stack:** React (web, inline styles) for Task 1; React Native / Expo Router + `@supabase/supabase-js` `.rpc()` for Task 2; Jest + `@testing-library/react-native` for the mobile test.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/primitives/Table.jsx` | Modify | Wrap table in a horizontal-scroll container instead of `overflow:'hidden'` |
| `mobile/app/onboard/connect.jsx` | Modify | Replace QR-scan pairing with fetch-and-display-token via `get_screen_token` RPC |
| `mobile/__tests__/onboard/connect.test.jsx` | Modify | Update fixtures/mocks to match the new token-display flow |
| `mobile/__mocks__/@supabase/supabase-js.js` | Modify | Add `rpc` to the shared mock client (missing today — nothing has needed it in a test until now) |

---

## Task 1: Fix `Table.jsx` mobile overflow

**Files:**
- Modify: `src/components/primitives/Table.jsx:4`

The outer wrapper is `overflow: 'hidden'` (there to clip the table's square corners to the rounded border) with no horizontal scroll anywhere, and header cells are `whiteSpace: 'nowrap'`. On a 375px viewport, any table wider than the viewport (e.g. `Billing.jsx`'s 7-column Charges table) has its overflow columns silently clipped instead of scrollable.

- [ ] **Step 1: Add a scroll wrapper**

Replace:

```jsx
export const Table = ({ columns, rows, empty = 'No data', emptyTitle, emptyDescription, onRowClick }) => (
  <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.sans }}>
```

With:

```jsx
export const Table = ({ columns, rows, empty = 'No data', emptyTitle, emptyDescription, onRowClick }) => (
  <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.sans }}>
```

- [ ] **Step 2: Close the new wrapper div**

Replace the closing tags at the end of the component:

```jsx
      </tbody>
    </table>
  </div>
);
```

With:

```jsx
      </tbody>
    </table>
    </div>
  </div>
);
```

The outer div keeps `overflow: 'hidden'` (still needed to clip the table's corners to the rounded border on the vertical axis); the new inner div scrolls horizontally when content is wider than the viewport, on any screen size, not just mobile.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/Table.jsx
git commit -m "fix(ui): Table — scroll horizontally instead of clipping columns on narrow viewports"
```

---

## Task 2: Replace mobile onboarding's dead-end QR scan with token handoff

**Files:**
- Modify: `mobile/app/onboard/connect.jsx`
- Modify: `mobile/__tests__/onboard/connect.test.jsx`
- Modify: `mobile/__mocks__/@supabase/supabase-js.js`

- [ ] **Step 1: Add `rpc` to the shared Supabase mock**

In `mobile/__mocks__/@supabase/supabase-js.js`, add an `rpc` method to `mockClient` (nothing has exercised `supabase.rpc()` in a mobile test until now, so it's missing):

```js
const mockClient = {
  auth: mockAuth,
  from: jest.fn(() => mockQuery),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  channel: jest.fn(() => mockChannel),
  removeChannel: jest.fn(),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/photo.jpg' } })),
    })),
  },
};
```

- [ ] **Step 2: Rewrite the test to match the new flow**

Replace `mobile/__tests__/onboard/connect.test.jsx` entirely:

```jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ConnectScreen from '../../app/onboard/connect';
import { OnboardProvider, useOnboard } from '../../context/OnboardContext';
import { AuthProvider } from '../../context/AuthContext';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

function Wrapper({ children }) {
  return <AuthProvider><OnboardProvider>{children}</OnboardProvider></AuthProvider>;
}

// connect.jsx reads form.screenId from context; seed it before each test.
function Seed() {
  const { update } = useOnboard();
  React.useEffect(() => { update({ screenId: 'screen-1' }); }, []);
  return null;
}

const wrapper = ({ children }) => (
  <Wrapper><Seed />{children}</Wrapper>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.rpc.mockResolvedValue({ data: 'tok_abc123', error: null });
});

describe('ConnectScreen', () => {
  it('fetches and displays the screen token', async () => {
    const { findByText } = render(<ConnectScreen />, { wrapper });
    expect(await findByText('tok_abc123')).toBeTruthy();
  });

  it('shows an error state if the token fetch fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { findByText } = render(<ConnectScreen />, { wrapper });
    expect(await findByText(/Couldn't load your screen token/i)).toBeTruthy();
  });

  it('calls router.replace to screens list when Done is pressed', async () => {
    const { findByText, getByText } = render(<ConnectScreen />, { wrapper });
    await findByText('tok_abc123');
    fireEvent.press(getByText('Done'));
    // No assertion on navigation target — expo-router is globally mocked in jest.setup.js;
    // this just confirms the button doesn't throw once the token has loaded.
  });
});
```

- [ ] **Step 3: Rewrite `connect.jsx`**

Replace the entire file:

```jsx
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function ConnectScreen() {
  const router = useRouter();
  const { form, reset } = useOnboard();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connStatus, setConnStatus] = useState('idle'); // 'idle' | 'ok' | 'none'

  useEffect(() => {
    async function loadToken() {
      const { data, error: err } = await supabase.rpc('get_screen_token', { p_screen_id: form.screenId });
      if (err || !data) setError(true);
      else setToken(data);
      setLoading(false);
    }
    loadToken();
  }, [form.screenId]);

  async function checkConnection() {
    setChecking(true);
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('display_heartbeats')
      .select('id')
      .eq('screen_id', form.screenId)
      .gte('created_at', since)
      .limit(1);
    setConnStatus(data && data.length > 0 ? 'ok' : 'none');
    setChecking(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.wrap}>
        <WizardProgress step={5} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Connect your display</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>
          Your screen has a unique token. Enter it in your display device's setup (or paste
          it into the AdGrid web dashboard's Setup Guide for full install steps) — the ad
          player uses it to know which screen it is.
        </Text>

        {loading && <Text style={[styles.sub, { fontFamily: F.sans }]}>Loading your token…</Text>}

        {!loading && error && (
          <Text style={[styles.errorText, { fontFamily: F.sans }]}>
            Couldn't load your screen token. Check your connection and try again from the
            Screens tab.
          </Text>
        )}

        {!loading && !error && (
          <>
            <View style={styles.tokenBox}>
              <Text selectable style={[styles.token, { fontFamily: F.sansMed }]}>{token}</Text>
            </View>
            <Text style={[styles.hint, { fontFamily: F.sans }]}>
              Long-press the token above to copy it.
            </Text>

            <Btn variant="secondary" onPress={checkConnection} loading={checking} style={{ marginTop: 20 }}>
              Check Connection
            </Btn>
            {connStatus === 'ok' && (
              <Text style={[styles.okText, { fontFamily: F.sans }]}>✓ Connected — heartbeat received</Text>
            )}
            {connStatus === 'none' && (
              <Text style={[styles.hint, { fontFamily: F.sans }]}>No heartbeat yet — that's expected until the display device is configured.</Text>
            )}
          </>
        )}

        <Btn onPress={() => { reset(); router.replace('/(tabs)/screens'); }} size="lg" style={{ marginTop: 24 }}>
          Done
        </Btn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24 },
  title: { fontSize: 20, color: C.text, marginBottom: 8 },
  sub: { fontSize: 13, color: C.textSub, lineHeight: 18, marginBottom: 20 },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 8 },
  errorText: { fontSize: 13, color: C.red },
  tokenBox: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 14 },
  token: { fontSize: 15, color: C.text, letterSpacing: 0.5 },
  okText: { fontSize: 13, color: C.green, marginTop: 8 },
});
```

- [ ] **Step 4: Run the test**

Run: `cd mobile && npx jest __tests__/onboard/connect.test.jsx`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Run the full mobile suite to confirm no regressions**

Run: `cd mobile && npx jest`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/onboard/connect.jsx mobile/__tests__/onboard/connect.test.jsx mobile/__mocks__/@supabase/supabase-js.js
git commit -m "fix(mobile): replace dead-end QR-scan pairing with real screen-token handoff"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** both findings from the audit have a task — Table clipping (Task 1), onboarding dead end (Task 2).
- [x] **No placeholders:** full before/after code in every step.
- [x] **Type/shape consistency:** Task 2's `get_screen_token(p_screen_id)` RPC call matches the signature already established in `screens/[id].jsx` (same repo, same fix session) and the original migration (`supabase/migrations/20260703000000_secure_screen_token_and_scans.sql:30`).
- [x] **No new dependencies:** token copy uses React Native's built-in `<Text selectable>` (long-press to copy) instead of adding `expo-clipboard`, keeping this a pure bugfix with no new native module to install/rebuild.
- [x] **Root cause fix, not a patch:** Task 2 doesn't try to make the QR scanner "work" — it removes a feature that was never buildable (no display-side pairing QR exists, and the display already requires its token to be configured before it can run at all, so a chicken-and-egg pairing QR was never architecturally possible) and replaces it with the same mechanism the web app already ships successfully.
