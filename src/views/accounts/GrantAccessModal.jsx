import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'

export function GrantAccessModal({ onClose, onGranted }) {
  const { user, profile } = useAuth()
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState('viewer')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (!email.trim()) { setError('Enter an email address.'); return }
    setSaving(true)
    setError(null)

    // Look up grantee by email
    const { data: grantee, error: lookupErr } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (lookupErr) { setError(lookupErr.message); setSaving(false); return }
    if (!grantee) { setError('No AdGrid account found with that email.'); setSaving(false); return }
    if (grantee.id === user.id) { setError("You can't grant access to yourself."); setSaving(false); return }

    // Create the grant
    const appUrl = window.location.origin
    const acceptUrl = `${appUrl}/app/accept-grant?grant=`

    const { data: grant, error: insertErr } = await supabase
      .from('account_grants')
      .insert({
        account_id: user.id,
        grantee_id: grantee.id,
        invite_email: email.trim().toLowerCase(),
        role,
        granted_by: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr) {
      setError(insertErr.code === '23505'
        ? 'This account already has a grant for that user.'
        : insertErr.message)
      setSaving(false)
      return
    }

    // Send invite notification + email
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: grantee.id,
          type: 'grant_invite',
          data: {
            grantorName: profile?.company_name || profile?.name || user.email,
            role,
            acceptUrl: acceptUrl + grant.id,
            appUrl,
          },
        }),
      }).catch(e => console.error('Notification error:', e))
    }

    setSuccess(true)
    setSaving(false)
    onGranted?.()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 299 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '32px 28px', width: 420, zIndex: 300,
      }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 20px' }}>
          Grant Account Access
        </h3>

        {success ? (
          <>
            <p style={{ fontSize: 14, color: C.green, fontFamily: F.sans, margin: '0 0 20px' }}>
              ✓ Invite sent to {email}
            </p>
            <button onClick={onClose} style={{ padding: '9px 22px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 13, cursor: 'pointer' }}>
              Done
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6, fontFamily: F.sans }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agency@example.com"
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6, fontFamily: F.sans }}>
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
              >
                <option value="viewer">Viewer — read only</option>
                <option value="manager">Manager — create &amp; edit campaigns</option>
                <option value="admin">Admin — full access</option>
              </select>
            </div>

            {error && <p style={{ fontSize: 13, color: C.red, fontFamily: F.sans, margin: '0 0 12px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 13, cursor: 'pointer', color: C.textSub }}>
                Cancel
              </button>
              <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
