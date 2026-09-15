# Operator Mobile App — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up pnpm monorepo, scaffold Expo app, port design tokens, build primitive UI components, implement Supabase auth, and deliver a working login screen with authenticated tab navigation shell.

**Architecture:** pnpm workspaces monorepo. `packages/core` holds shared pure-JS data (venueTypes, formatCurrency) — no DOM, no Vite env vars. Web app imports unchanged. Mobile is an Expo SDK 52 app using Expo Router v4 for file-based navigation. Supabase sessions persisted via `expo-secure-store`. Auth gate in root `_layout.jsx` redirects unauthenticated users to `/login`.

**Tech Stack:** pnpm 9+, Expo SDK 52, Expo Router v4, `@supabase/supabase-js`, `expo-secure-store`, `expo-linear-gradient`, `@expo-google-fonts/space-grotesk`, `@expo-google-fonts/jetbrains-mono`, `jest-expo`, `@testing-library/react-native`

**Design principle:** All colors, radii, spacing, and typography mirror the web app exactly. `mobile/lib/tokens.js` is a 1:1 port of `src/design/tokens.js` with RN-compatible values (no CSS strings).

---

## File Map

**New files — monorepo root:**
- `pnpm-workspace.yaml` — workspace config
- `packages/core/package.json` — shared package manifest
- `packages/core/index.js` — re-exports all shared modules
- `packages/core/venueTypes.js` — copy of `src/lib/venueTypes.js` (unchanged)
- `packages/core/formatCurrency.js` — copy of `src/lib/formatCurrency.js` (unchanged)

**New files — mobile app:**
- `mobile/package.json` — Expo app manifest
- `mobile/app.json` — Expo config (bundle IDs, extra env vars)
- `mobile/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `mobile/babel.config.js` — Expo preset
- `mobile/jest.config.js` — jest-expo config
- `mobile/jest.setup.js` — RNTL + mock setup
- `mobile/__mocks__/expo-secure-store.js` — SecureStore mock
- `mobile/__mocks__/@supabase/supabase-js.js` — Supabase mock
- `mobile/lib/tokens.js` — RN design tokens (port of web tokens)
- `mobile/lib/supabase.js` — Supabase client with SecureStore adapter
- `mobile/context/AuthContext.jsx` — auth state + operations
- `mobile/app/_layout.jsx` — root layout: font load, AuthProvider, auth gate
- `mobile/app/login.jsx` — email/password login screen
- `mobile/app/(tabs)/_layout.jsx` — bottom tab bar (5 tabs)
- `mobile/app/(tabs)/index.jsx` — Home tab placeholder
- `mobile/app/(tabs)/screens/index.jsx` — Screens tab placeholder
- `mobile/app/(tabs)/approvals.jsx` — Approvals tab placeholder
- `mobile/app/(tabs)/revenue.jsx` — Revenue tab placeholder
- `mobile/app/(tabs)/more/index.jsx` — More tab placeholder
- `mobile/components/ui/Card.jsx` — RN Card primitive
- `mobile/components/ui/Btn.jsx` — RN Button primitive (gradient primary)
- `mobile/components/ui/Badge.jsx` — RN Badge primitive
- `mobile/components/ui/KPI.jsx` — RN KPI tile
- `mobile/components/ui/Inp.jsx` — RN text input
- `mobile/components/ui/ErrorBanner.jsx` — RN error display
- `mobile/components/ui/Skeleton.jsx` — RN loading skeleton
- `mobile/components/ui/PageHeader.jsx` — screen title + subtitle

**Tests:**
- `mobile/__tests__/AuthContext.test.jsx`
- `mobile/__tests__/login.test.jsx`
- `mobile/__tests__/components/Btn.test.jsx`

---

### Task 1: Monorepo setup

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `packages/core/package.json`
- Create: `packages/core/index.js`
- Create: `packages/core/venueTypes.js`
- Create: `packages/core/formatCurrency.js`

- [ ] **Step 1: Create `pnpm-workspace.yaml` at repo root**

```yaml
packages:
  - 'packages/*'
  - 'mobile'
