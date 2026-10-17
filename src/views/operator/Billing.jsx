import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
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
import { EmptyState } from '../../components/primitives/EmptyState.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { SkeletonRow, SkeletonTable } from '../../components/primitives/Skeleton.jsx';
import { useOperatorBilling } from '../../hooks/useOperatorBilling.js';
import { IconDollar, IconClock, IconWarning, IconCard, IconBank } from '../../components/icons.jsx';
import { useT } from '../../i18n/useT.js';
import { t as tr } from '../../i18n/core.js';

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
  const { t, tx, formatCurrency, formatMoney, formatDate } = useT();
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 });
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
  // default — an operator on a custom rate previously saw a wrong number here.
  const ownerRevenueShare = profile?.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE;
  const totalCharged  = charges.reduce((a, c) => a + c.amount, 0);
  const { platform: platformNet, owner: ownerShare } = computeRevenueSplit(totalCharged, ownerRevenueShare);
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
    if (!res.ok) { toast.error(t('op.billing.payoutFailed', { error: json.error })); return; }
    toast.success(t('op.billing.payoutStarted', { date: formatDate(json.arrival_date) }));
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
      toast.error(t('op.billing.noDates'));
      return;
    }
    setRetryingId(transfer.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error(t('op.billing.sessionExpired')); setRetryingId(null); return; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/trigger-payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ periodStart: booking.start_date, periodEnd: booking.end_date }),
    });
    const json = await res.json().catch(() => ({}));
    setRetryingId(null);
    if (!res.ok && !json.ok) { toast.error(json.error ?? t('op.billing.retryFailed')); return; }
    if (json.failures?.length > 0) { toast.error(json.failures[0].error ?? t('op.billing.retryFailedAgain')); return; }
    toast.success(t('op.billing.retried'));
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
      <div style={{ padding: 24, textAlign: 'center', color: C.redText, fontFamily: F.sans }}>{error}</div>
    );
  }

  return (
    <div>
      <PageHeader title={t('op.billing.title')} subtitle={t('op.billing.subtitle')}
        actions={<a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer"><Btn variant="secondary" size="sm">{t('op.billing.stripeDashboard')}</Btn></a>} />

      {failedTransfersError && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', marginBottom: 20, background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: T.base, color: C.redText, fontFamily: F.sans }}>
          <span style={{ flexShrink: 0 }}><IconWarning size={16} /></span>
          <span>{t('op.billing.failedCheck')}</span>
        </div>
      )}

      {failedTransfers.length > 0 && (
        <div style={{ padding: '12px 16px', marginBottom: 20, background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: T.base, color: C.redText, fontFamily: F.sans }}>
          <div style={{ display: 'flex', gap: 8, lineHeight: 1.6, marginBottom: 10 }}>
            <span style={{ flexShrink: 0 }}><IconWarning size={16} /></span>
            <span>
            {tx('op.billing.failedBanner', { b: chunk => <strong>{chunk}</strong>, count: failedTransfers.length, amount: money(failedTransfers.reduce((a, tr) => a + Number(tr.amount), 0)) })}
            </span>
          </div>
          {failedTransfers.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0 8px 24px', borderTop: `1px solid ${C.redBorder}` }}>
              <span style={TX.body}>
                {t.bookings?.advertiser_name ?? t.booking_id} — {formatMoney(Number(t.amount), t.currency)}
              </span>
              <Btn variant="danger" size="sm" disabled={retryingId === t.id} onClick={() => retryTransfer(t)}>
                {retryingId === t.id ? tr('op.billing.retrying') : tr('op.billing.retry')}
              </Btn>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label={t('op.billing.kpiSpend')} value={money(totalCharged)} sub={t('op.billing.kpiSpendSub')} trend={chargedTrend} trendLabel={t('dash.vsPrior')} icon={<IconDollar size={16} />} />
        <KPI label={t('op.billing.kpiNet')} value={money(platformNet)} sub={t('op.billing.platformShare', { pct: 100 - ownerPct })}  color={C.blue} icon={<IconDollar size={16} />} />
        <KPI label={t('op.billing.kpiAvailable')} value={balance ? money(availableOut) : '—'} sub={connectStatus === 'active' ? t('op.billing.readyToPay') : t('op.billing.connectStripe')} color={C.green} icon="✓" />
        <KPI label={t('op.billing.kpiPending')} value={balance ? money(pendingIn) : '—'} sub={t('op.billing.inTransit')} color={C.amber} icon={<IconClock size={16} />} />
      </div>

      <Tabs tabs={[{ id: 'overview', label: t('op.billing.tabOverview') }, { id: 'charges', label: t('op.billing.tabCharges') }, { id: 'payouts', label: t('op.billing.tabPayouts') }, { id: 'tax', label: t('op.billing.tabTax') }]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ ...TX.title, marginBottom: 14 }}>{t('op.billing.split')}</div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
              <div style={{ width: `${ownerPct}%`, background: C.green }} />
              <div style={{ flex: 1, background: C.blue }} />
            </div>
            {[
              [t('op.billing.owners', { pct: ownerPct }), money(ownerShare), C.green],
              [t('op.billing.platform', { pct: 100 - ownerPct }), money(platformNet), C.blue],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: T.base, color: C.textMid }}>{l}</span>
                <span style={{ fontSize: T.md, fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ ...TX.title, marginBottom: 14 }}>{t('op.billing.connectBalance')}</div>
            {connectStatus !== 'active' ? (
              <div style={{ ...TX.bodySub, lineHeight: 1.7 }}>
                {tx('op.billing.connectFirst', { b: chunk => <strong>{chunk}</strong> })}
              </div>
            ) : (
              <>
                {upcomingPayout ? (
                  <div style={{ ...TX.body, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 14, background: C.amberSoft, borderRadius: 8 }}>
                    <span style={{ flexShrink: 0, color: C.amberText }}><IconClock size={14} /></span>
                    <span>{tx('op.billing.nextPayout', { b: chunk => <strong>{chunk}</strong>, amount: money(Number(upcomingPayout.amount)), date: formatDate(upcomingPayout.arrival_date) })}</span>
                  </div>
                ) : (
                  <div style={{ ...TX.bodySub, padding: '10px 12px', marginBottom: 14, background: C.surfaceAlt, borderRadius: 8, lineHeight: 1.5 }}>
                    {lastPayout
                      ? <>{tx('op.billing.noScheduledLast', { b: chunk => <strong>{chunk}</strong>, days: daysSinceLast, amount: money(Number(lastPayout.amount)), date: formatDate(lastPayout.arrival_date) })}</>
                      : <>{t('op.billing.noScheduled')}</>}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[[t('op.billing.available'), money(availableOut), C.green], [t('op.billing.pending'), money(pendingIn), C.amber]].map(([l, v, c]) => (
                    <div key={l} style={{ padding: 14, background: C.surfaceAlt, borderRadius: 8 }}>
                      <div style={{ ...TX.caption, marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: T.xxl, fontWeight: 700, color: c, fontFamily: F.mono }}>{v}</div>
                    </div>
                  ))}
                </div>
                <Btn variant="success" size="sm" onClick={doPayoutAll} disabled={payingOut || availableOut <= 0}>
                  {payingOut ? t('op.billing.initiating') : t('op.billing.payOut', { amount: money(availableOut) })}
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
          <EmptyState icon={<IconCard size={28} />} title={t('op.billing.noCharges')} description={t('op.billing.noChargesSub')} />
        ) : (
          <Table
            columns={[
              { key: 'id',          label: t('op.billing.paymentId'),   render: v => <span style={TX.mono}>{String(v).slice(0, 20)}…</span> },
              { key: 'description', label: t('op.billing.description'),  render: v => v || '—' },
              { key: 'created',     label: t('op.billing.date'), render: v => <span style={{ fontFamily: F.mono, fontSize: T.xs }}>{formatDate(v)}</span> },
              { key: 'amount',      label: t('op.billing.gross'), render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>{money(Number(v))}</span> },
              { key: 'fee',         label: t('op.billing.platformFee'), render: v => <span style={{ color: C.blueText, fontFamily: F.mono }}>{money(Number(v))}</span> },
              { key: 'status',      label: t('op.billing.status'), render: v => <Badge status={v} /> },
            ]}
            rows={stripeCharges} />
        )
      )}

      {tab === 'payouts' && (
        connectStatus !== 'active' ? (
          <EmptyState icon={<IconBank size={28} />} title={t('op.billing.notConnected')} description={t('op.billing.notConnectedSub')} />
        ) : payouts.length === 0 ? (
          <EmptyState icon={<IconClock size={28} />} title={t('op.billing.noPayouts')} description={t('op.billing.noPayoutsSub')} />
        ) : (
          <Table
            columns={[
              { key: 'id',           label: t('op.billing.payoutId'),    render: v => <span style={TX.mono}>{v}</span> },
              { key: 'amount',       label: t('op.billing.amount'), render: v => <span style={{ fontWeight: 600, color: C.greenText, fontFamily: F.mono }}>{money(Number(v))}</span> },
              { key: 'status',       label: t('op.billing.status'), render: v => <Badge status={v} /> },
              { key: 'arrival_date', label: t('op.billing.arrival'), render: v => <span style={{ fontFamily: F.mono, fontSize: T.xs }}>{formatDate(v)}</span> },
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
              style={{ ...TX.body, padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Btn
              variant="secondary" size="sm"
              disabled={taxLoading || taxSummary.total === 0}
              onClick={() => downloadCsv(`adgrid-tax-summary-${taxYear}.csv`, TAX_SUMMARY_CSV_COLUMNS, taxSummaryCsvRows(taxSummary))}
            >{t('op.billing.downloadCsv')}</Btn>
          </div>

          {taxLoading ? (
            <SkeletonTable rows={5} cols={2} />
          ) : taxError ? (
            <EmptyState role="alert" style={{ color: C.redText, fontFamily: F.sans, fontSize: T.base }}>
              {t('op.billing.taxError', { year: String(taxYear) })}
            </EmptyState>
          ) : taxSummary.total === 0 ? (
            <EmptyState icon={<IconBank size={28} />} title={t('op.billing.noPaidPayouts', { year: String(taxYear) })}
              description={t('op.billing.noPaidPayoutsSub')} />
          ) : (
            <>
              <div style={{ marginBottom: 16, padding: 16, background: C.surfaceAlt, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={TX.bodySub}>{t('op.billing.totalReceived', { year: String(taxYear) })}</span>
                <span style={{ fontSize: T.xxl, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{money(taxSummary.total)} {taxSummary.currency.toUpperCase()}</span>
              </div>
              <Table
                columns={[
                  { key: 'month', label: t('op.billing.month') },
                  { key: 'amount', label: 'Amount', render: v => <span style={{ fontFamily: F.mono, fontWeight: v > 0 ? 600 : 400, color: v > 0 ? C.text : C.textMuted }}>{money(Number(v))}</span> },
                ]}
                rows={taxSummary.byMonth.map((m, i) => ({ ...m, month: formatDate(new Date(2000, i, 1), { month: 'long' }) }))} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
