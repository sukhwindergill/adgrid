import { describe, it, expect } from 'vitest';
import { splitMessage } from './creativeMessageSplit.js';

describe('splitMessage', () => {
  it('splits headline and CTA on a trailing lead-verb clause', () => {
    expect(splitMessage('Fresh cold brew, delivered daily, Order now')).toEqual({
      headline: 'Fresh cold brew, delivered daily',
      cta: 'Order now',
    });
  });

  it('falls back to "Learn More" when the trailing clause is not a CTA verb', () => {
    expect(splitMessage('Fresh cold brew, delivered daily, right downtown')).toEqual({
      headline: 'Fresh cold brew, delivered daily, right downtown',
      cta: 'Learn More',
    });
  });

  it('falls back to "Learn More" when there is no delimiter at all', () => {
    expect(splitMessage('Grand opening this weekend downtown')).toEqual({
      headline: 'Grand opening this weekend downtown',
      cta: 'Learn More',
    });
  });

  it('returns empty headline and cta for an empty message', () => {
    expect(splitMessage('')).toEqual({ headline: '', cta: '' });
    expect(splitMessage('   ')).toEqual({ headline: '', cta: '' });
  });

  it('rejects a trailing clause longer than 6 words even if it starts with a lead verb', () => {
    expect(splitMessage('Best coffee in town, Get the smoothest richest cold brew experience today')).toEqual({
      headline: 'Best coffee in town, Get the smoothest richest cold brew experience today',
      cta: 'Learn More',
    });
  });

  it('matches lead verbs case-insensitively', () => {
    expect(splitMessage('Grand opening this weekend, ORDER now')).toEqual({
      headline: 'Grand opening this weekend',
      cta: 'ORDER now',
    });
  });
});
