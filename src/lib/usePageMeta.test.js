import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageMeta } from './usePageMeta.js';

function getMeta(selector) {
  return document.head.querySelector(selector);
}

describe('usePageMeta', () => {
  beforeEach(() => {
    document.title = '';
    document.head.querySelectorAll('meta').forEach(el => el.remove());
  });

  it('sets document.title', () => {
    renderHook(() => usePageMeta({ title: 'Thank You — AdGrid', description: 'desc' }));
    expect(document.title).toBe('Thank You — AdGrid');
  });

  it('creates description, og:title, og:description, twitter:title, twitter:description meta tags when none exist', () => {
    renderHook(() => usePageMeta({ title: 'Page Title', description: 'Page description.' }));

    expect(getMeta('meta[name="description"]').getAttribute('content')).toBe('Page description.');
    expect(getMeta('meta[property="og:title"]').getAttribute('content')).toBe('Page Title');
    expect(getMeta('meta[property="og:description"]').getAttribute('content')).toBe('Page description.');
    expect(getMeta('meta[name="twitter:title"]').getAttribute('content')).toBe('Page Title');
    expect(getMeta('meta[name="twitter:description"]').getAttribute('content')).toBe('Page description.');
  });

  it('updates existing meta tags instead of duplicating them', () => {
    const existing = document.createElement('meta');
    existing.setAttribute('name', 'description');
    existing.setAttribute('content', 'old');
    document.head.appendChild(existing);

    renderHook(() => usePageMeta({ title: 'New Title', description: 'new description' }));

    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(getMeta('meta[name="description"]').getAttribute('content')).toBe('new description');
  });

  it('sets og:image and twitter:image only when image is provided', () => {
    renderHook(() => usePageMeta({ title: 'T', description: 'D' }));
    expect(getMeta('meta[property="og:image"]')).toBeNull();
    expect(getMeta('meta[name="twitter:image"]')).toBeNull();

    renderHook(() => usePageMeta({ title: 'T', description: 'D', image: '/marketing/hero-gym.jpg' }));
    expect(getMeta('meta[property="og:image"]').getAttribute('content')).toBe('/marketing/hero-gym.jpg');
    expect(getMeta('meta[name="twitter:image"]').getAttribute('content')).toBe('/marketing/hero-gym.jpg');
  });
});
