# CRO Audit — AdGrid Homepage/Signup Funnel

## Findings
1. **Objection handling was under-surfaced in the hero** — "no minimums" existed in FAQ/HowItWorks but not above the fold. Fixed in `Hero.jsx` (see `docs/marketing/copywriting.md`).
2. **Two competing primary CTAs in the hero** ("List your screens" vs. "Book a campaign") — correct for a two-sided marketplace, but means neither gets full visual priority. Recommend testing a single dominant CTA driven by session context (e.g. UTM campaign side) per `docs/marketing/ab-testing.md` item eligible for a future test.
3. **Live screen count only renders conditionally** (`liveCount >= 1`) — good defensive UX (avoids showing "0 screens live"), but means early-market visitors get no social proof at all. Consider a qualitative fallback stat (e.g. "Launching in Toronto & Vancouver") when the live count is unavailable — the city stat already partially covers this.
4. **No visible trust/social proof section found** (no testimonials/logos component in `src/views/marketing/sections`) — flag for a future section once real operator/advertiser case studies exist (ties to `docs/marketing/content-strategy.md` pillar 1).

## Next tests to queue
See `docs/marketing/ab-testing.md` backlog #1 and #2 (earnings estimate on listing form, "no minimum spend" near checkout CTA).