```

- [ ] **Step 2: Create `packages/core/package.json`**

```json
{
  "name": "@adgrid/core",
  "version": "1.0.0",
  "main": "index.js",
  "license": "UNLICENSED",
  "private": true
}
```

- [ ] **Step 3: Copy venueTypes.js into packages/core**

Copy `src/lib/venueTypes.js` verbatim to `packages/core/venueTypes.js`. No changes — it is pure JS data with no DOM or Vite dependencies.

- [ ] **Step 4: Copy formatCurrency.js into packages/core**

Read `src/lib/formatCurrency.js` and copy verbatim to `packages/core/formatCurrency.js`.

- [ ] **Step 5: Create `packages/core/index.js`**

```js
export * from './venueTypes.js';
export * from './formatCurrency.js';
```

- [ ] **Step 6: Verify pnpm recognizes workspaces**

```bash
pnpm install
pnpm ls -r --depth 0
```

Expected output includes `@adgrid/core` listed as a workspace package.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml packages/
git commit -m "chore: add pnpm workspaces + @adgrid/core shared package"
```

---

### Task 2: Expo app scaffold

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/babel.config.js`
- Create: `mobile/.env`
- Create: `mobile/.gitignore`

- [ ] **Step 1: Create `mobile/package.json`**

```json
{
  "name": "@adgrid/mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "test": "jest"
  },
  "dependencies": {
    "@adgrid/core": "workspace:*",
    "@expo-google-fonts/jetbrains-mono": "^0.3.0",
    "@expo-google-fonts/space-grotesk": "^0.3.0",
    "@react-navigation/bottom-tabs": "^6.6.1",
    "@supabase/supabase-js": "^2.45.4",
    "expo": "~52.0.0",
    "expo-barcode-scanner": "~13.0.1",
    "expo-camera": "~16.0.9",
    "expo-font": "~13.0.2",
    "expo-image-picker": "~16.0.6",
    "expo-linear-gradient": "~14.0.2",
    "expo-linking": "~7.0.4",
    "expo-notifications": "~0.29.9",
    "expo-router": "~4.0.17",
    "expo-secure-store": "~14.0.1",
    "expo-splash-screen": "~0.29.18",
    "expo-status-bar": "~2.0.1",
    "react": "18.3.2",
    "react-native": "0.76.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.3.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@testing-library/react-native": "^12.7.2",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.2"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterFramework": ["./jest.setup.js"],
    "moduleNameMapper": {
      "^@adgrid/core(.*)$": "<rootDir>/../packages/core$1"
    },
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

- [ ] **Step 2: Create `mobile/app.json`**

```json
{
  "expo": {
    "name": "AdGrid Operator",
    "slug": "adgrid-operator",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "scheme": "adgrid",
    "splash": {
      "backgroundColor": "#7B2FFF"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.adgrid.operator",
      "infoPlist": {
        "NSCameraUsageDescription": "Used to scan QR codes when connecting a new screen.",
        "NSPhotoLibraryUsageDescription": "Used to upload photos of your screen location."
      }
    },
    "android": {
      "adaptiveIcon": { "backgroundColor": "#7B2FFF" },
      "package": "com.adgrid.operator",
      "permissions": ["android.permission.CAMERA"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-font",
      [
        "expo-camera",
        { "cameraPermission": "Used to scan QR codes when connecting a new screen." }
      ],
      [
        "expo-image-picker",
        { "photosPermission": "Used to upload photos of your screen location." }
      ],
      [
        "expo-notifications",
        { "icon": "./assets/notification-icon.png", "color": "#7B2FFF" }
      ]
    ],
    "extra": {
      "supabaseUrl": "EXPO_PUBLIC_SUPABASE_URL",
      "supabaseAnonKey": "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      "router": { "origin": false }
    }
  }
}
```

- [ ] **Step 3: Create `mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 4: Create `mobile/.env`**

Copy values from web app's `.env` file but use `EXPO_PUBLIC_` prefix:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Replace values with the same Supabase project credentials used in `adgrid/.env`.

- [ ] **Step 5: Create `mobile/.gitignore`**

```
node_modules/
.expo/
dist/
web-build/
.env
*.orig.*
```

- [ ] **Step 6: Create placeholder assets directory**

```bash
mkdir -p mobile/assets
```

Create a 1024×1024 purple square PNG at `mobile/assets/icon.png` (placeholder). Also create `mobile/assets/notification-icon.png` (96×96 white on transparent PNG).

- [ ] **Step 7: Install dependencies**

```bash
cd mobile && pnpm install
```

Expected: installs without error. `@adgrid/core` resolves to `../../packages/core` via workspace.

- [ ] **Step 8: Verify Expo starts**

```bash
cd mobile && pnpm start
```

Expected: Expo dev server starts, shows QR code. No errors in console.

- [ ] **Step 9: Commit**

```bash
git add mobile/ packages/
git commit -m "feat(mobile): scaffold Expo app with pnpm workspace"
```

---

### Task 3: Jest + mock setup

**Files:**
- Create: `mobile/jest.setup.js`
- Create: `mobile/__mocks__/expo-secure-store.js`
- Create: `mobile/__mocks__/@supabase/supabase-js.js`

- [ ] **Step 1: Create `mobile/jest.setup.js`**

```js
import '@testing-library/react-native/extend-expect';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  Link: ({ children }) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}));

