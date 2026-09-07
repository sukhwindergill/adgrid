// src/lib/disputeReasons.js
// Reason codes an advertiser can file a dispute under (spec #2). Kept as
// data, not inlined in the form component, so the advertiser-facing label
// and the value stored in disputes.reason_code can't silently drift apart.
export const DISPUTE_REASONS = [
  { value: 'no_play', label: "My ad didn't run" },
  { value: 'wrong_creative', label: 'Wrong creative aired' },
  { value: 'billing_error', label: 'Billing / charge issue' },
  { value: 'other', label: 'Something else' },
];

export function isValidDisputeReason(value) {
  return DISPUTE_REASONS.some(r => r.value === value);
}
