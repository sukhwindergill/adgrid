import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Inp } from '../../components/primitives/Inp.jsx'
import { compactField } from '../../components/primitives/field.js'
import { Badge } from '../../components/primitives/Badge.jsx'
import { DISPUTE_REASONS } from '../../lib/disputeReasons.js'
import { useT } from '../../i18n/useT.js'

const reasonLabel = (code, tOr) => tOr(`widgets.dispute.reason.${code}`, DISPUTE_REASONS.find(r => r.value === code)?.label ?? code)

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
  const { t, tOr, formatCurrency } = useT()
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 })
  const { disputes, bookings, loading, error, refresh } = useDisputes()
  const [busyId, setBusyId] = useState(null)
  const [amounts, setAmounts] = useState({}) // dispute id -> partial refund amount input

  const resolve = async (dispute, resolution) => {
    const booking = bookings[dispute.booking_id]
    const amount = resolution === 'refund_partial' ? Number(amounts[dispute.id]) : undefined

    if (resolution === 'refund_partial' && (!amount || amount <= 0)) {
      toast.error(t('admin.disputes.amountRequired'))
      return
    }

    setBusyId(dispute.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error(t('admin.sessionExpired')); setBusyId(null); return }

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/resolve-dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ dispute_id: dispute.id, resolution, amount }),
    })
    const body = await res.json().catch(() => ({}))
    setBusyId(null)

    if (!res.ok) { toast.error(body?.error ?? t('admin.disputes.resolveFailed')); return }
    toast.success(
      resolution === 'denied'
        ? t('admin.disputes.denied')
        : t('admin.disputes.refunded', { amount: money(amount ?? booking?.budget ?? 0) })
    )
    refresh()
  }

  const open = disputes.filter(d => d.status === 'open')
  const resolved = disputes.filter(d => d.status === 'resolved')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        {t('admin.back')}
      </Btn>
      <h1 style={{ ...TX.pageTitle, marginBottom: 20 }}>
        {t('admin.disputes.title')}
      </h1>

      {loading ? (
        <div style={TX.bodySub}>{t('common.loading')}</div>
      ) : error ? (
        <div style={{ color: C.redText, fontFamily: F.sans, fontSize: T.base }}>{t('admin.disputes.loadError')}</div>
      ) : open.length === 0 ? (
        <div style={{ ...TX.bodySub, marginBottom: 32 }}>{t('admin.disputes.empty')}</div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {open.map(d => {
            const booking = bookings[d.booking_id]
            return (
              <Card key={d.id} style={{ marginBottom: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={TX.strong}>{reasonLabel(d.reason_code, tOr)}</div>
                    <div style={{ ...TX.caption, marginTop: 2 }}>
                      {booking ? t('admin.disputes.booked', { advertiser: booking.advertiser_name, screen: booking.screen_name, amount: money(Number(booking.budget)) }) : d.booking_id}
                    </div>
                  </div>
                  <Badge status="pending">{t('admin.disputes.open')}</Badge>
                </div>

                {d.reason_text && (
                  <div style={{ fontSize: T.base, color: C.textMid, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>{d.reason_text}</div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Btn variant="success" size="sm" disabled={busyId === d.id} onClick={() => resolve(d, 'refund_full')}>
                    {busyId === d.id ? '…' : t('admin.disputes.refundFull', { amount: booking ? money(Number(booking.budget)) : '—' })}
                  </Btn>
                  <Inp
                    type="number" min="0.01" step="0.01" placeholder={t('admin.disputes.partialPlaceholder')} aria-label={t('admin.disputes.partialLabel')}
                    value={amounts[d.id] ?? ''}
                    onChange={e => setAmounts(s => ({ ...s, [d.id]: e.target.value }))}
                    wrapperStyle={{ width: 90 }}
                    style={{ ...compactField, padding: '6px 8px', fontFamily: F.mono }}
                  />
                  <Btn variant="secondary" size="sm" disabled={busyId === d.id} onClick={() => resolve(d, 'refund_partial')}>
                    {busyId === d.id ? '…' : t('admin.disputes.refundPartial')}
                  </Btn>
                  <Btn variant="danger" size="sm" disabled={busyId === d.id} onClick={() => resolve(d, 'denied')}>
                    {busyId === d.id ? '…' : t('admin.disputes.deny')}
                  </Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <h2 style={{ fontSize: T.lg, fontWeight: 600, color: C.text, fontFamily: F.display, marginBottom: 12 }}>
            {t('admin.disputes.resolved')}
          </h2>
          {resolved.map(d => {
            const booking = bookings[d.booking_id]
            return (
              <Card key={d.id} style={{ marginBottom: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={TX.body}>{reasonLabel(d.reason_code, tOr)}</div>
                  <div style={{ ...TX.caption, marginTop: 2 }}>
                    {booking ? `${booking.advertiser_name} · ${booking.screen_name}` : d.booking_id}
                  </div>
                </div>
                <Badge status={d.resolution === 'denied' ? 'rejected' : 'approved'}>
                  {d.resolution === 'denied' ? t('admin.disputes.deniedBadge') : t('admin.disputes.refundedBadge', { amount: money(Number(d.resolved_amount ?? 0)) })}
                </Badge>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
