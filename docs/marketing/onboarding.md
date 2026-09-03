# Onboarding — AdGrid

Operator onboarding lives in `src/views/operator/ScreenOnboard.jsx` (759 lines — a multi-step flow). Advertiser-side onboarding is the campaign-creation flow under `src/views/advertiser/createCampaign/`.

## Principles to apply
1. **Show progress, not just steps.** Multi-step forms lose completion rate fast without a visible "step X of Y" — verify `ScreenOnboard.jsx` surfaces this (worth a UX pass if not).
2. **Front-load the payoff, not the paperwork.** Ask for the earnings-relevant info (venue type, location) before compliance/detail fields — reinforces the "you're about to earn money" frame from `marketing-psychology.md`.
3. **Autosave / resumability.** Since operator onboarding likely spans multiple sessions (screen placement photos, corner-marking via `CornerMarker.jsx`), make sure partial progress persists — ties to the "listing incomplete" lifecycle email in `emails.md`.
4. **First-session success signal.** Advertiser onboarding should get to "you can see your ad rendered on the actual screen" (leverages `AdRenderPreview.jsx`, already in the codebase) as fast as possible — visual proof beats a confirmation message.

## Metric to own
Onboarding completion rate by step (funnel breakdown, feeds `analytics.md`) — identify the single highest-drop-off step first rather than optimizing the whole flow at once.
