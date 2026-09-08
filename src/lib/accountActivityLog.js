// src/lib/accountActivityLog.js
// Story Map (Agency epic): "I want an audit log of what a delegated team
// member or agency changed on my account, so I can trust granting access
// without losing visibility into what happens with it." Rows are written
// by a DB trigger on account_grants (see the account_activity_log
// migration) -- this just turns one row into a readable line.
//
// Pure, so it's testable without touching Supabase or React.

export function describeActivity(entry) {
  const who = entry.grantee?.company_name || entry.grantee?.name || entry.grantee?.email || 'Someone';
  const role = entry.role ?? 'viewer';

  switch (entry.action) {
    case 'grant_created':
      return `${who} was invited as ${role}`;
    case 'access_accepted':
      return `${who} accepted access as ${role}`;
    case 'access_revoked':
      return `${who}'s access was revoked (was ${role})`;
    case 'role_changed':
      return `${who}'s role was changed to ${role}`;
    default:
      return `${who} — ${entry.action}`;
  }
}
