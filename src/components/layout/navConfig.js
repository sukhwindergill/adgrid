// Navigation for each side of the marketplace, grouped by job rather than
// listed flat. One source for the sidebar, the phone tab bar and the
// command palette, so the three never drift apart.

export const OP_NAV = [
  { group: null, items: [
    { id: 'overview', label: 'Dashboard', icon: 'overview' },
  ] },
  { group: 'Inventory', items: [
    { id: 'screens', label: 'Screens', icon: 'screens' },
    { id: 'display', label: 'Display Manager', icon: 'display' },
    { id: 'marketplace-listings', label: 'Marketplace', icon: 'marketplace' },
  ] },
  { group: 'Campaigns', items: [
    { id: 'campaigns', label: 'Campaigns', icon: 'campaigns' },
    { id: 'approval', label: 'Approval Queue', icon: 'approval', badge: true },
    { id: 'advertisers', label: 'Advertisers', icon: 'advertisers' },
  ] },
  { group: 'Performance', items: [
    { id: 'analytics', label: 'Analytics', icon: 'analytics' },
    { id: 'revenue', label: 'Revenue', icon: 'revenue' },
    { id: 'audience', label: 'Audience & Scans', icon: 'audience' },
    { id: 'signals', label: 'Live Signals', icon: 'signals' },
    { id: 'rules', label: 'Alerts & Rules', icon: 'rules' },
  ] },
  { group: 'Account', items: [
    { id: 'integrations', label: 'Integrations', icon: 'integrations' },
    { id: 'op-settings', label: 'Settings', icon: 'settings' },
  ] },
];

export const ADV_NAV = [
  { group: null, items: [
    { id: 'adv-overview', label: 'Dashboard', icon: 'overview' },
  ] },
  { group: 'Campaigns', items: [
    { id: 'adv-campaigns', label: 'Campaigns', icon: 'campaigns' },
    { id: 'adv-marketplace', label: 'Marketplace', icon: 'marketplace' },
  ] },
  { group: 'Performance', items: [
    { id: 'adv-analytics', label: 'Analytics', icon: 'analytics' },
    { id: 'adv-audience', label: 'Scans & Data', icon: 'scans' },
    { id: 'adv-rules', label: 'Alerts & Rules', icon: 'rules' },
  ] },
  { group: 'Account', items: [
    { id: 'adv-billing', label: 'Billing', icon: 'billing' },
    { id: 'adv-integrations', label: 'Integrations', icon: 'integrations' },
    { id: 'adv-settings', label: 'Settings', icon: 'settings' },
  ] },
];

// The four destinations on the phone tab bar; everything else is under More.
export const OP_TABS = ['overview', 'screens', 'campaigns', 'approval'];
export const ADV_TABS = ['adv-overview', 'adv-campaigns', 'adv-marketplace', 'adv-analytics'];

// Views with no nav entry of their own highlight their parent.
const PARENT = {
  'screen-detail': 'screens',
  'screen-onboard': 'screens',
  'adv-create': 'adv-campaigns',
  'notif-prefs': null,
};

export function navFor(mode) {
  return mode === 'advertiser' ? ADV_NAV : OP_NAV;
}

export function tabsFor(mode) {
  const ids = mode === 'advertiser' ? ADV_TABS : OP_TABS;
  const all = navItems(mode);
  return ids.map(id => all.find(i => i.id === id));
}

export function navItems(mode) {
  return navFor(mode).flatMap(g => g.items);
}

export function highlightedNavId(active) {
  return Object.prototype.hasOwnProperty.call(PARENT, active) ? PARENT[active] : active;
}
