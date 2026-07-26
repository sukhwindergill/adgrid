import { describe, it, expect } from 'vitest';
import { normalizeDestinationUrl, isValidDestinationUrl } from './destinationUrl.js';

describe('normalizeDestinationUrl', () => {
  it('leaves a well-formed https url alone', () => {
    expect(normalizeDestinationUrl('https://example.com/promo')).toBe('https://example.com/promo');
  });

  it('keeps http as-is rather than silently upgrading it', () => {
    expect(normalizeDestinationUrl('http://example.com')).toBe('http://example.com');
  });

  it('adds https:// to a bare domain, which is what people actually type', () => {
    expect(normalizeDestinationUrl('example.com')).toBe('https://example.com');
    expect(normalizeDestinationUrl('www.example.com/x')).toBe('https://www.example.com/x');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDestinationUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeDestinationUrl('')).toBe('');
    expect(normalizeDestinationUrl('   ')).toBe('');
    expect(normalizeDestinationUrl(null)).toBe('');
    expect(normalizeDestinationUrl(undefined)).toBe('');
  });

  it('does not prepend a scheme to a dangerous one', () => {
    expect(normalizeDestinationUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});

describe('isValidDestinationUrl', () => {
  it('accepts https and http', () => {
    expect(isValidDestinationUrl('https://example.com')).toBe(true);
    expect(isValidDestinationUrl('http://example.com/a/b?c=d')).toBe(true);
  });

  it('accepts a bare domain, since it normalizes to https', () => {
    expect(isValidDestinationUrl('example.com')).toBe(true);
  });

  it('rejects an empty value', () => {
    expect(isValidDestinationUrl('')).toBe(false);
    expect(isValidDestinationUrl(null)).toBe(false);
    expect(isValidDestinationUrl(undefined)).toBe(false);
  });

  it('rejects javascript: — this URL is encoded into a QR the public scans', () => {
    expect(isValidDestinationUrl('javascript:alert(1)')).toBe(false);
    expect(isValidDestinationUrl('JavaScript:alert(1)')).toBe(false);
  });

  it('rejects data: and other non-web schemes', () => {
    expect(isValidDestinationUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isValidDestinationUrl('ftp://example.com')).toBe(false);
    expect(isValidDestinationUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects a string that is not a url at all', () => {
    expect(isValidDestinationUrl('not a url')).toBe(false);
    expect(isValidDestinationUrl('http://')).toBe(false);
  });

  it('requires a dot in the hostname, so "localhost" style typos are caught', () => {
    expect(isValidDestinationUrl('https://nodomain')).toBe(false);
  });
});
