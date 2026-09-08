// Screen Referral Invite ("Bring Your Own Advertiser") — P1 nice-to-have from
// docs/superpowers/specs/2026-08-11-screen-referral-invite-design.md:
// "Suggested share copy/template text next to the invite link ... so
// operators don't stare at a blank link with no idea what to send."

/**
 * Builds a friendly, personal message an operator can paste into a text,
 * WhatsApp message, or DM to the local business they're inviting.
 *
 * @param {{ screenName?: string|null, url: string }} params
 * @returns {string}
 */
export function buildScreenInviteShareText({ screenName, url }) {
  const place = screenName ? ` on my ${screenName} screen` : '';
  return `Hey — I just listed a screen on AdGrid and thought of you. Want first look at advertising${place}? Takes a couple minutes: ${url}`;
}