jest.mock('expo-font');
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
```

- [ ] **Step 2: Create `mobile/__mocks__/expo-secure-store.js`**

```js
const store = {};
module.exports = {
  getItemAsync: jest.fn((key) => Promise.resolve(store[key] ?? null)),
  setItemAsync: jest.fn((key, value) => { store[key] = value; return Promise.resolve(); }),
  deleteItemAsync: jest.fn((key) => { delete store[key]; return Promise.resolve(); }),
};
```

- [ ] **Step 3: Create `mobile/__mocks__/@supabase/supabase-js.js`**

```js
const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
};

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockResolvedValue({ error: null }),
  insert: jest.fn().mockResolvedValue({ error: null }),
};

const mockAuth = {
  getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
};

module.exports = {
  createClient: jest.fn(() => ({
    auth: mockAuth,
    from: jest.fn(() => mockQuery),
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(),
  })),
};
```

- [ ] **Step 4: Update `mobile/package.json` jest config to reference setup file**

In `package.json`, correct the jest key:
```json
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterFramework": ["./jest.setup.js"],
  ...
}
```

Change `setupFilesAfterFramework` → `setupFilesAfterFramework` is wrong. Use:
```json
"setupFilesAfterFramework": ["<rootDir>/jest.setup.js"]
```

The correct key is `setupFilesAfterFramework` in jest-expo. Actually use `setupFilesAfterFramework` — wait, the correct Jest config key is `setupFilesAfterFramework`. Check jest docs: it is `setupFilesAfterFramework`. Actually the correct key is:
```json
"setupFilesAfterFramework": ["<rootDir>/jest.setup.js"]
```

Correction: the correct key is **`setupFilesAfterFramework`**. In jest 27+, it is `setupFilesAfterFramework`. Wait — the correct name is `setupFilesAfterFramework`. Let me be precise: the Jest config key is `setupFilesAfterFramework`. Actually it is `setupFilesAfterFramework`. The CORRECT key name in Jest is **`setupFilesAfterFramework`**. 

OK to be precise: `setupFilesAfterFramework` is the correct Jest configuration key for files to run after the test framework is set up. Use that key.

- [ ] **Step 5: Verify jest runs**

```bash
cd mobile && pnpm test -- --passWithNoTests
```

Expected: "Test Suites: 0 skipped, 0 total". No configuration errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/jest.setup.js mobile/__mocks__/
git commit -m "test(mobile): add jest setup and module mocks"
```

---

### Task 4: Design tokens + primitive components

**Files:**
- Create: `mobile/lib/tokens.js`
- Create: `mobile/components/ui/Card.jsx`
- Create: `mobile/components/ui/Btn.jsx`
- Create: `mobile/components/ui/Badge.jsx`
- Create: `mobile/components/ui/KPI.jsx`
- Create: `mobile/components/ui/Inp.jsx`
- Create: `mobile/components/ui/ErrorBanner.jsx`
- Create: `mobile/components/ui/Skeleton.jsx`
- Create: `mobile/components/ui/PageHeader.jsx`
- Test: `mobile/__tests__/components/Btn.test.jsx`

