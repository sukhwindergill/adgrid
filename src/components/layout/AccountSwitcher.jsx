import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'

function RoleBadge({ role }) {
  const colors = {
    admin:   { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed' },
    manager: { bg: 'rgba(37,99,235,0.12)',  color: '#2563eb' },
    viewer:  { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
  }
  const s = colors[role] ?? colors.viewer
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600,
      textTransform: 'capitalize', background: s.bg, color: s.color,
    }}>{role}</span>
  )
}

export function AccountSwitcher() {
  const { profile, grants, activeAccount, setActiveAccount, setActiveMode } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!grants || grants.length === 0) return null

  const currentName = activeAccount
    ? (activeAccount.company_name || activeAccount.name || 'Client')
    : (profile?.company_name || profile?.name || 'My Account')

  function switchTo(account) {
    setOpen(false)
    if (!account) {
      setActiveAccount(null)
      navigate('/app/overview')
      return
    }
    setActiveAccount(account)
    setActiveMode('advertiser')
    navigate('/app/adv-overview')
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          background: activeAccount ? 'rgba(37,99,235,0.1)' : C.bg,
          border: `1px solid ${activeAccount ? C.blue : C.border}`,
          cursor: 'pointer', fontFamily: F.sans, fontSize: 13, color: C.text,
        }}
      >
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentName}
        </span>
        {activeAccount && <RoleBadge role={activeAccount.role} />}
        <span style={{ color: C.textMuted, fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
          <div style={{
            position: 'absolute', top: 38, left: 0, minWidth: 220,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            padding: '6px 0', zIndex: 200,
          }}>
            <button
              onClick={() => switchTo(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: F.sans,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: !activeAccount ? 600 : 400, color: C.text }}>
                  {profile?.company_name || profile?.name || 'My Account'}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>Your account</div>
              </div>
              {!activeAccount && <span style={{ fontSize: 10, color: C.blue }}>●</span>}
            </button>

            {grants.length > 0 && (
              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
            )}

            {grants.map(g => {
              const acct = {
                id: g.account_id,
                name: g.account?.name,
                company_name: g.account?.company_name,
                logo_url: g.account?.logo_url,
                role: g.role,
                isOwn: false,
              }
              const isActive = activeAccount?.id === g.account_id
              return (
                <button
                  key={g.id}
                  onClick={() => switchTo(acct)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: F.sans,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: C.text }}>
                      {g.account?.company_name || g.account?.name || 'Client Account'}
                    </div>
                    <div style={{ marginTop: 2 }}><RoleBadge role={g.role} /></div>
                  </div>
                  {isActive && <span style={{ fontSize: 10, color: C.blue }}>●</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
