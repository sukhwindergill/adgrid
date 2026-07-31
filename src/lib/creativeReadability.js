// Pure readability scoring for platform-controlled creative text (headline,
// CTA) against the campaign's own play duration and CreativePreview's
// per-template rendering rules. No DOM, no network, no OCR -- an uploaded
// creative's own baked-in text is never inspected (see the design doc for
// why: OCR is a heavy, unreliable dependency for what should be a cheap
// advisory check).
//
// Template-aware: truncation limits and contrast pairs are keyed off
// `creativeTemplate` and mirror CreativePreview's three render paths
// (BottomBarBody/FullBleedBody/SplitPanelBody). Still a word-count/color-math
// heuristic, not a DOM measurement -- if CreativePreview's actual JSX for a
// template changes, these constants need to be revisited by hand. See
// docs/superpowers/specs/2026-07-27-creative-studio-templates-design.md.

// ~2.5 words/second is a conservative "glance-read" rate for the OOH 3-5
// second rule -- slower than normal reading speed (~4-5 wps) because a
// viewer is walking/riding/driving, not just reading.
const WORDS_PER_SECOND = 2.5;

// Real CreativePreview usages in CreateCampaign.jsx are a ~220px wizard
// preview column and a ~180px review-step card. Every limit below is
// calibrated to the smaller (180px) case -- erring toward not over-flagging
// reasonably short headlines -- using each template's actual usable text-box
// width and font-size from CreativePreview's JSX, scaled by the
// words-per-line-per-(width/fontSize) ratio reverse-engineered from
// `bottom_bar`'s original hand-tuned limit (8 words, 2 lines, 106px, 13px):
// ratio = (8 words / 2 lines) / (106px / 13px) ≈ 0.49.
//
// bottom_bar: fixed `left:14,right:60` padding regardless of card size --
// 180-74=106px usable, 13px, 2-line clamp.
// 0.49 * (106/13) ≈ 4/line -> 8 words (unchanged; this is where the ratio
// above comes from, not the other way around).
//
// full_bleed: centered, `padding: '0 20px'` on the outer frame, no fixed
// gutter -- 180-40=140px usable, 14px, 2-line clamp.
// 0.49 * (140/14) ≈ 4.9/line -> ~10 words.
//
// split_panel: left panel is 40% width with `padding: '0 12px'` --
// 180*0.4-24=48px usable, 12px, 3-line clamp (WebkitLineClamp: 3, not 2).
// 0.49 * (48/12) ≈ 2/line -> ~6 words over 3 lines.
const TRUNCATION_WORD_LIMIT = { bottom_bar: 8, full_bleed: 10, split_panel: 6 };
const LINE_CLAMP = { bottom_bar: 2, full_bleed: 2, split_panel: 3 };

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
  creativeTemplate = 'bottom_bar',
  secondaryColor = null,
} = {}) {
  // The destructured defaults above only apply when a key is `undefined`,
  // not `null` -- callers like ApprovalQueue pass
  // `accentColor: campaign.accent_color || campaign.color`, which evaluates
  // to `null` when both DB columns are null on a legacy row. Normalize here
  // so hexToRgb never receives a non-string and crashes the caller.
  const safeAccentColor = (typeof accentColor === 'string' && accentColor) ? accentColor : '#7c3aed';
  // Same null-safety, plus falling back to any unrecognized value (a typo or
  // a future template this module hasn't been taught yet) to `bottom_bar` --
  // the template every existing row already renders as.
  const template = (typeof creativeTemplate === 'string' && TRUNCATION_WORD_LIMIT[creativeTemplate] !== undefined)
    ? creativeTemplate
    : 'bottom_bar';

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
  if (headlineWords > TRUNCATION_WORD_LIMIT[template]) {
    score -= 25;
    issues.push({
      type: 'truncation',
      message: `Headline is ${headlineWords} words — likely truncates past ${LINE_CLAMP[template]} lines at this length.`,
    });
  }

  // Contrast pairs mirror each template's actual rendered colors (see
  // BottomBarBody/FullBleedBody/SplitPanelBody in CreativePreview.jsx):
  //   bottom_bar:  CTA text colored `accentColor`, on CreativePreview's fixed
  //                dark gradient background. Headline is always white on
  //                that same dark gradient -- safe by construction, no
  //                check needed.
  //   full_bleed:  CTA is a solid `accentColor` pill with WHITE text -- the
  //                relevant pair is white-vs-accent, not accent-vs-dark-bg.
  //                Headline is still white on the fixed dark gradient --
  //                same safe-by-construction case as bottom_bar.
  //   split_panel: headline AND CTA both render white on
  //                `secondaryColor || accentColor` -- a background the
  //                advertiser picks freely, not guaranteed dark. Neither is
  //                safe-by-construction here, so both get checked.
  if (template === 'split_panel') {
    const panelBg = (typeof secondaryColor === 'string' && secondaryColor) ? secondaryColor : safeAccentColor;
    if (wordCount(headline) > 0) {
      const ratio = contrastRatio('#ffffff', panelBg);
      if (ratio < CONTRAST_MIN_RATIO) {
        score -= 25;
        issues.push({
          type: 'contrast_headline',
          message: `Headline color has weak contrast against its panel background (${ratio.toFixed(1)}:1, needs ${CONTRAST_MIN_RATIO}:1).`,
        });
      }
    }
    if (wordCount(ctaText) > 0) {
      const ratio = contrastRatio('#ffffff', panelBg);
      if (ratio < CONTRAST_MIN_RATIO) {
        score -= 25;
        issues.push({
          type: 'contrast',
          message: `CTA color has weak contrast against its panel background (${ratio.toFixed(1)}:1, needs ${CONTRAST_MIN_RATIO}:1).`,
        });
      }
    }
  } else if (wordCount(ctaText) > 0) {
    // CreativePreview only renders the CTA when cta is truthy
    // (`{cta && (<div>...</div>)}`) -- with no CTA text there's no colored
    // text on screen at all, so there's nothing to check contrast for.
    const ratio = template === 'full_bleed'
      ? contrastRatio('#ffffff', safeAccentColor)
      : contrastRatio(safeAccentColor, PREVIEW_BG_HEX);
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