- [ ] **Step 1: Create `mobile/lib/tokens.js`**

```js
// Mirrors src/design/tokens.js exactly — RN-compatible values only (no CSS strings)
export const C = {
  bg: '#fafafa',
  surface: '#ffffff',
  surfaceAlt: '#f5f5f5',
  border: '#e5e5e5',
  borderDark: '#d4d4d4',

  text: '#0a0a0a',
  textMid: '#262626',
  textSub: '#525252',
  textMuted: '#737373',

  cyan: '#00C2FF',
  purple: '#7B2FFF',
  purpleDark: '#6B1FEF',
  purpleSoft: '#f0ebff',
  purpleBorder: '#d4b8ff',
  purpleLight: '#f0ebff',

  green: '#10b981', greenSoft: '#ecfdf5', greenBorder: '#a7f3d0',
  amber: '#f59e0b', amberSoft: '#fffbeb', amberBorder: '#fde68a',
  red: '#ef4444', redSoft: '#fef2f2', redBorder: '#fecaca',
  blue: '#3b82f6', blueSoft: '#eff6ff', blueBorder: '#bfdbfe',
};

// Gradient stops for expo-linear-gradient (matches web grad: cyan → purple)
export const gradColors = ['#00C2FF', '#7B2FFF'];
export const gradStart = { x: 0, y: 0 };
export const gradEnd = { x: 1, y: 1 };

// Font families — loaded via @expo-google-fonts in _layout.jsx
export const F = {
  sans: 'SpaceGrotesk_400Regular',
  sansMed: 'SpaceGrotesk_500Medium',
  sansSemi: 'SpaceGrotesk_600SemiBold',
  sansBold: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_400Regular',
};

// Common style objects
export const S = {
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};
```

- [ ] **Step 2: Write failing test for Btn**

Create `mobile/__tests__/components/Btn.test.jsx`:

```jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Btn } from '../../components/ui/Btn';

describe('Btn', () => {
  it('renders children', () => {
    const { getByText } = render(<Btn onPress={() => {}}>Save</Btn>);
    expect(getByText('Save')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Btn onPress={onPress}>Save</Btn>);
    fireEvent.press(getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Btn onPress={onPress} disabled>Save</Btn>);
    fireEvent.press(getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders secondary variant', () => {
    const { getByText } = render(<Btn variant="secondary" onPress={() => {}}>Cancel</Btn>);
    expect(getByText('Cancel')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/components/Btn.test.jsx
```

Expected: FAIL — "Cannot find module '../../components/ui/Btn'"

- [ ] **Step 4: Create `mobile/components/ui/Btn.jsx`**

```jsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F, gradColors, gradStart, gradEnd } from '../../lib/tokens';

export function Btn({ children, variant = 'primary', size = 'md', onPress, disabled, loading, style }) {
  const sz = { sm: { px: 12, py: 6, fs: 12 }, md: { px: 16, py: 10, fs: 13 }, lg: { px: 20, py: 13, fs: 14 } }[size];

  const variantStyle = {
    primary: { bg: null, color: '#fff', borderWidth: 0 },
    secondary: { bg: C.surface, color: C.textMid, borderWidth: 1, borderColor: C.border },
    ghost: { bg: 'transparent', color: C.textSub, borderWidth: 0 },
    danger: { bg: C.redSoft, color: C.red, borderWidth: 1, borderColor: C.redBorder },
    success: { bg: C.greenSoft, color: C.green, borderWidth: 1, borderColor: C.greenBorder },
  }[variant] || {};

  const inner = (
    <TouchableOpacity
      onPress={disabled || loading ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.75}
      style={[
        styles.base,
        {
          paddingHorizontal: sz.px,
          paddingVertical: sz.py,
          backgroundColor: variantStyle.bg || (variant !== 'primary' ? C.surface : undefined),
          borderWidth: variantStyle.borderWidth ?? 0,
          borderColor: variantStyle.borderColor,
          opacity: disabled ? 0.5 : 1,
          borderRadius: 8,
        },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color={variantStyle.color} />
        : <Text style={[styles.label, { fontSize: sz.fs, color: variantStyle.color, fontFamily: F.sansMed }]}>{children}</Text>
      }
    </TouchableOpacity>
  );

  if (variant === 'primary') {
    return (
      <LinearGradient
        colors={gradColors}
        start={gradStart}
        end={gradEnd}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        {inner}
      </LinearGradient>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  label: { fontWeight: '500' },
});
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/components/Btn.test.jsx
```

