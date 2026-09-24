// Getting-started checklist steps for each side of the marketplace. Pure
// functions of data the dashboards already load, so the card never needs a
// fetch of its own to know what's done (the advertiser card-on-file check
// is the one exception; see AdvDashboard).
//
// Each step: { id, title, body, done, nav } where `nav` is the id passed to
// App's navTo, which routes to /app/<nav>.
import { isProfileComplete } from './screenGoLive.js';

export function operatorSteps({ screens = [], connectStatus } = {}) {
  const hasScreen = screens.length > 0;
  return [
    {
      id: 'add-screen',
      title: 'Add your first screen',
      body: 'Name it and pick the venue type. Takes about a minute.',
      done: hasScreen,
      nav: 'screen-onboard',
    },
    {
      id: 'pair',
      title: 'Pair the display player',
      body: 'Open the player link on the screen so we can see it running.',
      done: screens.some(s => s.last_seen != null),
      nav: 'screens',
    },
    {
      id: 'profile',
      title: 'Finish the screen profile',
      body: 'Location, environment, size and daily foot traffic. Advertisers see these before booking.',
      done: screens.some(isProfileComplete),
      nav: 'screens',
    },
    {
      id: 'payouts',
      title: 'Connect payouts',
      body: "Link a bank account through Stripe. Screens can't go live without it.",
      done: connectStatus === 'active',
      nav: 'op-settings',
    },
    {
      id: 'live',
      title: 'Go live',
      body: 'Once the steps above are done, switch your screen on for bookings.',
      done: screens.some(s => s.status === 'live'),
      nav: 'screens',
    },
  ];
}

// hasCard: true / false once known, null while the billing lookup is
// pending or failed -- treated as not done so the step stays visible.
export function advertiserSteps({ isVerified, hasCard, hasCampaign } = {}) {
  return [
    {
      id: 'verify',
      title: 'Verify your business',
      body: 'Verified advertisers get a badge and can be auto-approved by operators.',
      done: Boolean(isVerified),
      nav: 'verification',
    },
    {
      id: 'card',
      title: 'Add a payment method',
      body: 'Needed before a campaign can run. Change or remove it any time under Billing.',
      done: hasCard === true,
      nav: 'adv-billing',
    },
    {
      id: 'campaign',
      title: 'Launch your first campaign',
      body: 'Pick screens, upload your ad and set a budget. No minimum spend.',
      done: Boolean(hasCampaign),
      nav: 'adv-create',
    },
  ];
}

export function checklistProgress(steps) {
  const done = steps.filter(s => s.done).length;
  return { done, total: steps.length, complete: done === steps.length, next: steps.find(s => !s.done) ?? null };
}
