import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'
import { GrantAccessModal } from './GrantAccessModal.jsx'
import { describeActivity } from '../../lib/accountActivityLog.js'

const ROLE_COLORS = {
  admin:   { bg: C.purpleSoft, color: C.purple },
  manager: { bg: C.blueSoft,   color: C.blue },
  viewer:  { bg: C.surfaceAlt, color: C.textMuted },
}

export function AccessSettingsView() {
  const { user } = useAuth()
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

  if (loading) return <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>Loading…</p>

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.display, margin: 0 }}>
          Who has access to your account
        </h3>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '8px 16px', borderRadius: 8, background: C.purple, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Grant Access
        </button>
      </div>

      {loadError ? (
        <p style={{ fontSize: 13, color: C.red, fontFamily: F.sans }}>Couldn't load access grants — check your connection and try again.</p>
      ) : grants.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No one has access to your account yet.</p>
      ) : (
        grants.map(g => {
          const rc = ROLE_COLORS[g.role] ?? ROLE_COLORS.viewer
          return (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>
                  {g.grantee?.company_name || g.grantee?.name || g.invite_email || 'Unknown'}
                </div>
                <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>
                  {g.grantee?.email || g.invite_email}
                </div>
              </div>
              <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', background: rc.bg, color: rc.color }}>{g.role}</span>
              <span style={{ fontSize: 11, color: statusColor[g.status] ?? C.textMuted, fontFamily: F.sans, fontWeight: 500 }}>{g.status}</span>
              <button
                onClick={() => revoke(g.id)}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 12, color: C.red, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.redSoft; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Revoke
              </button>
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

      <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.display, margin: '32px 0 12px' }}>
        Activity
      </h3>
      {activityError ? (
        <p style={{ fontSize: 13, color: C.red, fontFamily: F.sans }}>Couldn't load activity — check your connection and try again.</p>
      ) : activity.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No access changes on your account yet.</p>
      ) : (
        activity.map(entry => (
          <div key={entry.id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 2px',
            borderBottom: `1px solid ${C.border}`, fontFamily: F.sans,
          }}>
            <span style={{ fontSize: 13, color: C.text }}>{describeActivity(entry)}</span>
            <span style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>{new Date(entry.created_at).toLocaleDateString()}</span>
          </div>
        ))
      )}
    </div>
  )
}
