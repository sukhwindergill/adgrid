import { describe, it, expect } from 'vitest';
import { checkReadability, contrastRatio, wordCount, tierForEnvironment, distinctTiers } from './creativeReadability.js';

describe('wordCount', () => {
  it('counts words separated by single spaces', () => {
    expect(wordCount('Half Price Burgers')).toBe(3);
  });

  it('counts words separated by multiple spaces', () => {
    expect(wordCount('Half   Price    Burgers')).toBe(3);
  });

  it('returns 0 for an empty or whitespace-only string', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
  });

  it('returns 0 for null or undefined', () => {
    expect(wordCount(null)).toBe(0);
    expect(wordCount(undefined)).toBe(0);
  });
});

describe('contrastRatio', () => {
  it('returns exactly 21 for pure black against pure white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('returns exactly 1 for a color against itself', () => {
    expect(contrastRatio('#050a10', '#050a10')).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const a = contrastRatio('#7c3aed', '#050a10');
    const b = contrastRatio('#050a10', '#7c3aed');
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('tierForEnvironment', () => {
  it('maps outdoor to far', () => {
    expect(tierForEnvironment('outdoor')).toBe('far');
  });

  it('maps indoor to close', () => {
    expect(tierForEnvironment('indoor')).toBe('close');
  });

  it('returns null for unknown or missing environment', () => {
    expect(tierForEnvironment('other')).toBeNull();
    expect(tierForEnvironment(null)).toBeNull();
    expect(tierForEnvironment(undefined)).toBeNull();
  });
});

describe('distinctTiers', () => {
  it('returns both tiers, close before far, when screens span both', () => {
    const screens = [{ environment: 'outdoor' }, { environment: 'indoor' }];
    expect(distinctTiers(screens)).toEqual(['close', 'far']);
  });

  it('returns only close when every screen is indoor', () => {
    expect(distinctTiers([{ environment: 'indoor' }, { environment: 'indoor' }])).toEqual(['close']);
  });

  it('returns only far when every screen is outdoor', () => {
    expect(distinctTiers([{ environment: 'outdoor' }])).toEqual(['far']);
  });

  it('returns an empty array for no screens or unknown environments', () => {
    expect(distinctTiers([])).toEqual([]);
    expect(distinctTiers(undefined)).toEqual([]);
    expect(distinctTiers([{ environment: null }, { environment: 'other' }])).toEqual([]);
  });
});

const words = n => Array(n).fill('word').join(' ');

describe('checkReadability', () => {
  it('reports no issues for a short headline, short CTA, ample duration, and high-contrast accent', () => {
    const result = checkReadability({
      headline: 'Half Price Burgers',
      ctaText: 'Order Now',
      accentColor: '#ffffff',
      durationSeconds: 15,
    });
    expect(result).toEqual({ score: 100, issues: [] });
  });

  it('does not flag read-time at exactly the readable word count', () => {
    // duration 10s * 2.5 words/sec = 25 readable words, exactly met
    const result = checkReadability({ headline: words(25), ctaText: '', accentColor: '#ffffff', durationSeconds: 10 });
    expect(result.issues.some(i => i.type === 'read_time')).toBe(false);
  });

  it('flags read-time one word past the readable count', () => {
    const result = checkReadability({ headline: words(26), ctaText: '', accentColor: '#ffffff', durationSeconds: 10 });
    const issue = result.issues.find(i => i.type === 'read_time');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('26 words');
    expect(issue.message).toContain('25');
    expect(result.score).toBeLessThan(100);
  });

  it('does not flag truncation at exactly the word limit', () => {
    // duration long enough that read-time never fires, isolating the truncation check
    const result = checkReadability({ headline: words(8), ctaText: '', accentColor: '#ffffff', durationSeconds: 60 });
    expect(result.issues.some(i => i.type === 'truncation')).toBe(false);
  });

  it('flags truncation one word past the limit', () => {
    const result = checkReadability({ headline: words(9), ctaText: '', accentColor: '#ffffff', durationSeconds: 60 });
    const issue = result.issues.find(i => i.type === 'truncation');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('9 words');
  });

  it('flags weak CTA contrast when the accent color matches the background', () => {
    const result = checkReadability({ headline: 'Short', ctaText: 'Go', accentColor: '#050a10', durationSeconds: 60 });
    const issue = result.issues.find(i => i.type === 'contrast');
    expect(issue).toBeDefined();
    expect(issue.message).toMatch(/1\.0:1|1:1/);
  });

  it('does not flag contrast for a clearly high-contrast accent color', () => {
    const result = checkReadability({ headline: 'Short', ctaText: 'Go', accentColor: '#ffffff', durationSeconds: 60 });
    expect(result.issues.some(i => i.type === 'contrast')).toBe(false);
  });

  it('flags every check at once and floors the score at 0 for an extreme case', () => {
    // ctaText must be non-empty for the contrast check to apply at all (see
    // checkReadability's own gating) -- a single extra word barely moves the
    // read-time math and the deduction is capped at 50 regardless.
    const result = checkReadability({ headline: words(50), ctaText: 'x', accentColor: '#050a10', durationSeconds: 5 });
    expect(result.issues.map(i => i.type).sort()).toEqual(['contrast', 'read_time', 'truncation']);
    expect(result.score).toBe(0);
  });

  it('does not throw when accentColor is null (e.g. a legacy campaign with no color columns set)', () => {
    expect(() =>
      checkReadability({ headline: 'x', ctaText: 'Go', accentColor: null, durationSeconds: 15 })
    ).not.toThrow();
  });

  it('using all default parameters does not throw and returns a valid score shape', () => {
    const result = checkReadability();
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('flagging the default accent color for contrast matches what contrastRatio itself reports', () => {
    // ctaText must be non-empty here so the contrast check actually runs --
    // see checkReadability's own gating on CTA presence.
    const ratio = contrastRatio('#7c3aed', '#050a10');
    const result = checkReadability({ headline: '', ctaText: 'Go', accentColor: '#7c3aed', durationSeconds: 15 });
    const hasContrastIssue = result.issues.some(i => i.type === 'contrast');
    expect(hasContrastIssue).toBe(ratio < 4.5);
  });
});
