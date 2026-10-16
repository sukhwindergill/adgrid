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

  // Brand — unified with marketing site
  purple:      '#7B2FFF',
  purpleDark:  '#6B1FEF',
  purpleSoft:  '#f0ebff',
  purpleBorder:'#d4b8ff',
  purpleLight: '#f0ebff',
  purpleAccentLight: '#B79CFF',
  grad:        'linear-gradient(135deg, #B79CFF 0%, #7B2FFF 100%)',
  gradSoft:    'linear-gradient(135deg, rgba(123,47,255,0.14) 0%, rgba(123,47,255,0.10) 100%)',

  green: '#10b981', greenSoft: '#ecfdf5', greenBorder: '#a7f3d0', greenLight: '#ecfdf5',
  amber: '#f59e0b', amberSoft: '#fffbeb', amberBorder: '#fde68a',
  red:   '#ef4444', redSoft:   '#fef2f2', redBorder:   '#fecaca', redLight: '#fef2f2',
  blue:  '#3b82f6', blueSoft:  '#eff6ff', blueBorder:  '#bfdbfe', blueLight: '#eff6ff',
};

// Type scale. Use these instead of ad-hoc pixel sizes. 11 is the floor and
// is for badges, eyebrows and table captions only; body text is 13-14.
export const T = {
  xs: 11,   // badges, eyebrows, captions
  sm: 12,   // secondary labels, helper text
  base: 13, // default UI text
  md: 14,   // emphasized body, buttons
  lg: 16,   // card titles
  xl: 20,   // section headings
  xxl: 24,  // page titles
  display: 32, // KPI numbers, hero figures
};

export const F = {
  // Body/UI text — a real system sans, not a display font stretched over paragraphs.
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  // Headings, KPI numbers, display text only.
  display: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

// Opaque surface (design system bans blur/backdrop-filter — no glassmorphism).
export const glass = {
  background: '#ffffff',
  border: '1px solid #e5e5e5',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};
