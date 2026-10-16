import { t } from '../i18n/core.js';
// src/lib/accountActivityLog.js
// Story Map (Agency epic): "I want an audit log of what a delegated team
// member or agency changed on my account, so I can trust granting access
// without losing visibility into what happens with it." Rows are written
// by a DB trigger on account_grants (see the account_activity_log
// migration) -- this just turns one row into a readable line.
//
// Pure, so it's testable without touching Supabase or React.

const KNOWN_ACTIONS = ['grant_created', 'access_accepted', 'access_revoked', 'role_changed'];

// Text comes from the locale catalogs (accounts.activity.*) in the current
// language; pass a locale to pin one.
export function describeActivity(entry, locale) {
  const who = entry.grantee?.company_name || entry.grantee?.name || entry.grantee?.email || t('accounts.activity.someone', null, locale);
  const roleKey = entry.role ?? 'viewer';
  const role = t(`accounts.roleLower.${roleKey}`, null, locale);
  const vars = { who, role: role.startsWith('accounts.') ? roleKey : role, action: entry.action };

  if (KNOWN_ACTIONS.includes(entry.action)) return t(`accounts.activity.${entry.action}`, vars, locale);
  return t('accounts.activity.other', vars, locale);
}
