export const C = {
  bg: '#fafafa',
  surface: '#ffffff',
  surfaceAlt: '#f5f5f5',
  border: '#e5e5e5',
  borderDark: '#d4d4d4',

  text: '#0a0a0a',
  textMid: '#262626',
  textSub: '#525252',
  // #6b6b6b, not #737373: the lighter grey dropped to 4.35:1 on surfaceAlt.
  textMuted: '#6b6b6b',

  white: '#ffffff',
  black: '#000000',

  // Brand — unified with marketing site
  purple:      '#7B2FFF',
  purpleDark:  '#6B1FEF',
  purpleSoft:  '#f0ebff',
  purpleBorder:'#d4b8ff',
  purpleLight: '#f0ebff',
  purpleAccentLight: '#B79CFF',
  purpleVivid: '#A855F7', // second stop of gradStrong
  grad:        'linear-gradient(135deg, #B79CFF 0%, #7B2FFF 100%)',
  gradSoft:    'linear-gradient(135deg, rgba(123,47,255,0.14) 0%, rgba(123,47,255,0.10) 100%)',
  // Filled surfaces that carry white text (primary buttons, avatars). The
  // lavender end of `grad` is only 2.3:1 against white, so these start at
  // the brand purple instead.
  gradAction:  'linear-gradient(135deg, #7B2FFF 0%, #6B1FEF 100%)',
  gradStrong:  'linear-gradient(135deg, #7B2FFF 0%, #A855F7 100%)',
  // Pale purple → pale blue wash for onboarding / hero cards.
  gradWash:    'linear-gradient(135deg, #f5f3ff, #eff6ff)',

  green: '#10b981', greenSoft: '#ecfdf5', greenBorder: '#a7f3d0', greenLight: '#ecfdf5',
  amber: '#f59e0b', amberSoft: '#fffbeb', amberBorder: '#fde68a',
  red:   '#ef4444', redSoft:   '#fef2f2', redBorder:   '#fecaca', redLight: '#fef2f2',
  blue:  '#3b82f6', blueSoft:  '#eff6ff', blueBorder:  '#bfdbfe', blueLight: '#eff6ff',
  pink:  '#ec4899',

  // Status colours above are for fills, dots, bars and borders. They are too
  // light for text (2.1-3.8:1). Use these for status text and icons; each
  // clears 4.5:1 on white and on its own *Soft background.
  greenText: '#047857',
  amberText: '#92400e',
  redText:   '#b91c1c',
  redStrong: '#dc2626', // filled destructive buttons (white text 4.8:1)
  blueText:  '#1d4ed8',
  amberStrong: '#fbbf24', // border of high-attention warning banners
  amberWash:   '#fef3c7', // background of high-attention warning banners

  // Dark "screen" surfaces used to mimic a DOOH display in previews.
  screen:     '#050a10',
  screenMid:  '#0d1520',
  terminalText: '#a3e635',

  // Backdrop behind modals, drawers and sheets.
  overlay: 'rgba(0,0,0,0.4)',
};

// Third-party brand colours (logos, "Connect with X" buttons). Not for UI chrome.
export const BRAND = {
  stripe: '#635bff', stripeHover: '#5147e6',
  meta: '#0866FF',
  google: { blue: '#4285F4', green: '#34A853', yellow: '#FBBC05', red: '#EA4335' },
  shopify: '#95BF47', shopifyDark: '#3D6B27',
  salesforce: '#00A1E0',
  hubspot: '#FF7A59',
  klaviyo: '#00B2A9',
  tiktok: '#000000', tiktokCyan: '#25F4EE', tiktokPink: '#FE2C55',
};

// rgba() from a 6-digit hex token, e.g. alpha(C.purple, 0.12).
export const alpha = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Elevation. Pick the closest level rather than writing a new shadow.
export const SH = {
  xs:    '0 1px 2px rgba(0,0,0,0.04)',
  sm:    '0 1px 3px rgba(0,0,0,0.08)',
  hover: '0 4px 12px rgba(0,0,0,0.08)',
  lift:  '0 8px 25px rgba(0,0,0,0.1)',
  pop:   '0 8px 30px rgba(0,0,0,0.12)', // dropdowns, popovers
  modal: '0 24px 60px rgba(0,0,0,0.15)',
  drawer: '-8px 0 32px rgba(0,0,0,0.12)',
  sheet: '0 -8px 24px rgba(0,0,0,0.08)',
  focus: '0 0 0 3px rgba(123,47,255,0.35)',
  brand: '0 1px 8px rgba(123,47,255,0.25)',
  brandHover: '0 2px 16px rgba(123,47,255,0.4)',
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
  jumbo: 48,   // single headline figure on a page (live counters, scores)
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
