import { C, F, T } from './tokens.js';

// Recurring text styles. Spread and extend rather than re-typing the four
// properties:  style={{ ...TX.title, marginBottom: 4 }}
export const TX = {
  pageTitle: { fontSize: T.xxl, fontWeight: 700, color: C.text, fontFamily: F.display },
  heading:   { fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.sans },
  titleLg:   { fontSize: T.lg, fontWeight: 600, color: C.text, fontFamily: F.sans },
  title:     { fontSize: T.md, fontWeight: 600, color: C.text, fontFamily: F.sans },
  strong:    { fontSize: T.base, fontWeight: 600, color: C.text, fontFamily: F.sans },
  body:      { fontSize: T.base, color: C.text, fontFamily: F.sans },
  bodySub:   { fontSize: T.base, color: C.textSub, fontFamily: F.sans },
  bodyMuted: { fontSize: T.base, color: C.textMuted, fontFamily: F.sans },
  label:     { fontSize: T.base, fontWeight: 500, color: C.textMid, fontFamily: F.sans },
  helper:    { fontSize: T.sm, color: C.textSub, fontFamily: F.sans },
  helperMuted: { fontSize: T.sm, color: C.textMuted, fontFamily: F.sans },
  caption:   { fontSize: T.xs, color: C.textMuted, fontFamily: F.sans },
  error:     { fontSize: T.sm, color: C.redText, fontFamily: F.sans },
  mono:      { fontFamily: F.mono, fontSize: T.xs, color: C.textSub },
};
