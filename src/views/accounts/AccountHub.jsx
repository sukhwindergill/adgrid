import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { summarizeAccountBookings } from '../../lib/accountRollup.js'
import { C, F } from '../../design/tokens.js'

function RoleBadge({ role }) {
  const colors = {
    admin:   { bg: C.purpleSoft, color: C.purple },
    manager: { bg: C.blueSoft,   color: C.blue },
    viewer:  { bg: C.surfaceAlt, color: C.textMuted },
  }
  const s = colors[role] ?? colors.viewer
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize', background: s.bg, color: s.color,
    }}>{role}</span>
  )
}

function AccountCard({ account, isCurrent, onClick, rollup }) {
  const initials = (account.name || account.company_name || '?').slice(0, 2).toUpperCase()
  return (
    <div
      onClick={onClick}
      style={{
        background: C.surface,
        border: `2px solid ${isCurrent ? C.purple : C.border}`,
        borderRadius: 16,
        padding: '24px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isCurrent ? `0 0 0 3px rgba(123,47,255,0.12)` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.borderColor = C.textMuted }}
      onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.borderColor = C.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {account.logo_url ? (
          <img src={account.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: C.grad,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: F.sans,
          }}>{initials}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
            {account.company_name || account.name || 'Unnamed Account'}
          </div>
          {account.role && (
            <div style={{ marginTop: 4 }}>
              <RoleBadge role={account.role} />
            </div>
          )}
        </div>
        {isCurrent && (
          <span style={{ fontSize: 11, color: C.purple, fontFamily: F.sans, fontWeight: 600 }}>Active</span>
        )}
      </div>
      {account.isOwn && (
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>Your account</div>
      )}
      {rollup && (
        <div style={{ display: 'flex', gap: 16, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{rollup.activeCampaigns}</div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>active campaign{rollup.activeCampaigns === 1 ? '' : 's'}</div>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono }}>${rollup.spend.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>spend to date</div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AccountHub({ onSelectAccount }) {
  const { user, profile, grants, activeAccount } = useAuth()

  const ownAccount = {
    id: user?.id,
    name: profile?.name,
    company_name: profile?.company_name,
    logo_url: profile?.logo_url,
    role: 'admin',
    isOwn: true,
  }

  const grantAccounts = grants.map(g => ({
    id: g.account_id,
    name: g.account?.name,
    company_name: g.account?.company_name,
    logo_url: g.account?.logo_url,
    role: g.role,
    isOwn: false,
  }))

  const allAccounts = [ownAccount, ...grantAccounts]

  // Rollup only earns its place once there's more than one account to
  // compare -- a solo user's own single card needs no spend summary
  // sitting next to nothing to compare it against.
  const [rollup, setRollup] = useState({})
  useEffect(() => {
    // Nothing to roll up with only one account -- initial state is already
    // {}, so there's no stale rollup left over from a prior account switch.
    if (grantAccounts.length === 0) return
    let cancelled = false
    const accountIds = allAccounts.map(a => a.id).filter(Boolean)
    // bookings_grant_select RLS already scopes this to accounts the caller
    // has a grant on (plus their own row) -- one query covers every card,
    // no per-account round trip.
    supabase
      .from('bookings')
      .select('advertiser_id, status, spent')
      .in('advertiser_id', accountIds)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        setRollup(summarizeAccountBookings(data, accountIds))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantAccounts.length, user?.id])

  function select(account) {
    onSelectAccount(account)
  }

  return (
    <div style={{ padding: '48px 40px', maxWidth: 860, margin: '0 auto', fontFamily: F.sans }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Accounts</h1>
      <p style={{ fontSize: 14, color: C.textSub, margin: '0 0 32px' }}>
        Select an account to manage. You can switch at any time from the header.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {allAccounts.map(account => (
          <AccountCard
            key={account.id}
            account={account}
            isCurrent={
              account.isOwn
                ? !activeAccount
                : activeAccount?.id === account.id
            }
            onClick={() => select(account)}
            rollup={rollup[account.id]}
          />
        ))}
      </div>
    </div>
  )
}
