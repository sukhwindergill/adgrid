import { describe, it, expect } from 'vitest';
import { isSafeWebhookUrl } from './webhookUrlGuard.ts';

describe('isSafeWebhookUrl', () => {
  it('allows a normal https URL', () => {
    expect(isSafeWebhookUrl('https://example.com/hook')).toBe(true);
  });

  it('allows an https URL with a path and query string', () => {
    expect(isSafeWebhookUrl('https://hooks.example.com/adgrid?token=abc')).toBe(true);
  });

  it('rejects a plain http URL', () => {
    expect(isSafeWebhookUrl('http://example.com/hook')).toBe(false);
  });

  it('rejects a non-http(s) scheme', () => {
    expect(isSafeWebhookUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeWebhookUrl('ftp://example.com/hook')).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(isSafeWebhookUrl('not a url')).toBe(false);
    expect(isSafeWebhookUrl('')).toBe(false);
  });

  it('rejects localhost', () => {
    expect(isSafeWebhookUrl('https://localhost/hook')).toBe(false);
    expect(isSafeWebhookUrl('https://localhost:8443/hook')).toBe(false);
  });

  it('rejects loopback and private IPv4 literals', () => {
    expect(isSafeWebhookUrl('https://127.0.0.1/hook')).toBe(false);
    expect(isSafeWebhookUrl('https://10.0.0.5/hook')).toBe(false);
    expect(isSafeWebhookUrl('https://172.16.0.1/hook')).toBe(false);
    expect(isSafeWebhookUrl('https://172.31.255.255/hook')).toBe(false);
    expect(isSafeWebhookUrl('https://192.168.1.1/hook')).toBe(false);
  });

  it('rejects the link-local / cloud metadata range', () => {
    expect(isSafeWebhookUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('allows a public IPv4 literal', () => {
    expect(isSafeWebhookUrl('https://8.8.8.8/hook')).toBe(true);
  });

  it('does not misclassify a public IP sharing a private-range first octet', () => {
    // 172.15.x.x and 172.32.x.x are outside the 172.16.0.0/12 private block.
    expect(isSafeWebhookUrl('https://172.15.0.1/hook')).toBe(true);
    expect(isSafeWebhookUrl('https://172.32.0.1/hook')).toBe(true);
  });

  it('rejects IPv6 loopback and unique-local/link-local literals', () => {
    expect(isSafeWebhookUrl('https://[::1]/hook')).toBe(false);
    expect(isSafeWebhookUrl('https://[fd00::1]/hook')).toBe(false);
    expect(isSafeWebhookUrl('https://[fe80::1]/hook')).toBe(false);
  });

  it('rejects an IPv4-mapped IPv6 loopback literal', () => {
    expect(isSafeWebhookUrl('https://[::ffff:127.0.0.1]/hook')).toBe(false);
  });

  it('rejects the GCP metadata hostname', () => {
    expect(isSafeWebhookUrl('https://metadata.google.internal/computeMetadata/v1/')).toBe(false);
  });
});