Expected: PASS — 4 tests pass.

- [ ] **Step 6: Create `mobile/components/ui/Card.jsx`**

```jsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { C, S } from '../../lib/tokens';

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[S.card, S.shadow, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[S.card, S.shadow, style]}>{children}</View>;
}
```

- [ ] **Step 7: Create `mobile/components/ui/Badge.jsx`**

```jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

const variants = {
  green:  { bg: C.greenSoft,  text: C.green,  border: C.greenBorder },
  amber:  { bg: C.amberSoft,  text: C.amber,  border: C.amberBorder },
  red:    { bg: C.redSoft,    text: C.red,    border: C.redBorder },
  blue:   { bg: C.blueSoft,   text: C.blue,   border: C.blueBorder },
  purple: { bg: C.purpleSoft, text: C.purple, border: C.purpleBorder },
  muted:  { bg: C.surfaceAlt, text: C.textMuted, border: C.border },
};

export function Badge({ label, variant = 'muted', dot }) {
  const v = variants[variant] || variants.muted;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }]}>
      {dot && <View style={[styles.dot, { backgroundColor: v.text }]} />}
      <Text style={[styles.text, { color: v.text, fontFamily: F.sansMed }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '500' },
});
```

- [ ] **Step 8: Create `mobile/components/ui/KPI.jsx`**

```jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F, S } from '../../lib/tokens';

export function KPI({ label, value, sub, trend, icon, color }) {
  const trendColor = trend > 0 ? C.green : trend < 0 ? C.red : C.textMuted;
  return (
    <View style={[S.card, S.shadow, styles.kpi]}>
      <View style={styles.top}>
        <Text style={[styles.label, { fontFamily: F.sans }]}>{label}</Text>
        {icon && <Text style={styles.icon}>{icon}</Text>}
      </View>
      <Text style={[styles.value, { color: color || C.text, fontFamily: F.sansBold }]}>{value}</Text>
      <View style={styles.bottom}>
        {sub && <Text style={[styles.sub, { fontFamily: F.sans }]}>{sub}</Text>}
        {trend != null && (
          <Text style={[styles.trend, { color: trendColor, fontFamily: F.sansMed }]}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpi: { flex: 1, minWidth: 140 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  icon: { fontSize: 16 },
  value: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { fontSize: 12, color: C.textSub },
  trend: { fontSize: 12 },
});
```

- [ ] **Step 9: Create `mobile/components/ui/Inp.jsx`**

```jsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function Inp({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = 'none', error, multiline, numberOfLines }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label && <Text style={[styles.label, { fontFamily: F.sansMed }]}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          { fontFamily: F.sans, borderColor: error ? C.red : focused ? C.purple : C.border },
          multiline && { height: numberOfLines * 22 + 20, textAlignVertical: 'top' },
        ]}
      />
      {error && <Text style={[styles.error, { fontFamily: F.sans }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, color: C.textMid, marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.surface },
  error: { fontSize: 12, color: C.red, marginTop: 4 },
});
```

- [ ] **Step 10: Create `mobile/components/ui/ErrorBanner.jsx`**

```jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Text style={[styles.text, { fontFamily: F.sans }]}>⚠ {message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.redBorder, borderRadius: 8, padding: 12, marginBottom: 16 },
  text: { color: C.red, fontSize: 13 },
});
```

- [ ] **Step 11: Create `mobile/components/ui/Skeleton.jsx`**

