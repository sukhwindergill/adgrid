import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { summarizeAccountBookings } from '../../lib/accountRollup.js'
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { useT } from '../../i18n/useT.js'

function RoleBadge({ role }) {
  const { t } = useT()
  const colors = {
    admin:   { bg: C.purpleSoft, color: C.purple },
    manager: { bg: C.blueSoft,   color: C.blue },
    viewer:  { bg: C.surfaceAlt, color: C.textMuted },
  }
  const s = colors[role] ?? colors.viewer
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 10, fontSize: T.xs, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>{t(`accounts.roles.${role}`)}</span>
  )
}

function AccountCard({ account, isCurrent, onClick, rollup }) {
  const { t, formatCurrency, formatNumber } = useT()
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
            color: C.white, fontSize: T.md, fontWeight: 700, fontFamily: F.sans,
          }}>{initials}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={TX.title}>
            {account.company_name || account.name || t('accounts.hub.unnamed')}
          </div>
          {account.role && (
            <div style={{ marginTop: 4 }}>
              <RoleBadge role={account.role} />
            </div>
          )}
        </div>
        {isCurrent && (
          <span style={{ fontSize: T.xs, color: C.purple, fontFamily: F.sans, fontWeight: 600 }}>{t('accounts.hub.active')}</span>
        )}
      </div>
      {account.isOwn && (
        <div style={TX.helperMuted}>{t('accounts.hub.yours')}</div>
      )}
      {rollup && (
        <div style={{ display: 'flex', gap: 16, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{formatNumber(rollup.activeCampaigns)}</div>
            <div style={TX.caption}>{t('accounts.hub.activeCampaigns', { count: rollup.activeCampaigns })}</div>
          </div>
          <div>
            <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{formatCurrency(rollup.spend, { minimumFractionDigits: 0 })}</div>
            <div style={TX.caption}>{t('accounts.hub.spend')}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AccountHub({ onSelectAccount }) {
  const { user, profile, grants, activeAccount } = useAuth()
  const { t } = useT()

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
      <h1 style={{ fontSize: T.xxl, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{t('accounts.hub.title')}</h1>
      <p style={{ fontSize: T.md, color: C.textSub, margin: '0 0 32px' }}>
        {t('accounts.hub.sub')}
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
