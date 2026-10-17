import { t } from '../../i18n/core.js';

// Navigation for each side of the marketplace, grouped by job rather than
// listed flat. One source for the sidebar, the phone tab bar and the
// command palette, so the three never drift apart.

// Labels are getters over the locale catalog (nav.item.<id>, nav.group.<key>),
// read at render time so a language switch relabels everything.
function localize(groups) {
  return groups.map(g => ({
    ...g,
    get group() { return g.groupKey ? t(`nav.group.${g.groupKey}`) : null; },
    items: g.items.map(item => ({
      ...item,
      get label() { return t(`nav.item.${item.id}`); },
    })),
  }));
}

export const OP_NAV = localize([
  { groupKey: null, items: [
    { id: 'overview', icon: 'overview' },
  ] },
  { groupKey: 'inventory', items: [
    { id: 'screens', icon: 'screens' },
    { id: 'display', icon: 'display' },
    { id: 'marketplace-listings', icon: 'marketplace' },
  ] },
  { groupKey: 'campaigns', items: [
    { id: 'campaigns', icon: 'campaigns' },
    { id: 'approval', icon: 'approval', badge: true },
    { id: 'advertisers', icon: 'advertisers' },
  ] },
  { groupKey: 'performance', items: [
    { id: 'analytics', icon: 'analytics' },
    { id: 'revenue', icon: 'revenue' },
    { id: 'audience', icon: 'audience' },
    { id: 'signals', icon: 'signals' },
    { id: 'rules', icon: 'rules' },
  ] },
  { groupKey: 'account', items: [
    { id: 'integrations', icon: 'integrations' },
    { id: 'op-settings', icon: 'settings' },
  ] },
]);

export const ADV_NAV = localize([
  { groupKey: null, items: [
    { id: 'adv-overview', icon: 'overview' },
  ] },
  { groupKey: 'campaigns', items: [
    { id: 'adv-campaigns', icon: 'campaigns' },
    { id: 'adv-marketplace', icon: 'marketplace' },
  ] },
  { groupKey: 'performance', items: [
    { id: 'adv-analytics', icon: 'analytics' },
    { id: 'adv-audience', icon: 'scans' },
    { id: 'adv-rules', icon: 'rules' },
  ] },
  { groupKey: 'account', items: [
    { id: 'adv-billing', icon: 'billing' },
    { id: 'adv-integrations', icon: 'integrations' },
    { id: 'adv-settings', icon: 'settings' },
  ] },
]);

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
