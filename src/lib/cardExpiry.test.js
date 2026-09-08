import { describe, it, expect } from 'vitest';
import { cardExpiryStatus, defaultCardExpiryWarning, CARD_EXPIRY_WARNING_DAYS } from './cardExpiry.js';

const now = new Date('2026-09-08T00:00:00Z');

describe('cardExpiryStatus', () => {
  it('is ok when expiry is well beyond the warning window', () => {
    const result = cardExpiryStatus({ expMonth: 6, expYear: 2027 }, now);
    expect(result.status).toBe('ok');
  });

  it('flags expiring_soon within the warning window', () => {
    const result = cardExpiryStatus({ expMonth: 10, expYear: 2026 }, now);
    expect(result.status).toBe('expiring_soon');
    expect(result.daysUntil).toBeGreaterThan(0);
  });

  it('flags expired once the card has actually lapsed', () => {
    const result = cardExpiryStatus({ expMonth: 8, expYear: 2026 }, now);
    expect(result.status).toBe('expired');
  });

  it('treats the card as valid through the end of its expiry month', () => {
    // Expires Sept 2026 -- still valid on Sept 8.
    const result = cardExpiryStatus({ expMonth: 9, expYear: 2026 }, now);
    expect(result.status).toBe('expiring_soon');
  });

  it('returns unknown for a missing or malformed card', () => {
    expect(cardExpiryStatus(null, now).status).toBe('unknown');
    expect(cardExpiryStatus({ expMonth: null, expYear: 2026 }, now).status).toBe('unknown');
  });

  it('exposes the warning window used', () => {
    expect(CARD_EXPIRY_WARNING_DAYS).toBe(60);
  });
});

describe('defaultCardExpiryWarning', () => {
  it('warns about the default card only, ignoring a lapsed backup card', () => {
    const paymentMethods = [
      { id: 'pm_1', isDefault: false, expMonth: 1, expYear: 2025 }, // long expired, but not default
      { id: 'pm_2', isDefault: true, expMonth: 6, expYear: 2027 },  // default, fine
    ];
    expect(defaultCardExpiryWarning(paymentMethods, now)).toBeNull();
  });

  it('warns when the default card itself is expiring soon', () => {
    const paymentMethods = [{ id: 'pm_1', isDefault: true, expMonth: 10, expYear: 2026 }];
    const warning = defaultCardExpiryWarning(paymentMethods, now);
    expect(warning.status).toBe('expiring_soon');
    expect(warning.paymentMethod.id).toBe('pm_1');
  });

  it('returns null when there is no default payment method at all', () => {
    expect(defaultCardExpiryWarning([], now)).toBeNull();
  });
});
