import { describe, it, expect } from 'vitest';
import { isFreeEmailDomain } from './freeEmailDomains.ts';

describe('isFreeEmailDomain', () => {
  it('flags common free providers, case-insensitively', () => {
    expect(isFreeEmailDomain('gmail.com')).toBe(true);
    expect(isFreeEmailDomain('Outlook.com')).toBe(true);
    expect(isFreeEmailDomain(' icloud.com ')).toBe(true);
    expect(isFreeEmailDomain('proton.me')).toBe(true);
  });

  it('flags subdomains of free providers', () => {
    expect(isFreeEmailDomain('mail.yahoo.com')).toBe(true);
  });

  it('does not flag business domains, including look-alikes', () => {
    expect(isFreeEmailDomain('acme.com')).toBe(false);
    expect(isFreeEmailDomain('notgmail.com')).toBe(false);
    expect(isFreeEmailDomain('gmail.com.acme.io')).toBe(false);
  });

  it('treats empty input as not free', () => {
    expect(isFreeEmailDomain('')).toBe(false);
  });
});
