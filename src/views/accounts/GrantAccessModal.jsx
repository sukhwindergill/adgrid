import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useT } from '../../i18n/useT.js'
import { Btn } from '../../components/primitives/Btn.jsx';
import { Modal } from '../../components/primitives/Modal.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';

export function GrantAccessModal({ onClose, onGranted }) {
  const { user, profile } = useAuth()
  const { t } = useT()
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState('viewer')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (!email.trim()) { setError(t('accounts.grantModal.enterEmail')); return }
    setSaving(true)
    setError(null)

    // Look up grantee by email via a scoped RPC — clients can't SELECT
    // arbitrary profile rows directly (RLS restricts profiles to your own row).
    const { data: granteeRows, error: lookupErr } = await supabase
      .rpc('lookup_profile_by_email', { lookup_email: email.trim().toLowerCase() })

    if (lookupErr) { setError(lookupErr.message); setSaving(false); return }
    const grantee = granteeRows?.[0]
    if (!grantee) { setError(t('accounts.grantModal.noAccount')); setSaving(false); return }
    if (grantee.id === user.id) { setError(t('accounts.grantModal.self')); setSaving(false); return }

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
        ? t('accounts.grantModal.duplicate')
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
  }

  return (
    <Modal onBackdropClick={onClose} label={t('accounts.grantModal.title')} maxWidth={420} padding="32px 28px" zIndex={300}
      panelStyle={{ borderRadius: 20, border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 20px' }}>
          {t('accounts.grantModal.title')}
        </h3>

        {success ? (
          <>
            <p style={{ fontSize: T.md, color: C.greenText, fontFamily: F.sans, margin: '0 0 20px' }}>
              {t('accounts.grantModal.sent', { email })}
            </p>
            <Btn onClick={() => { onClose(); onGranted?.() }} style={{ padding: '9px 22px', borderRadius: 8, fontSize: T.base }}>
              {t('accounts.grantModal.done')}
            </Btn>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...TX.body, display: 'block', fontWeight: 500, marginBottom: 6 }}>
                {t('accounts.grantModal.email')}
              </label>
              <Inp type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('accounts.grantModal.emailPlaceholder')} style={{ ...TX.body, width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', transition: 'border-color 0.15s' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ ...TX.body, display: 'block', fontWeight: 500, marginBottom: 6 }}>
                {t('accounts.grantModal.role')}
              </label>
              <SelInput value={role} onChange={e => setRole(e.target.value)} style={{ ...TX.body, width: '100%', padding: '9px 12px', borderRadius: 8, background: C.surface, transition: 'border-color 0.15s' }}>
                <option value="viewer">{t('accounts.grantModal.roleViewer')}</option>
                <option value="manager">{t('accounts.grantModal.roleManager')}</option>
                <option value="admin">{t('accounts.grantModal.roleAdmin')}</option>
              </SelInput>
            </div>

            {error && <p style={{ fontSize: T.base, color: C.redText, fontFamily: F.sans, margin: '0 0 12px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" onClick={onClose} style={{ ...TX.bodySub, flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', transition: 'background 0.15s', boxShadow: 'none', fontWeight: 400, justifyContent: 'center' }}>
                {t('common.cancel')}
              </Btn>
              <Btn onClick={submit} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: T.base, fontWeight: 600, justifyContent: 'center' }}>
                {saving ? t('accounts.grantModal.sending') : t('accounts.grantModal.send')}
              </Btn>
            </div>
          </>
        )}
    </Modal>
  )
}