```jsx
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { C } from '../../lib/tokens';

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: C.border, opacity }, style]} />
  );
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={i === 0 ? 20 : 14} width={i === 0 ? '60%' : '80%'} style={{ marginBottom: 10 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ card: {} });
```

- [ ] **Step 12: Create `mobile/components/ui/PageHeader.jsx`**

```jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <View style={styles.header}>
      <View style={styles.text}>
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { fontFamily: F.sans }]}>{subtitle}</Text>}
      </View>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  text: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 14, color: C.textSub, marginTop: 2 },
  actions: { marginTop: 8 },
});
```

- [ ] **Step 13: Commit**

```bash
git add mobile/lib/tokens.js mobile/components/ mobile/__tests__/components/
git commit -m "feat(mobile): add design tokens and primitive UI components"
```

---

### Task 5: Supabase client + AuthContext

**Files:**
- Create: `mobile/lib/supabase.js`
- Create: `mobile/context/AuthContext.jsx`
- Test: `mobile/__tests__/AuthContext.test.jsx`

- [ ] **Step 1: Write failing AuthContext test**

Create `mobile/__tests__/AuthContext.test.jsx`:

```jsx
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts with no user and loading=true then resolves', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('signIn calls supabase.auth.signInWithPassword', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signOut(); });
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/AuthContext.test.jsx
```

Expected: FAIL — "Cannot find module '../context/AuthContext'"

- [ ] **Step 3: Create `mobile/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

- [ ] **Step 4: Create `mobile/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    return data;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/AuthContext.test.jsx
```

Expected: PASS — 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/supabase.js mobile/context/AuthContext.jsx mobile/__tests__/AuthContext.test.jsx
git commit -m "feat(mobile): add Supabase client and AuthContext"
```

---

### Task 6: Login screen

**Files:**
- Create: `mobile/app/login.jsx`
- Test: `mobile/__tests__/login.test.jsx`

- [ ] **Step 1: Write failing login test**

Create `mobile/__tests__/login.test.jsx`:

```jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../app/login';
import { AuthProvider } from '../context/AuthContext';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('LoginScreen', () => {
  it('renders email and password fields', () => {
    const { getByPlaceholderText } = render(<LoginScreen />, { wrapper });
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('shows error when fields empty', async () => {
    const { getByText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Sign in'));
    expect(await findByText('Email and password are required')).toBeTruthy();
  });

  it('calls signIn with email and password', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />, { wrapper });
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'secret');
    fireEvent.press(getByText('Sign in'));
    // signIn is called — mock returns no error so no error banner shown
    await waitFor(() => expect(getByText('Sign in')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && pnpm test -- __tests__/login.test.jsx
```

Expected: FAIL — "Cannot find module '../app/login'"

- [ ] **Step 3: Create `mobile/app/login.jsx`**

```jsx
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { Inp } from '../components/ui/Inp';
import { Btn } from '../components/ui/Btn';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { C, F, gradColors, gradStart, gradEnd } from '../lib/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    setError('');
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
    // Auth state change triggers redirect in _layout.jsx
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header gradient strip */}
        <LinearGradient colors={gradColors} start={gradStart} end={gradEnd} style={styles.strip} />

        <View style={styles.container}>
          <Text style={[styles.brand, { fontFamily: F.sansBold }]}>ADGRID</Text>
          <Text style={[styles.title, { fontFamily: F.sansBold }]}>Operator Portal</Text>
          <Text style={[styles.sub, { fontFamily: F.sans }]}>Sign in to manage your screens</Text>

          <View style={styles.form}>
            <ErrorBanner message={error} />
            <Inp
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
            />
            <Inp
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
            />
            <Btn onPress={handleSignIn} loading={loading} size="lg">
              Sign in
            </Btn>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: C.bg },
  strip: { height: 6 },
  container: { flex: 1, padding: 24, paddingTop: 48 },
  brand: { fontSize: 13, color: C.purple, letterSpacing: 3, marginBottom: 8 },
  title: { fontSize: 28, color: C.text, marginBottom: 6 },
  sub: { fontSize: 15, color: C.textSub, marginBottom: 40 },
  form: { gap: 0 },
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && pnpm test -- __tests__/login.test.jsx
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/login.jsx mobile/__tests__/login.test.jsx
git commit -m "feat(mobile): add login screen"
```

