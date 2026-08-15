// Trims and strips control/zero-width characters from free-text form input
// before it's persisted. React already escapes on render and the DB now
// caps these fields' length (see 20260816000004_free_text_length_bounds.sql),
// but neither of those cleans up control characters (null bytes, escape
// sequences, bidi overrides) that could otherwise sit in stored data and
// confuse downstream consumers (CSV/report exports, log lines, terminal-
// rendered admin tools).
//
// Built purely from numeric code points (no literal special characters in
// this source file) so the pattern is unambiguous and can't itself hide an
// invisible character.
const CODE_POINTS = [
  [0x00, 0x1f], // C0 control characters
  [0x7f, 0x7f], // DEL
  [0x200b, 0x200f], // zero-width space/joiners, LTR/RTL marks
  [0x202a, 0x202e], // bidi embedding/override controls
  [0xfeff, 0xfeff], // BOM / zero-width no-break space
]

function buildStripPattern() {
  const ranges = CODE_POINTS.map(([start, end]) => {
    const from = String.fromCodePoint(start)
    const to = String.fromCodePoint(end)
    return start === end ? from : `${from}-${to}`
  }).join('')
  return new RegExp(`[${ranges}]`, 'g')
}

const STRIP_PATTERN = buildStripPattern()

export function sanitizeText(value, maxLength = 500) {
  if (typeof value !== 'string') return value
  return value.replace(STRIP_PATTERN, '').trim().slice(0, maxLength)
}
