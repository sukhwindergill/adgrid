import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F, T } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { Pill } from '../primitives/Pill.jsx';
import { MenuPanel, MenuItem, MenuBackdrop } from '../primitives/Menu.jsx';
import { useT } from '../../i18n/useT.js'

const ROLE_TONE = { admin: 'purple', manager: 'blue', viewer: 'neutral' }

function RoleBadge({ role }) {
  const { t } = useT()
  return (
    <Pill tone={ROLE_TONE[role] ?? 'neutral'} style={{ padding: '2px 7px', borderRadius: 8 }}>
      {ROLE_TONE[role] ? t(`accounts.roles.${role}`) : role}
    </Pill>
  )
}

const ActiveDot = () => <span style={{ fontSize: T.xs, color: C.blueText }}>●</span>

export function AccountSwitcher() {
  const { profile, grants, activeAccount, setActiveAccount, setActiveMode } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!grants || grants.length === 0) return null

  const currentName = activeAccount
    ? (activeAccount.company_name || activeAccount.name || t('shell.client'))
    : (profile?.company_name || profile?.name || t('shell.myAccount'))

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
      <Btn
        variant="unstyled"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          background: activeAccount ? C.blueSoft : C.bg,
          border: `1px solid ${activeAccount ? C.blue : C.border}`,
          fontFamily: F.sans, fontSize: T.base, color: C.text,
        }}
      >
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentName}
        </span>
        {activeAccount && <RoleBadge role={activeAccount.role} />}
        <span style={{ color: C.textMuted, fontSize: T.xs }}>▾</span>
      </Btn>

      {open && (
        <>
          <MenuBackdrop onClose={() => setOpen(false)} />
          <MenuPanel role="menu" style={{ top: 38, left: 0, minWidth: 220, padding: '6px 0' }}>
            <MenuItem role="menuitem" onClick={() => switchTo(null)} style={{ padding: '8px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: T.base, fontWeight: !activeAccount ? 600 : 400, color: C.text }}>
                  {profile?.company_name || profile?.name || t('shell.myAccount')}
                </div>
                <div style={{ fontSize: T.xs, color: C.textMuted }}>{t('shell.yourAccount')}</div>
              </div>
              {!activeAccount && <ActiveDot />}
            </MenuItem>

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
                <MenuItem role="menuitem" key={g.id} onClick={() => switchTo(acct)} style={{ padding: '8px 14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: T.base, fontWeight: isActive ? 600 : 400, color: C.text }}>
                      {g.account?.company_name || g.account?.name || t('shell.clientAccount')}
                    </div>
                    <div style={{ marginTop: 2 }}><RoleBadge role={g.role} /></div>
                  </div>
                  {isActive && <ActiveDot />}
                </MenuItem>
              )
            })}
          </MenuPanel>
        </>
      )}
    </div>
  )
}
