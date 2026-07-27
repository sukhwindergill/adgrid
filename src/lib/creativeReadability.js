// Pure readability scoring for platform-controlled creative text (headline,
// CTA) against the campaign's own play duration and CreativePreview's fixed
// rendering rules. No DOM, no network, no OCR -- an uploaded creative's own
// baked-in text is never inspected (see the design doc for why: OCR is a
// heavy, unreliable dependency for what should be a cheap advisory check).

// ~2.5 words/second is a conservative "glance-read" rate for the OOH 3-5
// second rule -- slower than normal reading speed (~4-5 wps) because a
// viewer is walking/riding/driving, not just reading.
const WORDS_PER_SECOND = 2.5;

// CreativePreview renders the headline at a fixed 13px, clamped to 2 lines,
// inside a card-sized preview -- every usage in this app is a narrow card
// (the wizard's own preview, the fit-mismatch cards, the approval queue),
// never edge-to-edge. ~12 words is a reasonable estimate for what two lines
// hold at that size. This is a word-count heuristic rather than a
// character-width/canvas measurement, so this module stays DOM-free and
// doesn't need to know any specific container's actual pixel width.
const TRUNCATION_WORD_LIMIT = 12;

const CONTRAST_MIN_RATIO = 4.5; // WCAG AA, normal text
const PREVIEW_BG_HEX = '#050a10'; // CreativePreview's darkest gradient stop

export function wordCount(text) {
  if (typeof text !== 'string' || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function tierForEnvironment(environment) {
  if (environment === 'outdoor') return 'far';
  if (environment === 'indoor') return 'close';
  return null; // unknown environment contributes to neither tier -- never guess
}

export function distinctTiers(screens) {
  const present = new Set();
  for (const s of screens || []) {
    const tier = tierForEnvironment(s?.environment);
    if (tier) present.add(tier);
  }
  return ['close', 'far'].filter(t => present.has(t)); // stable order
}

export function checkReadability({
  headline = '',
  ctaText = '',
  accentColor = '#7c3aed',
  durationSeconds = 15,
} = {}) {
  let score = 100;
  const issues = [];

  const totalWords = wordCount(headline) + wordCount(ctaText);
  const readableWords = Math.max(1, Math.round(durationSeconds * WORDS_PER_SECOND));
  if (totalWords > readableWords) {
    const overBy = totalWords - readableWords;
    score -= Math.min(50, Math.round((overBy / readableWords) * 50));
    issues.push({
      type: 'read_time',
      message: `${totalWords} words — a ${durationSeconds}s play gives time to read about ${readableWords}.`,
    });
  }

  const headlineWords = wordCount(headline);
  if (headlineWords > TRUNCATION_WORD_LIMIT) {
    score -= 25;
    issues.push({
      type: 'truncation',
      message: `Headline is ${headlineWords} words — likely truncates past 2 lines at this length.`,
    });
  }

  // CreativePreview only renders the accent-colored CTA text when cta is
  // truthy (`{cta && (<div>...</div>)}`) -- with no CTA text there's no
  // colored text on screen at all, so there's nothing to check contrast for.
  if (wordCount(ctaText) > 0) {
    const ratio = contrastRatio(accentColor, PREVIEW_BG_HEX);
    if (ratio < CONTRAST_MIN_RATIO) {
      score -= 25;
      issues.push({
        type: 'contrast',
        message: `CTA color has weak contrast against the background (${ratio.toFixed(1)}:1, needs ${CONTRAST_MIN_RATIO}:1).`,
      });
    }
  }

  return { score: Math.max(0, score), issues };
}
