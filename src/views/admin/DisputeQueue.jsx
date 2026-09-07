import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F } from '../../design/tokens.js'
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Badge } from '../../components/primitives/Badge.jsx'
import { DISPUTE_REASONS } from '../../lib/disputeReasons.js'

const reasonLabel = code => DISPUTE_REASONS.find(r => r.value === code)?.label ?? code

function useDisputes() {
  const [disputes, setDisputes] = useState([])
  const [bookings, setBookings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('disputes')
      .select('id, booking_id, reason_code, reason_text, status, resolution, resolution_note, resolved_amount, created_at, resolved_at')
      .order('created_at', { ascending: false })
    setError(Boolean(err))
    setDisputes(data ?? [])

    const bookingIds = [...new Set((data ?? []).map(d => d.booking_id))]
    if (bookingIds.length > 0) {
      const { data: bRows } = await supabase
        .from('bookings')
        .select('id, advertiser_name, screen_name, budget, currency')
        .in('id', bookingIds)
      setBookings(Object.fromEntries((bRows ?? []).map(b => [b.id, b])))
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { disputes, bookings, loading, error, refresh }
}

export function DisputeQueue() {
  const navigate = useNavigate()
  const toast = useToast()
  const { disputes, bookings, loading, error, refresh } = useDisputes()
  const [busyId, setBusyId] = useState(null)
  const [amounts, setAmounts] = useState({}) // dispute id -> partial refund amount input

  const resolve = async (dispute, resolution) => {
    const booking = bookings[dispute.booking_id]
    const amount = resolution === 'refund_partial' ? Number(amounts[dispute.id]) : undefined

    if (resolution === 'refund_partial' && (!amount || amount <= 0)) {
      toast.error('Enter a refund amount greater than $0.')
      return
    }

    setBusyId(dispute.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Session expired. Please log in again.'); setBusyId(null); return }

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/resolve-dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ dispute_id: dispute.id, resolution, amount }),
    })
    const body = await res.json().catch(() => ({}))
    setBusyId(null)

    if (!res.ok) { toast.error(body?.error ?? 'Failed to resolve dispute.'); return }
    toast.success(
      resolution === 'denied'
        ? 'Dispute denied.'
        : `Refunded $${(amount ?? booking?.budget ?? 0).toLocaleString()}.`
    )
    refresh()
  }

  const open = disputes.filter(d => d.status === 'open')
  const resolved = disputes.filter(d => d.status === 'resolved')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.display, marginBottom: 20 }}>
        Disputes
      </h1>

      {loading ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>
      ) : error ? (
        <div style={{ color: C.red, fontFamily: F.sans, fontSize: 13 }}>Couldn't load disputes — check your connection and try again.</div>
      ) : open.length === 0 ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13, marginBottom: 32 }}>No open disputes.</div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {open.map(d => {
            const booking = bookings[d.booking_id]
            return (
              <Card key={d.id} style={{ marginBottom: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{reasonLabel(d.reason_code)}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                      {booking ? `${booking.advertiser_name} · ${booking.screen_name} · $${Number(booking.budget).toLocaleString()} booked` : d.booking_id}
                    </div>
                  </div>
                  <Badge status="pending">Open</Badge>
                </div>

                {d.reason_text && (
                  <div style={{ fontSize: 13, color: C.textMid, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>{d.reason_text}</div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Btn variant="success" size="sm" disabled={busyId === d.id} onClick={() => resolve(d, 'refund_full')}>
                    {busyId === d.id ? '…' : `Refund Full ($${booking ? Number(booking.budget).toLocaleString() : '—'})`}
                  </Btn>
                  <input
                    type="number" min="0.01" step="0.01" placeholder="Partial $"
                    value={amounts[d.id] ?? ''}
                    onChange={e => setAmounts(s => ({ ...s, [d.id]: e.target.value }))}
                    style={{ width: 90, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.mono, fontSize: 12 }}
                  />
                  <Btn variant="secondary" size="sm" disabled={busyId === d.id} onClick={() => resolve(d, 'refund_partial')}>
                    {busyId === d.id ? '…' : 'Refund Partial'}
                  </Btn>
                  <Btn variant="danger" size="sm" disabled={busyId === d.id} onClick={() => resolve(d, 'denied')}>
                    {busyId === d.id ? '…' : 'Deny'}
                  </Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.display, marginBottom: 12 }}>
            Resolved
          </h2>
          {resolved.map(d => {
            const booking = bookings[d.booking_id]
            return (
              <Card key={d.id} style={{ marginBottom: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12.5, color: C.text, fontFamily: F.sans }}>{reasonLabel(d.reason_code)}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                    {booking ? `${booking.advertiser_name} · ${booking.screen_name}` : d.booking_id}
                  </div>
                </div>
                <Badge status={d.resolution === 'denied' ? 'rejected' : 'approved'}>
                  {d.resolution === 'denied' ? 'Denied' : `Refunded $${Number(d.resolved_amount ?? 0).toLocaleString()}`}
                </Badge>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