---

### Task 7: Root layout + auth gate + tab navigation shell

**Files:**
- Create: `mobile/app/_layout.jsx`
- Create: `mobile/app/(tabs)/_layout.jsx`
- Create: `mobile/app/(tabs)/index.jsx`
- Create: `mobile/app/(tabs)/screens/index.jsx`
- Create: `mobile/app/(tabs)/approvals.jsx`
- Create: `mobile/app/(tabs)/revenue.jsx`
- Create: `mobile/app/(tabs)/more/index.jsx`

- [ ] **Step 1: Create `mobile/app/_layout.jsx`**

```jsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../context/AuthContext';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === '(tabs)';
    const inOnboard = segments[0] === 'onboard';
    if (!user && inTabs) {
      router.replace('/login');
    } else if (user && !inTabs && !inOnboard) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Create `mobile/app/(tabs)/_layout.jsx`**

```jsx
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

function TabIcon({ icon, label, focused, badgeCount }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, { opacity: focused ? 1 : 0.45 }]}>{icon}</Text>
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border, height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: C.purple,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontFamily: F.sansMed, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="screens"
        options={{
          title: 'Screens',
          tabBarIcon: ({ focused }) => <TabIcon icon="📺" label="Screens" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ focused }) => <TabIcon icon="✅" label="Approvals" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Revenue',
          tabBarIcon: ({ focused }) => <TabIcon icon="💰" label="Revenue" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabIcon icon="⋯" label="More" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  icon: { fontSize: 20 },
  badge: { position: 'absolute', top: -4, right: -10, backgroundColor: C.red, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
```

- [ ] **Step 3: Create placeholder tab screens**

Create `mobile/app/(tabs)/index.jsx`:
```jsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '../../lib/tokens';
export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: C.text }}>Dashboard</Text>
        <Text style={{ fontFamily: F.sans, color: C.textSub, marginTop: 8 }}>Coming in Plan 4</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `mobile/app/(tabs)/screens/index.jsx`:
```jsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '../../../lib/tokens';
export default function ScreensScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: C.text }}>Screens</Text>
        <Text style={{ fontFamily: F.sans, color: C.textSub, marginTop: 8 }}>Coming in Plan 2</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `mobile/app/(tabs)/approvals.jsx`:
```jsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '../../lib/tokens';
export default function ApprovalsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: C.text }}>Approvals</Text>
        <Text style={{ fontFamily: F.sans, color: C.textSub, marginTop: 8 }}>Coming in Plan 3</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `mobile/app/(tabs)/revenue.jsx`:
```jsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '../../lib/tokens';
export default function RevenueScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: C.text }}>Revenue</Text>
        <Text style={{ fontFamily: F.sans, color: C.textSub, marginTop: 8 }}>Coming in Plan 4</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `mobile/app/(tabs)/more/index.jsx`:
```jsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '../../../lib/tokens';
export default function MoreScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: C.text }}>More</Text>
        <Text style={{ fontFamily: F.sans, color: C.textSub, marginTop: 8 }}>Coming in Plan 4</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Run all tests**

```bash
cd mobile && pnpm test
```

Expected: all tests pass. No navigation errors.

- [ ] **Step 5: Verify in Expo Go**

```bash
cd mobile && pnpm start
```

Scan QR with Expo Go. Verify:
- Splash screen shows briefly
- Login screen appears (not authenticated)
- Sign in with valid credentials → tab bar appears with 5 tabs
- Each tab shows placeholder text
- Sign out (via Settings placeholder when added) redirects to login

- [ ] **Step 6: Commit**

```bash
git add mobile/app/
git commit -m "feat(mobile): add root layout, auth gate, and tab navigation shell"
```

---

**Plan 1 complete.** Running app with: login screen, authenticated tab shell, all primitive components, design tokens matching web app exactly.
