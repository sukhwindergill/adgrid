import { useState } from 'react';
import { supabase } from './supabase.js';
import { SUPABASE_FUNCTIONS_URL } from './constants.js';
import { C, F } from '../design/tokens.js';
import { useConfirm } from '../components/primitives/ConfirmModal.jsx';
import { Btn } from '../components/primitives/Btn.jsx';

export function ApproveBtn({ campaign, setCampaigns, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const confirm = useConfirm();

  const approve = async e => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setErr(null);

    const { data: { session } } = await supabase.auth.getSession();

    // Try Stripe charge first; fall back to direct DB update if advertiser has no Stripe
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/charge-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ campaign_id: campaign.id }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.error ?? 'Charge failed';

      // If advertiser has no payment method yet, still allow manual approval
      const isNoPayment = msg.toLowerCase().includes('no payment') || msg.toLowerCase().includes('no card');
      if (isNoPayment) {
        const confirmed = await confirm({
          title: 'Approve without charging?',
          message: `${msg}\n\nYou can collect payment manually.`,
          confirmLabel: 'Approve',
          danger: false,
        });
        if (!confirmed) { setLoading(false); return; }
        const { error: dbErr } = await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
        if (dbErr) { setErr(dbErr.message); setLoading(false); return; }
        setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'scheduled' } : x));
        setLoading(false);
        onSuccess?.();
        return;
      }

      setErr(msg);
      setLoading(false);
      return;
    }

    const { error: dbErr } = await supabase.from('bookings').update({ status: 'scheduled', payment_status: 'paid' }).eq('id', campaign.id);
    if (dbErr) {
      // charge-campaign already succeeded at this point -- the advertiser
      // was actually charged. A failure here previously proceeded anyway,
      // optimistically marking the row scheduled/paid in the UI regardless
      // of whether the DB write happened, leaving the real booking stuck at
      // pending_review with no indication the operator needs to retry or
      // escalate a charge that already went through.
      setErr(`Charged, but failed to update booking status: ${dbErr.message}. Retry or update manually — do not charge again.`);
      setLoading(false);
      return;
    }
    setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'scheduled', payment_status: 'paid' } : x));
    setLoading(false);
    onSuccess?.();
  };

  return (
    <div>
      <Btn variant="success" size="sm" onClick={approve} disabled={loading}>
        {loading ? '…' : '✓ Approve'}
      </Btn>
      {err && <div style={{ fontSize: 10, color: C.red, fontFamily: F.sans, marginTop: 3, maxWidth: 110 }}>{err}</div>}
    </div>
  );
}
