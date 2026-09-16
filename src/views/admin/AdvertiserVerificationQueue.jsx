import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F } from '../../design/tokens.js'
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Badge } from '../../components/primitives/Badge.jsx'

function useVerificationQueue() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [pendingRes, reviewedRes] = await Promise.all([
      supabase
        .from('advertiser_verifications')
        .select('id, profile_id, company_name, business_number, business_domain, doc_storage_path, created_at, profiles!advertiser_verifications_profile_id_fkey(name, email)')
        .eq('status', 'pending_manual')
        .order('created_at', { ascending: true }),
      supabase
        .from('advertiser_verifications')
        .select('id, profile_id, company_name, status, reviewed_at, rejection_reason, profiles!advertiser_verifications_profile_id_fkey(name, email)')
        .in('status', ['verified', 'rejected'])
        .order('reviewed_at', { ascending: false })
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

export function AdvertiserVerificationQueue() {
  const navigate = useNavigate()
  const toast = useToast()
  const { pending, reviewed, loading, error, refresh } = useVerificationQueue()
  const [busyId, setBusyId] = useState(null)
  const [reasons, setReasons] = useState({})

  const review = async (verificationId, decision) => {
    const notes = decision === 'rejected' ? (reasons[verificationId] ?? '').trim() : undefined

    setBusyId(verificationId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Session expired. Please log in again.'); setBusyId(null); return }

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manual-review-advertiser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ verificationId, decision, notes }),
    })
    const body = await res.json().catch(() => ({}))
    setBusyId(null)

    if (!res.ok) { toast.error(body?.error ?? 'Failed to submit review.'); return }
    toast.success(decision === 'approved' ? 'Advertiser verified.' : 'Submission rejected.')
    refresh()
  }

  const viewDoc = async (path) => {
    if (!path) return
    const { data, error: signErr } = await supabase.storage.from('advertiser-docs').createSignedUrl(path, 300)
    if (signErr || !data) { toast.error('Could not load document.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.display, marginBottom: 20 }}>
        Advertiser Verification Queue
      </h1>

      {loading ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>
      ) : error ? (
        <div style={{ color: C.red, fontFamily: F.sans, fontSize: 13 }}>Couldn't load the queue — check your connection and try again.</div>
      ) : pending.length === 0 ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13, marginBottom: 32 }}>Nothing awaiting manual review.</div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {pending.map(v => (
            <Card key={v.id} style={{ marginBottom: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{v.company_name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                    {v.profiles?.name ?? 'Unnamed advertiser'} · {v.profiles?.email}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                    Domain: {v.business_domain}{v.business_number ? ` · Business #: ${v.business_number}` : ''}
                  </div>
                </div>
                <Badge status="pending">Needs review</Badge>
              </div>

              {v.doc_storage_path && (
                <Btn variant="ghost" size="sm" onClick={() => viewDoc(v.doc_storage_path)} style={{ marginBottom: 12 }}>
                  View document
                </Btn>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <Btn variant="success" size="sm" disabled={busyId === v.id} onClick={() => review(v.id, 'approved')}>
                  {busyId === v.id ? '…' : 'Approve'}
                </Btn>
                <input
                  type="text" placeholder="Rejection reason (optional)"
                  value={reasons[v.id] ?? ''}
                  onChange={e => setReasons(r => ({ ...r, [v.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 12 }}
                />
                <Btn variant="danger" size="sm" disabled={busyId === v.id} onClick={() => review(v.id, 'rejected')}>
                  {busyId === v.id ? '…' : 'Reject'}
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
          {reviewed.map(v => (
            <Card key={v.id} style={{ marginBottom: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, color: C.text, fontFamily: F.sans }}>{v.company_name}</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                  {v.profiles?.name ?? 'Unnamed advertiser'} · {v.profiles?.email}
                </div>
              </div>
              <Badge status={v.status === 'rejected' ? 'rejected' : 'approved'}>
                {v.status === 'rejected' ? 'Rejected' : 'Verified'}
              </Badge>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
