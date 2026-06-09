import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { SkeletonRow, SkeletonTable } from '../../components/ui/Skeleton.jsx';

function useBilling() {
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  const fetch_ = async () => {
    setLoad(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoad(false); return; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/operator-billing?action=summary`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) { setError('Failed to load billing data'); setLoad(false); return; }
    setData(await res.json());
    setLoad(false);
  };

  useEffect(() => { fetch_(); }, []);
  return { data, loading, error, refresh: fetch_ };
}

export function Billing() {
  const toast = useToast();
  const [tab, setTab]         = useState('overview');
  const [payingOut, setPaying] = useState(false);
  const { data, loading, error, refresh } = useBilling();
  const { isMobile } = useBreakpoint();

  const charges       = data?.charges ?? [];
  const payouts       = data?.payouts ?? [];
  const balance       = data?.balance;
  const connectStatus = data?.connectStatus;

  const totalCharged  = charges.reduce((a, c) => a + c.amount, 0);
  const platformNet   = Math.round(totalCharged * 0.12);
  const ownerShare    = Math.round(totalCharged * 0.88 * 0.40);
  const availableOut  = balance?.available ?? 0;
  const pendingIn     = balance?.pending ?? 0;

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

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Ad Spend"   value={`$${totalCharged.toLocaleString()}`}  sub="charged campaigns" trend={14} icon="💰" />
        <KPI label="Platform Net"     value={`$${platformNet.toLocaleString()}`}   sub="12% platform fee"  color={C.blue} icon="$" />
        <KPI label="Available Balance" value={balance ? `$${availableOut.toLocaleString()}` : '—'} sub={connectStatus === 'active' ? 'ready to pay out' : 'connect Stripe'} color={C.green} icon="✓" />
        <KPI label="Pending Balance"  value={balance ? `$${pendingIn.toLocaleString()}` : '—'} sub="in transit" color={C.amber} icon="⏳" />
      </div>

      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'charges', label: 'Charges' }, { id: 'payouts', label: 'Payouts' }]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Revenue Split</div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
              <div style={{ width: '12%', background: C.blue }} />
              <div style={{ width: '35%', background: C.green }} />
              <div style={{ flex: 1, background: C.surfaceAlt }} />
            </div>
            {[
              ['Platform (12%)', `$${platformNet.toLocaleString()}`, C.blue],
              ['Screen Owners (40%)', `$${ownerShare.toLocaleString()}`, C.green],
              ['Network Pool (48%)', `$${(totalCharged - platformNet - ownerShare).toLocaleString()}`, C.textSub],
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
        charges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💳</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>No charges yet</div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Charges appear here when campaigns are approved and paid</div>
          </div>
        ) : (
          <Table
            columns={[
              { key: 'id',         label: 'Payment ID',  render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{String(v).slice(0, 20)}…</span> },
              { key: 'advertiser', label: 'Advertiser' },
              { key: 'screen',     label: 'Screen' },
              { key: 'date',       label: 'Date',        render: v => <span style={{ fontFamily: F.mono, fontSize: 11 }}>{v}</span> },
              { key: 'amount',     label: 'Gross',       render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>${Number(v).toLocaleString()}</span> },
              { key: 'amount',     label: 'Platform (12%)', render: v => <span style={{ color: C.blue, fontFamily: F.mono }}>${Math.round(v * 0.12).toLocaleString()}</span> },
              { key: 'status',     label: 'Status',      render: v => <Badge status={v} /> },
            ]}
            rows={charges} />
        )
      )}

      {tab === 'payouts' && (
        connectStatus !== 'active' ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏦</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Bank account not connected</div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Connect your Stripe account to enable payouts</div>
          </div>
        ) : payouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
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
    </div>
  );
}
