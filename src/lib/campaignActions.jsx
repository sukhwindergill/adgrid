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
        // Was a direct bookings.update({status:'scheduled'}) -- always
        // failed, since authenticated has no column-level UPDATE grant on
        // bookings.status at all. Routed through
        // operator-schedule-unpaid-campaign instead (same fix as mobile's
        // useApprovals.js and web's ApprovalQueue.jsx), which verifies the
        // caller owns a screen on this campaign and writes with the
        // service role.
        const schedRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/operator-schedule-unpaid-campaign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ campaign_id: campaign.id }),
        });
        const schedBody = await schedRes.json().catch(() => ({}));
        const schedResult = schedBody?.results?.[0];
        if (!schedRes.ok || !schedResult?.ok) {
          setErr(schedResult?.error ?? schedBody?.error ?? 'Unknown error');
          setLoading(false);
          return;
        }
        setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'scheduled' } : x));
        setLoading(false);
        onSuccess?.();
        return;
      }

      setErr(msg);
      setLoading(false);
      return;
    }

    // charge-campaign (service role) already set status: 'scheduled' and
    // payment_status: 'paid' server-side on success -- a redundant client
    // write here to those same columns always failed (authenticated has no
    // column-level UPDATE grant on bookings.status or payment_status),
    // showing a false "Charged, but failed to update booking status" error
    // on every single successful approval. Just sync local state.
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
