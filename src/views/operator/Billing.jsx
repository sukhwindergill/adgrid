import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { periodDelta, splitByPeriod } from '../../lib/periodDelta.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { computeRevenueSplit, DEFAULT_OWNER_REVENUE_SHARE } from '../../lib/revenueSplit.js';
import { nextPayout, lastCompletedPayout, daysSince } from '../../lib/payoutSummary.js';
import { summarizeAnnualPayouts, taxSummaryCsvRows, TAX_SUMMARY_CSV_COLUMNS } from '../../lib/taxSummary.js';
import { downloadCsv } from '../../lib/csv.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { SkeletonRow, SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { useOperatorBilling } from '../../hooks/useOperatorBilling.js';
import { IconDollar, IconClock, IconWarning, IconCard, IconBank } from '../../components/icons.jsx';

// The Charges tab used to reimplement a charge list from `bookings` (gross
// budget only, platform fee computed client-side). get-stripe-charges reads
// the real Stripe charge objects on the operator's own Connect account —
// actual amount charged and Stripe's own application_fee_amount, not an
// assumed 12%. It existed unused until now (see get-stripe-charges/index.ts
// for the accompanying fix: it previously queried the platform's Stripe
// account instead of the operator's connected one).
function useStripeCharges() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/get-stripe-charges`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setCharges(await res.json());
      setLoading(false);
    })();
  }, []);

  return { stripeCharges: charges, stripeChargesLoading: loading };
}

// B16: operator_transfers.status = 'failed' rows previously existed only in
// the database — nothing on this page (or anywhere else) ever read them, so
// a failed payout was invisible until someone happened to run raw SQL.
//
// Product-audit finding (later session): visibility only got the operator
// halfway. trigger-payout -- the edge function documented as "a backfill
// safety net for transfers distributeOperatorCuts failed to send" -- had no
// caller anywhere in the app either. The failed-transfer banner told an
// operator to "contact support" because there was, in fact, no self-serve
// way to retry; the payout_transfer_failed email's "we'll retry once it's
// resolved" was never true. booking(start_date, end_date) is fetched here
// so Retry can call trigger-payout with that exact booking's period.
function useFailedTransfers() {
  const [failed, setFailed] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const refresh = useCallback(() => {
    supabase
      .from('operator_transfers')
      .select('id, booking_id, amount, currency, created_at, bookings(start_date, end_date, advertiser_name)')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        // This fetch exists specifically to surface failed payouts that
        // were previously invisible (see B16 above) -- silently swallowing
        // its own fetch error would recreate exactly that blind spot: a
        // real failed transfer looking identical to "nothing failed"
        // whenever the query itself couldn't run.
        setLoadError(Boolean(error));
        setFailed(data ?? []);
      });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { failedTransfers: failed, failedTransfersError: loadError, refreshFailedTransfers: refresh };
}

// Fetches a full calendar year of paid payouts on demand -- the `summary`
// action's 20-payout cap is fine for "what's recent" but not for a document
// meant to cover January through December. Only fires when the Tax Summary
// tab is actually opened, not on every Billing page load.
function useTaxSummary(year, enabled) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/operator-billing?action=tax_summary&year=${year}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (cancelled) return;
      if (!res.ok) { setError(true); setLoading(false); return; }
      const json = await res.json();
      setPayouts(json.payouts ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [year, enabled]);

  return { payouts, loading, error };
}

export function Billing() {
  const toast = useToast();
  const { profile } = useAuth();
  const [tab, setTab]         = useState('overview');
  const [payingOut, setPaying] = useState(false);
  const { data, loading, error, refresh } = useOperatorBilling();
  const { isMobile } = useBreakpoint();
  const { failedTransfers, failedTransfersError, refreshFailedTransfers } = useFailedTransfers();
  const [retryingId, setRetryingId] = useState(null);
  const { stripeCharges, stripeChargesLoading } = useStripeCharges();
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const { payouts: taxPayouts, loading: taxLoading, error: taxError } = useTaxSummary(taxYear, tab === 'tax');
  const taxSummary = summarizeAnnualPayouts(taxPayouts, taxYear);

  const charges       = data?.charges ?? [];
  const payouts       = data?.payouts ?? [];
  const balance       = data?.balance;
  const connectStatus = data?.connectStatus;

  // Real per-operator share (profiles.owner_revenue_share), not a hardcoded
  // 40% — an operator on a custom rate previously saw a wrong number here.
  const ownerRevenueShare = profile?.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE;
  const totalCharged  = charges.reduce((a, c) => a + c.amount, 0);
  const { platform: platformNet, owner: ownerShare, pool: networkPool } = computeRevenueSplit(totalCharged, ownerRevenueShare);
  const ownerPct = Math.round(ownerRevenueShare * 100);
  const availableOut  = balance?.available ?? 0;
  const pendingIn     = balance?.pending ?? 0;

  // `charges` rows are shaped { id, advertiser, screen, date, amount, status }
  // by the operator-billing edge function — the date field is `date`.
  const chargedPeriods = splitByPeriod(charges, 'date', 'amount', 30);
  const chargedTrend   = periodDelta(chargedPeriods.current, chargedPeriods.prior);

  // Payouts here are on-demand, not a fixed cadence — see payoutSummary.js.
  // This surfaces what's actually true: a payout already in flight (a real
  // Stripe arrival date), or how long it's been since the last one landed.
  const upcomingPayout = nextPayout(payouts);
  const lastPayout     = lastCompletedPayout(payouts);
  const daysSinceLast  = lastPayout ? daysSince(lastPayout.arrival_date) : null;

  const doPayoutAll = async () => {
    if (availableOut <= 0) return;
    setPaying(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/operator-billing?action=payout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: availableOut }),
    });
    const json = await res.json();
    setPaying(false);
    if (!res.ok) { toast.error(`Payout failed: ${json.error}`); return; }
    toast.success(`Payout initiated — arrives ${json.arrival_date}`);
    refresh();
  };

  // Calls trigger-payout with the failed booking's own date range as the
  // period -- trigger-payout re-sums every unhandled (never-transferred or
  // explicitly failed) booking in that window, which naturally resolves to
  // just this one booking since anything else already succeeded. See the
  // useFailedTransfers comment above for why this exists at all.
  const retryTransfer = async (transfer) => {
    const booking = transfer.bookings;
    if (!booking?.start_date || !booking?.end_date) {
      toast.error("Can't retry — this booking's dates are missing.");
      return;
    }
    setRetryingId(transfer.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Session expired. Please log in again.'); setRetryingId(null); return; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/trigger-payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ periodStart: booking.start_date, periodEnd: booking.end_date }),
    });
    const json = await res.json().catch(() => ({}));
    setRetryingId(null);
    if (!res.ok && !json.ok) { toast.error(json.error ?? 'Retry failed — check your Connect status in Settings.'); return; }
    if (json.failures?.length > 0) { toast.error(json.failures[0].error ?? 'Retry failed again.'); return; }
    toast.success('Payout retried successfully.');
    refreshFailedTransfers();
    refresh();
  };

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.red, fontFamily: F.sans }}>{error}</div>
    );
  }

  return (
    <div>
      <PageHeader title="Billing & Payouts" subtitle="Stripe charges, owner revenue share, and payout management"
        actions={<a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer"><Btn variant="secondary" size="sm">Stripe Dashboard ↗</Btn></a>} />

      {failedTransfersError && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', marginBottom: 20, background: C.redSoft, border: `1px solid ${C.redBorder ?? '#fecaca'}`, borderRadius: 8, fontSize: 13, color: C.red, fontFamily: F.sans }}>
          <span style={{ flexShrink: 0 }}><IconWarning size={16} /></span>
          <span>Couldn't check for failed payouts — check your connection and try again.</span>
        </div>
      )}

      {failedTransfers.length > 0 && (
        <div style={{ padding: '12px 16px', marginBottom: 20, background: C.redSoft, border: `1px solid ${C.redBorder ?? '#fecaca'}`, borderRadius: 8, fontSize: 13, color: C.red, fontFamily: F.sans }}>
          <div style={{ display: 'flex', gap: 8, lineHeight: 1.6, marginBottom: 10 }}>
            <span style={{ flexShrink: 0 }}><IconWarning size={16} /></span>
            <span>
            <strong>{failedTransfers.length} payout transfer{failedTransfers.length !== 1 ? 's' : ''} failed</strong> —
            {' '}totalling ${failedTransfers.reduce((a, t) => a + Number(t.amount), 0).toLocaleString()}.
            This usually means Stripe needs more information from your connected account.
            Fix your Connect status in Settings, then retry below.
            </span>
          </div>
          {failedTransfers.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0 8px 24px', borderTop: `1px solid ${C.redBorder ?? '#fecaca'}` }}>
              <span style={{ color: C.text, fontFamily: F.sans, fontSize: 12.5 }}>
                {t.bookings?.advertiser_name ?? t.booking_id} — ${Number(t.amount).toLocaleString()} {t.currency?.toUpperCase()}
              </span>
              <Btn variant="danger" size="sm" disabled={retryingId === t.id} onClick={() => retryTransfer(t)}>
                {retryingId === t.id ? 'Retrying…' : 'Retry'}
              </Btn>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Ad Spend"   value={`$${totalCharged.toLocaleString()}`}  sub="charged campaigns" trend={chargedTrend} trendLabel="vs prior 30 days" icon={<IconDollar size={16} />} />
        <KPI label="Platform Net"     value={`$${platformNet.toLocaleString()}`}   sub="12% platform fee"  color={C.blue} icon={<IconDollar size={16} />} />
        <KPI label="Available Balance" value={balance ? `$${availableOut.toLocaleString()}` : '—'} sub={connectStatus === 'active' ? 'ready to pay out' : 'connect Stripe'} color={C.green} icon="✓" />
        <KPI label="Pending Balance"  value={balance ? `$${pendingIn.toLocaleString()}` : '—'} sub="in transit" color={C.amber} icon={<IconClock size={16} />} />
      </div>

      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'charges', label: 'Charges' }, { id: 'payouts', label: 'Payouts' }, { id: 'tax', label: 'Tax Summary' }]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Revenue Split</div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
              <div style={{ width: '12%', background: C.blue }} />
              <div style={{ width: `${ownerPct}%`, background: C.green }} />
              <div style={{ flex: 1, background: C.surfaceAlt }} />
            </div>
            {[
              ['Platform (12%)', `$${platformNet.toLocaleString()}`, C.blue],
              [`Screen Owners (${ownerPct}%)`, `$${ownerShare.toLocaleString()}`, C.green],
              ['Network Pool', `$${networkPool.toLocaleString()}`, C.textSub],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: 13, color: C.textMid }}>{l}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Stripe Connect Balance</div>
            {connectStatus !== 'active' ? (
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7 }}>
                Connect your bank account via Stripe to receive payouts.
                Go to <strong>Screens</strong> → <strong>Connect Stripe</strong> to get started.
              </div>
            ) : (
              <>
                {upcomingPayout ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 14, background: C.amberSoft, borderRadius: 8, fontSize: 12.5, color: C.text, fontFamily: F.sans }}>
                    <span style={{ flexShrink: 0, color: C.amber }}><IconClock size={14} /></span>
                    <span>Next payout — <strong>${Number(upcomingPayout.amount).toLocaleString()}</strong> arriving <strong>{upcomingPayout.arrival_date}</strong></span>
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px', marginBottom: 14, background: C.surfaceAlt, borderRadius: 8, fontSize: 12.5, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5 }}>
                    {lastPayout
                      ? <>No payout scheduled — payouts are on-demand. Last one landed <strong>{daysSinceLast}d ago</strong> (${Number(lastPayout.amount).toLocaleString()} on {lastPayout.arrival_date}).</>
                      : <>No payout scheduled — payouts are on-demand. Click below whenever you want available funds sent to your bank.</>}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[['Available', `$${availableOut.toLocaleString()}`, C.green], ['Pending', `$${pendingIn.toLocaleString()}`, C.amber]].map(([l, v, c]) => (
                    <div key={l} style={{ padding: 14, background: C.surfaceAlt, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: F.mono }}>{v}</div>
                    </div>
                  ))}
                </div>
                <Btn variant="success" size="sm" onClick={doPayoutAll} disabled={payingOut || availableOut <= 0}>
                  {payingOut ? 'Initiating…' : `Pay Out $${availableOut.toLocaleString()} to Bank`}
                </Btn>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'charges' && (
        stripeChargesLoading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : stripeCharges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ color: C.textMuted, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconCard size={28} /></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>No charges yet</div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Charges appear here when campaigns are approved and paid</div>
          </div>
        ) : (
          <Table
            columns={[
              { key: 'id',          label: 'Payment ID',   render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{String(v).slice(0, 20)}…</span> },
              { key: 'description', label: 'Description',  render: v => v || '—' },
              { key: 'created',     label: 'Date',          render: v => <span style={{ fontFamily: F.mono, fontSize: 11 }}>{new Date(v).toLocaleDateString()}</span> },
              { key: 'amount',      label: 'Gross',         render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>${Number(v).toLocaleString()}</span> },
              { key: 'fee',         label: 'Platform Fee',  render: v => <span style={{ color: C.blue, fontFamily: F.mono }}>${Number(v).toLocaleString()}</span> },
              { key: 'status',      label: 'Status',        render: v => <Badge status={v} /> },
            ]}
            rows={stripeCharges} />
        )
      )}

      {tab === 'payouts' && (
        connectStatus !== 'active' ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ color: C.textMuted, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconBank size={28} /></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Bank account not connected</div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Connect your Stripe account to enable payouts</div>
          </div>
        ) : payouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ color: C.textMuted, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconClock size={28} /></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>No payouts yet</div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Your first payout will appear here once initiated</div>
          </div>
        ) : (
          <Table
            columns={[
              { key: 'id',           label: 'Payout ID',    render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{v}</span> },
              { key: 'amount',       label: 'Amount',       render: v => <span style={{ fontWeight: 600, color: C.green, fontFamily: F.mono }}>${Number(v).toLocaleString()}</span> },
              { key: 'status',       label: 'Status',       render: v => <Badge status={v} /> },
              { key: 'arrival_date', label: 'Arrival Date', render: v => <span style={{ fontFamily: F.mono, fontSize: 11 }}>{v}</span> },
            ]}
            rows={payouts} />
        )
      )}

      {tab === 'tax' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <select
              value={taxYear}
              onChange={e => setTaxYear(Number(e.target.value))}
              style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Btn
              variant="secondary" size="sm"
              disabled={taxLoading || taxSummary.total === 0}
              onClick={() => downloadCsv(`adgrid-tax-summary-${taxYear}.csv`, TAX_SUMMARY_CSV_COLUMNS, taxSummaryCsvRows(taxSummary))}
            >↓ Download CSV</Btn>
          </div>

          {taxLoading ? (
            <SkeletonTable rows={5} cols={2} />
          ) : taxError ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.red, fontFamily: F.sans, fontSize: 13 }}>
              Couldn't load {taxYear}'s payouts — check your connection and try again.
            </div>
          ) : taxSummary.total === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <div style={{ color: C.textMuted, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconBank size={28} /></div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>No paid payouts in {taxYear}</div>
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Only payouts that have actually landed in your bank count toward this total.</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16, padding: 16, background: C.surfaceAlt, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Total received in {taxYear}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.mono }}>${taxSummary.total.toLocaleString()} {taxSummary.currency.toUpperCase()}</span>
              </div>
              <Table
                columns={[
                  { key: 'month', label: 'Month' },
                  { key: 'amount', label: 'Amount', render: v => <span style={{ fontFamily: F.mono, fontWeight: v > 0 ? 600 : 400, color: v > 0 ? C.text : C.textMuted }}>${Number(v).toLocaleString()}</span> },
                ]}
                rows={taxSummary.byMonth} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
