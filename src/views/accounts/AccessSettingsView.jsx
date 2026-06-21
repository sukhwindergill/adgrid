import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'
import { GrantAccessModal } from './GrantAccessModal.jsx'

const ROLE_COLORS = {
  admin:   { bg: 'rgba(124,58,237,0.1)', color: '#7c3aed' },
  manager: { bg: 'rgba(37,99,235,0.1)',  color: '#2563eb' },
  viewer:  { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
}

export function AccessSettingsView() {
  const { user } = useAuth()
  const [grants, setGrants]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('account_grants')
      .select('*, grantee:grantee_id(name, email, company_name)')
      .eq('account_id', user.id)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })
    setGrants(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  async function revoke(grantId) {
    await supabase.from('account_grants').update({ status: 'revoked' }).eq('id', grantId)
    setGrants(prev => prev.filter(g => g.id !== grantId))
  }

  const statusColor = { pending: '#f59e0b', active: C.green, revoked: C.red }

  if (loading) return <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>Loading…</p>

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, margin: 0 }}>
          Who has access to your account
        </h3>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '8px 16px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          Grant Access
        </button>
      </div>

      {grants.length === 0 ? (
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
                style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 12, color: C.red, cursor: 'pointer' }}
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
          onGranted={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
