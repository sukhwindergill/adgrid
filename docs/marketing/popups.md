# Popups — AdGrid

## Recommended popup use (sparingly — two-sided marketplace, don't annoy either side)
- **Exit-intent on advertiser landing sections** (`AdvertisersSection.jsx`): if a visitor scrolls the advertiser section and moves to leave without clicking "Book a campaign," offer the lead magnet from `lead-magnets.md` (DOOH cost guide) instead of a hard sell.
- **Exit-intent on operator landing sections** (`OperatorsSection.jsx`): offer the earnings calculator (`free-tools.md`) as a lower-commitment alternative to "List your screens" for visitors not ready to sign up.
- **Post-signup, not pre-signup, for offers**: surface `offers.md` incentives (first-campaign credit, 90-day fee waiver) after email capture, not as an interruptive homepage popup — respects the clean, benefit-first tone already established in `copywriting.md`.

## Explicitly avoid
- Newsletter popups with no clear value exchange — mismatched with a self-serve product where the CTA should always be "list" or "book," not "subscribe."
- Timed popups that fire before a visitor has read the value prop — let the hero and objection-handling copy do the work first (`cro-audit.md`).

## Status
No popup component exists in `src/views/marketing` today — this is a recommendation for future implementation, not a code change in this pass.
