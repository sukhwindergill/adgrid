// src/lib/cardExpiry.js
// Story Map (Money & Trust epic): "I want to be warned before a saved
// payment method expires or a charge is about to fail, so a campaign
// doesn't quietly pause mid-flight because a card lapsed." Payment methods
// (brand/last4/expMonth/expYear) were already fetched and shown in
// BillingView.jsx, but nothing compared expiry against today's date --
// an advertiser only found out their card had lapsed when a charge failed.
//
// Pure, so it's testable without touching Stripe or a real clock.

// A 60-day warning window: long enough that an advertiser has time to
// update a card before their next campaign charge, short enough that the
// warning still means "this is coming up," not permanent background noise.
export const CARD_EXPIRY_WARNING_DAYS = 60;

function expiryDate(pm) {
  // Stripe cards expire at the end of the stated month -- the 1st of the
  // NEXT month is the first moment the card is truly unusable, so that's
  // the correct boundary to compare "now" against.
  return new Date(Date.UTC(pm.expYear, pm.expMonth, 1));
}

export function cardExpiryStatus(pm, now = new Date()) {
  if (!pm || !Number.isFinite(pm.expMonth) || !Number.isFinite(pm.expYear)) {
    return { status: 'unknown' };
  }
  const expires = expiryDate(pm);
  if (now.getTime() >= expires.getTime()) {
    return { status: 'expired' };
  }
  const daysUntil = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
  if (daysUntil <= CARD_EXPIRY_WARNING_DAYS) {
    return { status: 'expiring_soon', daysUntil };
  }
  return { status: 'ok' };
}

// Only the default payment method actually charges anything -- a lapsed
// backup card sitting unused isn't worth interrupting anyone about.
export function defaultCardExpiryWarning(paymentMethods = [], now = new Date()) {
  const defaultPm = paymentMethods.find(pm => pm.isDefault);
  if (!defaultPm) return null;
  const result = cardExpiryStatus(defaultPm, now);
  if (result.status === 'ok' || result.status === 'unknown') return null;
  return { ...result, paymentMethod: defaultPm };
}
