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
