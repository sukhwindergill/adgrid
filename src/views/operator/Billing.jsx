import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';

const TRANSACTIONS = [
  { id: 'pi_001', advertiser: 'Pret A Manger', amount: 480,  fee: 44,  status: 'paid',       date: '2026-03-21', method: 'Visa ••••4242' },
  { id: 'pi_002', advertiser: 'Nike',           amount: 2200, fee: 194, status: 'paid',       date: '2026-03-15', method: 'Mastercard ••••5555' },
  { id: 'pi_003', advertiser: 'Lloyds Bank',   amount: 1440, fee: 131, status: 'processing', date: '2026-04-01', method: 'Visa ••••1234' },
  { id: 'pi_004', advertiser: 'Tim Hortons',   amount: 720,  fee: 67,  status: 'paid',       date: '2026-03-21', method: 'Mastercard ••••7777' },
  { id: 'pi_005', advertiser: 'MLSE',           amount: 1200, fee: 110, status: 'paid',       date: '2026-03-21', method: 'Amex ••••8888' },
];

const INIT_PAYOUTS = [
  { owner: 'Corner Brew Coffee',     screen: 'SCR-001', amount: 248, status: 'transferred', date: '2026-03-31' },
  { owner: 'Greenfield Properties',  screen: 'SCR-002', amount: 776, status: 'transferred', date: '2026-03-31' },
  { owner: 'Slate Asset Management', screen: 'SCR-008', amount: 346, status: 'scheduled',   date: '2026-04-01' },
  { owner: 'Ossington Hospitality',  screen: 'SCR-009', amount: 98,  status: 'scheduled',   date: '2026-04-01' },
];

