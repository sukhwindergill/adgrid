import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../lib/constants.js'

export function TeamClientRoles() {
  const { user } = useAuth()
  const [members, setMembers]         = useState([])
  const [clients, setClients]         = useState([])
  const [selected, setSelected]       = useState(null)
  const [clientRoles, setClientRoles] = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('team_members')
        .select('*, user_profile:user_profile_id(name, email)')
        .eq('org_profile_id', user.id),
      supabase
        .from('account_grants')
        .select('*, account:account_id(id, name, company_name)')
        .eq('grantee_id', user.id)
        .eq('status', 'active'),
    ]).then(([mbRes, clRes]) => {
      setMembers(mbRes.data ?? [])
      setClients(clRes.data ?? [])
      setLoading(false)
    })
  }, [user.id])

  async function selectMember(member) {
    setSelected(member)
    const { data } = await supabase
      .from('team_member_client_roles')
      .select('*')
      .eq('team_member_id', member.id)
    setClientRoles(data ?? [])
  }

  async function setRole(clientAccountId, role) {
    const existing = clientRoles.find(r => r.client_account_id === clientAccountId)
    setSaving(true)
    if (role === 'none') {
      if (existing) {
        await supabase.from('team_member_client_roles').delete().eq('id', existing.id)
        setClientRoles(prev => prev.filter(r => r.client_account_id !== clientAccountId))
      }
    } else if (existing) {
      await supabase.from('team_member_client_roles').update({ role }).eq('id', existing.id)
      setClientRoles(prev => prev.map(r => r.client_account_id === clientAccountId ? { ...r, role } : r))
    } else {
      const { data: newRow } = await supabase
        .from('team_member_client_roles')
        .insert({ team_member_id: selected.id, client_account_id: clientAccountId, role })
        .select()
        .single()
      if (newRow) setClientRoles(prev => [...prev, newRow])
    }
    setSaving(false)
  }

  if (loading) return <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>Loading…</p>
  if (clients.length === 0) return (
    <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>
      No client accounts yet. Ask a client to grant you access first.
    </p>
  )

  return (
    <div style={{ maxWidth: 620, display: 'flex', gap: 20 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: F.sans, marginBottom: 10 }}>Team</div>
        {members.length === 0 && <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No team members yet.</p>}
        {members.map(m => (
          <button
            key={m.id}
            onClick={() => selectMember(m)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
              borderRadius: 8, border: `1px solid ${selected?.id === m.id ? C.blue : C.border}`,
              background: selected?.id === m.id ? 'rgba(37,99,235,0.06)' : 'transparent',
              marginBottom: 6, cursor: 'pointer', fontFamily: F.sans,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{m.user_profile?.name || m.user_profile?.email}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{m.role}</div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        {!selected ? (
          <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, paddingTop: 8 }}>Select a team member to manage their client access.</p>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: F.sans, marginBottom: 10 }}>
              Client Access for {selected.user_profile?.name || selected.user_profile?.email}
            </div>
            {clients.map(g => {
              const current = clientRoles.find(r => r.client_account_id === g.account_id)
              return (
                <div key={g.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>
                      {g.account?.company_name || g.account?.name || 'Client Account'}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>
                      Org grant: {g.role}
                    </div>
                  </div>
                  <select
                    value={current?.role ?? 'none'}
                    onChange={e => setRole(g.account_id, e.target.value)}
                    disabled={saving}
                    style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 12, color: C.text, background: C.surface }}
                  >
                    <option value="none">No access</option>
                    <option value="viewer">Viewer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
