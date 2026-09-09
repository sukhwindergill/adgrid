import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F } from '../../design/tokens.js'
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Badge } from '../../components/primitives/Badge.jsx'

// Product-audit finding: Stripe Identity flags a submission as needing a
// closer look by setting profiles.verification_status = 'pending_manual'
// (stripe-identity-webhook), and VerificationTab.jsx (Settings > Identity
// Verification) tells the operator "we'll email you once it's reviewed."
// manual-review-operator -- the only code that can move a profile out of
// pending_manual -- was fully built and deployed, but nothing in the app
// ever called it: there was no admin page to review a submission from.
// An operator flagged for manual review had no way to ever leave that
// state. This is that missing review queue.

function useVerificationQueue() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [pendingRes, reviewedRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, created_at')
        .eq('verification_status', 'pending_manual')
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, name, email, verification_status, verified_at, verification_rejection_reason')
        .in('verification_status', ['verified', 'rejected'])
        .order('verified_at', { ascending: false })
        .limit(20),
    ])
    setError(Boolean(pendingRes.error || reviewedRes.error))
    setPending(pendingRes.data ?? [])
    setReviewed(reviewedRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { pending, reviewed, loading, error, refresh }
}

export function OperatorVerificationQueue() {
  const navigate = useNavigate()
  const toast = useToast()
  const { pending, reviewed, loading, error, refresh } = useVerificationQueue()
  const [busyId, setBusyId] = useState(null)
  const [reasons, setReasons] = useState({}) // operator id -> rejection reason input

  const review = async (operatorId, decision) => {
    const notes = decision === 'rejected' ? (reasons[operatorId] ?? '').trim() : undefined

    setBusyId(operatorId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Session expired. Please log in again.'); setBusyId(null); return }

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manual-review-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ operatorId, decision, notes }),
    })
    const body = await res.json().catch(() => ({}))
    setBusyId(null)

    if (!res.ok) { toast.error(body?.error ?? 'Failed to submit review.'); return }
    toast.success(decision === 'approved' ? 'Operator approved.' : 'Operator rejected.')
    refresh()
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.display, marginBottom: 20 }}>
        Identity Verification Queue
      </h1>

      {loading ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>
      ) : error ? (
        <div style={{ color: C.red, fontFamily: F.sans, fontSize: 13 }}>Couldn't load the queue — check your connection and try again.</div>
      ) : pending.length === 0 ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13, marginBottom: 32 }}>Nothing awaiting manual review.</div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {pending.map(op => (
            <Card key={op.id} style={{ marginBottom: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{op.name ?? 'Unnamed operator'}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{op.email}</div>
                </div>
                <Badge status="pending">Needs review</Badge>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <Btn variant="success" size="sm" disabled={busyId === op.id} onClick={() => review(op.id, 'approved')}>
                  {busyId === op.id ? '…' : 'Approve'}
                </Btn>
                <input
                  type="text" placeholder="Rejection reason (optional)"
                  value={reasons[op.id] ?? ''}
                  onChange={e => setReasons(r => ({ ...r, [op.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 12 }}
                />
                <Btn variant="danger" size="sm" disabled={busyId === op.id} onClick={() => review(op.id, 'rejected')}>
                  {busyId === op.id ? '…' : 'Reject'}
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.display, marginBottom: 12 }}>
            Recently reviewed
          </h2>
          {reviewed.map(op => (
            <Card key={op.id} style={{ marginBottom: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, color: C.text, fontFamily: F.sans }}>{op.name ?? 'Unnamed operator'}</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{op.email}</div>
              </div>
              <Badge status={op.verification_status === 'rejected' ? 'rejected' : 'approved'}>
                {op.verification_status === 'rejected' ? 'Rejected' : 'Verified'}
              </Badge>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