export function Billing() {
  const [tab, setTab]             = useState('overview');
  const [processingId, setProc]   = useState(null);
  const [payouts, setPayouts]     = useState(INIT_PAYOUTS);

  const total   = TRANSACTIONS.filter(t => t.status === 'paid').reduce((a, t) => a + t.amount, 0);
  const fees    = TRANSACTIONS.filter(t => t.status === 'paid').reduce((a, t) => a + t.fee, 0);
  const pending = payouts.filter(p => p.status === 'scheduled').reduce((a, p) => a + p.amount, 0);
  const paid    = payouts.filter(p => p.status === 'transferred').reduce((a, p) => a + p.amount, 0);

  const doPayout = (owner) => {
    setProc(owner);
    setTimeout(() => { setPayouts(prev => prev.map(p => p.owner === owner ? { ...p, status: 'transferred' } : p)); setProc(null); }, 1500);
  };

  return (
    <div>
      <PageHeader title="Billing & Payouts" subtitle="Stripe charges, owner revenue share, and payout management"
        actions={<a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer"><Btn variant="secondary" size="sm">Stripe Dashboard ↗</Btn></a>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Revenue"   value={`£${total.toLocaleString()}`}   sub="from advertisers" trend={14} icon="💰" />
        <KPI label="Platform Net"    value={`£${(total - fees).toLocaleString()}`} sub="after Stripe fees" color={C.blue} icon="$" />
        <KPI label="Pending Payouts" value={`£${pending.toLocaleString()}`} sub="to screen owners" color={C.amber} icon="⏳" />
        <KPI label="Paid Out"        value={`£${paid.toLocaleString()}`}    sub="to screen owners" color={C.green} icon="✓" />
      </div>

      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'charges', label: 'Charges' }, { id: 'payouts', label: 'Payouts' }, { id: 'connect', label: 'Screen Accounts' }]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Revenue Split</div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
              <div style={{ width: '12%', background: C.blue }} /><div style={{ width: '35%', background: C.green }} /><div style={{ flex: 1, background: C.surfaceAlt }} />
            </div>
            {[['Stripe Fees', `£${fees.toLocaleString()}`, C.textSub], ['Platform (12%)', `£${Math.round(total * 0.12).toLocaleString()}`, C.blue], ['Screen Owners (40%)', `£${Math.round(total * 0.88 * 0.40).toLocaleString()}`, C.green], ['Network Pool', `£${Math.round(total * 0.88 * 0.60).toLocaleString()}`, C.textSub]].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: 13, color: C.textMid }}>{l}</span><span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Recent Activity</div>
            {[...TRANSACTIONS.slice(0, 4), ...payouts.slice(0, 2)].slice(0, 6).map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{t.advertiser || t.owner}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{t.advertiser ? 'Charge' : 'Payout'} · {t.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.advertiser ? C.green : C.amber, fontFamily: F.mono }}>{t.advertiser ? '+' : '−'}£{t.amount.toLocaleString()}</div>
                  <Badge status={t.status}>{t.status}</Badge>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'charges' && (
        <Table
          columns={[
            { key: 'id',         label: 'ID',         render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{v}</span> },
            { key: 'advertiser', label: 'Advertiser' },
            { key: 'date',       label: 'Date',       render: v => <span style={{ fontFamily: F.mono, fontSize: 11 }}>{v}</span> },
            { key: 'method',     label: 'Method',     render: v => <span style={{ fontFamily: F.mono, fontSize: 11 }}>{v}</span> },
            { key: 'amount',     label: 'Gross',      render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>£{v.toLocaleString()}</span> },
            { key: 'fee',        label: 'Stripe Fee', render: v => <span style={{ color: C.textSub, fontFamily: F.mono }}>£{v}</span> },
            { key: 'amount',     label: 'Net',        render: (v, r) => <span style={{ color: C.green, fontWeight: 600, fontFamily: F.mono }}>£{(v - r.fee).toLocaleString()}</span> },
            { key: 'status',     label: 'Status',     render: v => <Badge status={v} /> },
          ]}
          rows={TRANSACTIONS} />
      )}

      {tab === 'payouts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <Btn variant="success" size="sm" onClick={() => payouts.filter(p => p.status === 'scheduled').forEach(p => doPayout(p.owner))}>
              Run All Pending Payouts
            </Btn>
          </div>
          <Table
            columns={[
              { key: 'owner',  label: 'Screen Owner' },
              { key: 'screen', label: 'Screen ID',   render: v => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{v}</span> },
              { key: 'date',   label: 'Date' },
              { key: 'amount', label: 'Amount',      render: v => <span style={{ fontWeight: 600, color: C.green, fontFamily: F.mono }}>£{v.toLocaleString()}</span> },
              { key: 'status', label: 'Status',      render: v => <Badge status={v} /> },
              { key: 'owner',  label: '',            render: (v, r) => r.status === 'scheduled' ? <Btn variant="success" size="sm" onClick={() => doPayout(v)}>{processingId === v ? 'Sending…' : 'Pay Now'}</Btn> : null },
            ]}
            rows={payouts} />
        </div>
      )}

      {tab === 'connect' && (
        <div>
          <div style={{ padding: '12px 16px', background: C.purpleSoft, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: C.textSub, fontFamily: F.sans }}>
            Screen owners connect their bank via Stripe Connect. ADGRID never handles their banking details — Stripe transfers funds directly.
          </div>
          <Table
            columns={[
              { key: 'owner',  label: 'Screen Owner' },
              { key: 'screen', label: 'Screen',      render: v => <span style={{ fontFamily: F.mono, fontSize: 11 }}>{v}</span> },
              { key: 'amount', label: 'Pending',     render: v => <span style={{ fontWeight: 600, color: C.amber, fontFamily: F.mono }}>£{v.toLocaleString()}</span> },
              { key: 'status', label: 'Stripe Status', render: v => <Badge status={v} /> },
              { key: 'owner',  label: '',            render: (_, r) => r.status === 'scheduled' ? <Btn variant="ghost" size="sm">Send Onboarding Link</Btn> : <span style={{ fontSize: 11, color: C.green, fontFamily: F.sans }}>✓ Connected</span> },
            ]}
            rows={payouts} />
        </div>
      )}
    </div>
  );
}
