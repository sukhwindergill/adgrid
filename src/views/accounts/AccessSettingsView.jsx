import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { GrantAccessModal } from './GrantAccessModal.jsx'
import { describeActivity } from '../../lib/accountActivityLog.js'
import { useT } from '../../i18n/useT.js'
import { Btn } from '../../components/primitives/Btn.jsx';

const ROLE_COLORS = {
  admin:   { bg: C.purpleSoft, color: C.purple },
  manager: { bg: C.blueSoft,   color: C.blueText },
  viewer:  { bg: C.surfaceAlt, color: C.textMuted },
}

export function AccessSettingsView() {
  const { user } = useAuth()
  const { t, formatDate } = useT()
  const [grants, setGrants]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [activity, setActivity] = useState([])
  const [activityError, setActivityError] = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('account_grants')
      .select('*, grantee:grantee_id(name, email, company_name)')
      .eq('account_id', user.id)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })
    setLoadError(Boolean(error))
    setGrants(data ?? [])
    setLoading(false)
  }

  async function loadActivity() {
    // Written only by the account_grants_log_activity trigger -- never a
    // direct client insert -- so this is exactly what happened, not what
    // a delegate chose to report about themselves.
    const { data, error } = await supabase
      .from('account_activity_log')
      .select('*, grantee:grantee_id(name, email, company_name)')
      .eq('account_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setActivityError(Boolean(error))
    setActivity(data ?? [])
  }

  useEffect(() => { load(); loadActivity() }, [user.id])

  async function revoke(grantId) {
    await supabase.from('account_grants').update({ status: 'revoked' }).eq('id', grantId)
    setGrants(prev => prev.filter(g => g.id !== grantId))
    loadActivity()
  }

  const statusColor = { pending: C.amber, active: C.green, revoked: C.red }

  if (loading) return <p style={TX.bodySub}>{t('common.loading')}</p>

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: T.lg, fontWeight: 600, color: C.text, fontFamily: F.display, margin: 0 }}>
          {t('accounts.access.heading')}
        </h3>
        <Btn onClick={() => setShowModal(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: T.base, fontWeight: 500 }}>
          {t('accounts.access.grant')}
        </Btn>
      </div>

      {loadError ? (
        <p style={{ fontSize: T.base, color: C.redText, fontFamily: F.sans }}>{t('accounts.access.loadError')}</p>
      ) : grants.length === 0 ? (
        <p style={TX.bodySub}>{t('accounts.access.empty')}</p>
      ) : (
        grants.map(g => {
          const rc = ROLE_COLORS[g.role] ?? ROLE_COLORS.viewer
          return (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...TX.body, fontWeight: 500 }}>
                  {g.grantee?.company_name || g.grantee?.name || g.invite_email || t('accounts.access.unknown')}
                </div>
                <div style={{ ...TX.helper, marginTop: 2 }}>
                  {g.grantee?.email || g.invite_email}
                </div>
              </div>
              <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: T.xs, fontWeight: 600, background: rc.bg, color: rc.color }}>{t(`accounts.roles.${g.role}`)}</span>
              <span style={{ fontSize: T.xs, color: statusColor[g.status] ?? C.textMuted, fontFamily: F.sans, fontWeight: 500 }}>{t(`accounts.grantStatus.${g.status}`)}</span>
              <Btn variant="secondary" onClick={() => revoke(g.id)} style={{ ...TX.error, padding: '4px 10px', borderRadius: 6, background: 'transparent', transition: 'background 0.15s', boxShadow: 'none', fontWeight: 400 }} hoverStyle={{ background: C.redSoft }}>
                {t('accounts.access.revoke')}
              </Btn>
            </div>
          )
        })
      )}

      {showModal && (
        <GrantAccessModal
          onClose={() => setShowModal(false)}
          onGranted={() => { setShowModal(false); load(); loadActivity() }}
        />
      )}

      <h3 style={{ fontSize: T.lg, fontWeight: 600, color: C.text, fontFamily: F.display, margin: '32px 0 12px' }}>
        {t('accounts.access.activity')}
      </h3>
      {activityError ? (
        <p style={{ fontSize: T.base, color: C.redText, fontFamily: F.sans }}>{t('accounts.access.activityError')}</p>
      ) : activity.length === 0 ? (
        <p style={TX.bodySub}>{t('accounts.access.activityEmpty')}</p>
      ) : (
        activity.map(entry => (
          <div key={entry.id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 2px',
            borderBottom: `1px solid ${C.border}`, fontFamily: F.sans,
          }}>
            <span style={{ fontSize: T.base, color: C.text }}>{describeActivity(entry)}</span>
            <span style={{ fontSize: T.sm, color: C.textMuted, flexShrink: 0 }}>{formatDate(entry.created_at)}</span>
          </div>
        ))
      )}
    </div>
  )
}
