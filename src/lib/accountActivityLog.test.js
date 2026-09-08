import { describe, it, expect } from 'vitest';
import { describeActivity } from './accountActivityLog.js';

describe('describeActivity', () => {
  it('describes a new grant', () => {
    expect(describeActivity({ action: 'grant_created', role: 'manager', grantee: { name: 'Jane' } }))
      .toBe('Jane was invited as manager');
  });

  it('describes an accepted grant', () => {
    expect(describeActivity({ action: 'access_accepted', role: 'admin', grantee: { name: 'Jane' } }))
      .toBe('Jane accepted access as admin');
  });

  it('describes a revocation, naming the role that was revoked', () => {
    expect(describeActivity({ action: 'access_revoked', role: 'viewer', grantee: { name: 'Jane' } }))
      .toBe("Jane's access was revoked (was viewer)");
  });

  it('describes a role change', () => {
    expect(describeActivity({ action: 'role_changed', role: 'admin', grantee: { name: 'Jane' } }))
      .toBe("Jane's role was changed to admin");
  });

  it('prefers company_name, then name, then email for who', () => {
    expect(describeActivity({ action: 'grant_created', role: 'viewer', grantee: { company_name: 'Acme Agency', name: 'Jane', email: 'jane@acme.com' } }))
      .toBe('Acme Agency was invited as viewer');
    expect(describeActivity({ action: 'grant_created', role: 'viewer', grantee: { email: 'jane@acme.com' } }))
      .toBe('jane@acme.com was invited as viewer');
  });

  it('falls back gracefully when the grantee profile is missing', () => {
    expect(describeActivity({ action: 'grant_created', role: 'viewer', grantee: null }))
      .toBe('Someone was invited as viewer');
  });

  it('defaults to viewer when no role is recorded', () => {
    expect(describeActivity({ action: 'grant_created', role: null, grantee: { name: 'Jane' } }))
      .toBe('Jane was invited as viewer');
  });
});
