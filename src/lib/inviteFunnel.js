// Screen Referral Invite spec (docs/superpowers/specs/2026-08-11-screen-referral-invite-design.md),
// P1 nice-to-have: "Surface aggregate invite performance (sent / viewed /
// signed-up / booked counts) on the operator's main Dashboard, not just
// per-screen on Screen Detail, once an operator has multiple screens each
// with their own invites."

/**
 * Rolls up screen_invites rows (across all of an operator's screens) into
 * funnel-stage counts. Each invite is counted once, at its current
 * (highest-reached) status -- this is a snapshot of where every invite
 * currently sits, not a stage-by-stage running total.
 *
 * @param {Array<{ status: 'pending'|'viewed'|'signed_up'|'booked' }>} invites
 * @returns {{ sent: number, viewed: number, signedUp: number, booked: number }}
 */
export function summarizeInviteFunnel(invites) {
  const summary = { sent: 0, viewed: 0, signedUp: 0, booked: 0 };
  for (const inv of invites ?? []) {
    summary.sent += 1;
    if (inv.status === 'viewed') summary.viewed += 1;
    else if (inv.status === 'signed_up') summary.signedUp += 1;
    else if (inv.status === 'booked') summary.booked += 1;
  }
  return summary;
}
